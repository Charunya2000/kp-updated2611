import { extractRawNoticeCode } from './rcnoaDecisionDisplay.js';

const WORKING_RCNA_COLUMN_COUNT = 78;
const OUTBOUND_RCNA_COLUMN_COUNT = 76;

const RCNA = Object.freeze({
  SUBSCRIBER_ID: 1,
  ANNUITANT: 7,
  LAST_NAME: 10,
  FIRST_NAME: 13,
  BIRTH_DATE: 16,
  MEMBER_SSN: 19,
  SUBSCRIBER_SSN: 22,
  PLAN_CODE: 25,
  START_DATE: 28,
  END_DATE: 31,
  ADDRESS_1: 34,
  ADDRESS_2: 37,
  ADDRESS_3: 40,
  CITY: 43,
  STATE: 46,
  ZIP: 49,
  COUNTRY: 52,
  PHONE: 55,
  PAYROLL_OFFICE: 61,
  RELATIONSHIP: 64,
  EXTENDED_END_DATE: 67,
  GENDER: 70,
  CODE: 74,
});

// Working RCNA column holding the source RCNO discrepancy family (F, I, or N).
const FAMILY_COLUMN = 3;
// Each RCNO comparison group is PSHBS, MENR, result, so the MENR value sits one
// column to the right of the PSHBS value. CODE is an RCNA decision column and is
// never offset.
const MENR_COLUMN_OFFSET = 1;
const PSHBS_COLUMNS = RCNA;
const MENR_COLUMNS = Object.freeze(Object.fromEntries(
  Object.entries(RCNA).map(([name, index]) => [
    name,
    name === 'CODE' ? index : index + MENR_COLUMN_OFFSET,
  ]),
));

// Fields that must be present on the source side for a row to be emitted. Rows
// missing any of these are skipped and reported rather than failing the 834.
const REQUIRED_SOURCE_FIELDS = Object.freeze([
  ['LAST_NAME', 'Last_Name'],
  ['FIRST_NAME', 'First_Name'],
  ['SUBSCRIBER_SSN', 'Subscriber_SSN'],
  ['ADDRESS_1', 'Address_Line1'],
]);

function sourceSideFor(record) {
  return normalized(record[FAMILY_COLUMN]) === 'I' ? 'MENR' : 'PSHBS';
}

function stringValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function normalized(value) {
  return stringValue(value).trim().toUpperCase();
}

function required(value, name) {
  const text = stringValue(value);
  if (!text.trim()) {
    throw new Error(`${name} is required`);
  }
  return text;
}

function validateDate(value, name) {
  const text = required(value, name);
  if (!/^\d{8}$/.test(text)) {
    throw new Error(`${name} must use YYYYMMDD format`);
  }
  const date = new Date(Date.UTC(
    Number(text.slice(0, 4)),
    Number(text.slice(4, 6)) - 1,
    Number(text.slice(6, 8)),
  ));
  if (
    date.getUTCFullYear() !== Number(text.slice(0, 4))
    || date.getUTCMonth() + 1 !== Number(text.slice(4, 6))
    || date.getUTCDate() !== Number(text.slice(6, 8))
  ) {
    throw new Error(`${name} is not a valid date`);
  }
  return text;
}

// Optional dates never fail the 834. A blank or malformed value is omitted.
function optionalDate(value) {
  try {
    return validateDate(stringValue(value).trim(), 'date');
  } catch {
    return '';
  }
}

function formatRuntimeDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');
}

function formatRuntimeTime(date, withSeconds = true) {
  const value = [
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
    String(date.getUTCSeconds()).padStart(2, '0'),
  ].join('');
  return withSeconds ? value : value.slice(0, 4);
}

function assertSafeValue(value, delimiters, name) {
  const text = stringValue(value);
  const delimiter = delimiters.find((item) => text.includes(item));
  if (delimiter) {
    throw new Error(`${name} contains reserved X12 delimiter "${delimiter}"`);
  }
  return text;
}

// Row data that contains an X12 delimiter is sanitized rather than rejected so a
// single value cannot fail the whole 834. Each delimiter becomes a space.
function sanitizeValue(value, delimiters) {
  const text = stringValue(value);
  if (!delimiters.some((item) => text.includes(item))) return text;
  return delimiters
    .reduce((result, item) => result.split(item).join(' '), text)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function pad(value, length, name) {
  const text = required(value, name);
  if (text.length > length) {
    throw new Error(`${name} exceeds ${length} characters`);
  }
  return text.padEnd(length, ' ');
}

function numberControl(value, length, name) {
  const text = required(value, name);
  if (!/^\d+$/.test(text) || text.length > length) {
    throw new Error(`${name} must be numeric and no longer than ${length} digits`);
  }
  return text.padStart(length, '0');
}

function compactSegment(elements, elementSeparator) {
  const values = [...elements];
  while (values.length > 1 && values[values.length - 1] === '') {
    values.pop();
  }
  return values.join(elementSeparator);
}

export class RcnaTo834Service {
  constructor({
    envelope,
    intentByCode,
    relationshipMap = {},
    addressLine3Handler,
    clock = () => new Date(),
    delimiters = {},
  } = {}) {
    if (!envelope || typeof envelope !== 'object') {
      throw new TypeError('envelope configuration is required');
    }
    if (!intentByCode || typeof intentByCode !== 'object') {
      throw new TypeError('intentByCode configuration is required');
    }

    this.envelope = envelope;
    this.intentByCode = intentByCode;
    this.relationshipMap = relationshipMap;
    this.addressLine3Handler = addressLine3Handler;
    this.clock = clock;
    this.elementSeparator = delimiters.element ?? '*';
    this.componentSeparator = delimiters.component ?? ':';
    this.repetitionSeparator = delimiters.repetition ?? '^';
    this.segmentTerminator = delimiters.segment ?? '~';
    const delimiterValues = [
      this.elementSeparator,
      this.componentSeparator,
      this.repetitionSeparator,
      this.segmentTerminator,
    ];
    if (delimiterValues.some((value) => stringValue(value).length !== 1)) {
      throw new Error('Each X12 delimiter must be exactly one character');
    }
    if (new Set(delimiterValues).size !== delimiterValues.length) {
      throw new Error('X12 delimiters must be unique');
    }
    this.reservedDelimiters = delimiterValues;
  }

  transform({ workingRcnaRecords }) {
    if (!Array.isArray(workingRcnaRecords) || workingRcnaRecords.length === 0) {
      throw new Error('workingRcnaRecords must contain at least one record');
    }
    workingRcnaRecords.forEach((record, index) => {
      if (
        !Array.isArray(record)
        || ![OUTBOUND_RCNA_COLUMN_COUNT, WORKING_RCNA_COLUMN_COUNT].includes(record.length)
      ) {
        throw new Error(`RCNA row ${index + 1} must contain exactly 76 or 78 columns`);
      }
    });

    const rows = [];
    const skipped = [];
    workingRcnaRecords.forEach((original, index) => {
      const record = [
        ...original,
        ...Array(WORKING_RCNA_COLUMN_COUNT - original.length).fill(''),
      ].map(stringValue);
      const sourceSide = sourceSideFor(record);
      const columns = sourceSide === 'MENR' ? MENR_COLUMNS : PSHBS_COLUMNS;
      const missingFields = REQUIRED_SOURCE_FIELDS
        .filter(([name]) => !record[columns[name]].trim())
        .map(([, label]) => `${sourceSide}_${label}`);
      if (missingFields.length) {
        skipped.push({
          sourceRow: index + 1,
          discrepancyFamily: normalized(record[FAMILY_COLUMN]),
          sourceSide,
          missingFields,
          record,
        });
        return;
      }
      rows.push({
        record,
        columns,
        sourceRow: index + 1,
        intent: this.#intentFor(original, index),
      });
    });
    if (rows.length === 0) {
      return {
        x12: null,
        counts: {
          subscribers: 0,
          dependents: 0,
          members: 0,
          transactionSegments: 0,
        },
        skipped,
      };
    }
    const actions = new Set(rows.map(({ intent }) => required(intent.bgnAction, 'bgnAction')));
    if (actions.size !== 1) {
      throw new Error('All records in one 834 transaction must use the same BGN08 action');
    }

    const groups = this.#groupRows(rows);
    const orderedRows = groups.flatMap(({ subscribers, dependents }) => [
      ...subscribers,
      ...dependents,
    ]);
    const now = this.clock();
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
      throw new Error('clock must return a valid Date');
    }

    const subscriberCount = groups.reduce(
      (count, { subscribers }) => count + subscribers.length,
      0,
    );
    const dependentCount = orderedRows.length - subscriberCount;
    const transactionSegments = [
      ['ST', '834', numberControl(this.envelope.transactionControlNumber, 9, 'transactionControlNumber'), '005010X220A1'],
      [
        'BGN',
        '00',
        required(this.envelope.transactionReference, 'transactionReference'),
        formatRuntimeDate(now),
        formatRuntimeTime(now),
        '',
        '',
        '',
        [...actions][0],
      ],
      ['QTY', 'ET', String(subscriberCount)],
      ['QTY', 'DT', String(dependentCount)],
      ['QTY', 'TO', String(orderedRows.length)],
      this.#n1('P5', this.envelope.sponsor, 'sponsor'),
      this.#n1('IN', this.envelope.payer, 'payer'),
    ];

    if (this.envelope.tpa) {
      transactionSegments.push(this.#n1('BO', this.envelope.tpa, 'tpa'));
    }
    orderedRows.forEach((row) => transactionSegments.push(...this.#memberSegments(row)));

    const stControl = transactionSegments[0][2];
    const segmentCount = transactionSegments.length + 1;
    transactionSegments.push(['SE', String(segmentCount), stControl]);

    const isaControl = numberControl(
      this.envelope.interchangeControlNumber,
      9,
      'interchangeControlNumber',
    );
    const groupControl = required(this.envelope.groupControlNumber, 'groupControlNumber');
    const segments = [
      this.#isa(now, isaControl),
      [
        'GS',
        'BE',
        required(this.envelope.applicationSenderCode, 'applicationSenderCode'),
        required(this.envelope.applicationReceiverCode, 'applicationReceiverCode'),
        formatRuntimeDate(now),
        formatRuntimeTime(now),
        groupControl,
        'X',
        '005010X220A1',
      ],
      ...transactionSegments,
      ['GE', '1', groupControl],
      ['IEA', '1', isaControl],
    ];

    const x12 = segments
      .map((segment) => (
        Array.isArray(segment)
          ? compactSegment(segment, this.elementSeparator)
          : segment
      ))
      .join(`${this.segmentTerminator}\r\n`) + `${this.segmentTerminator}\r\n`;

    return {
      x12,
      counts: {
        subscribers: subscriberCount,
        dependents: dependentCount,
        members: orderedRows.length,
        transactionSegments: segmentCount,
      },
      skipped,
    };
  }

  #intentFor(record, index) {
    const code = extractRawNoticeCode(record[RCNA.CODE]);
    // Multiple N-family Priority 3 matches are joined with '/' (e.g. DM508/DM507).
    // Use the first token with an approved intent, falling back to later tokens.
    const token = code.split('/').map((item) => item.trim()).find((item) => item && this.intentByCode[item]);
    const intent = token ? this.intentByCode[token] : undefined;
    if (!intent) {
      throw new Error(`working RCNA row ${index + 1} has no approved 834 intent for code ${code || '<blank>'}`);
    }
    return intent;
  }

  #groupRows(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      const subscriberSsn = required(
        row.record[row.columns.SUBSCRIBER_SSN],
        `row ${row.sourceRow} subscriber SSN`,
      );
      const group = groups.get(subscriberSsn) ?? [];
      group.push(row);
      groups.set(subscriberSsn, group);
    });

    return [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([subscriberSsn, group]) => {
        const subscribers = group.filter(({ record, columns }) => (
          normalized(record[columns.MEMBER_SSN]) === normalized(subscriberSsn)
        ));
        const dependents = group
          .filter(({ record, columns }) => (
            normalized(record[columns.MEMBER_SSN]) !== normalized(subscriberSsn)
          ))
          .sort((left, right) => (
            normalized(left.record[left.columns.MEMBER_SSN])
              .localeCompare(normalized(right.record[right.columns.MEMBER_SSN]))
          ));
        return { subscribers, dependents };
      });
  }

  #n1(entityCode, entity, name) {
    if (!entity || typeof entity !== 'object') {
      throw new Error(`${name} configuration is required`);
    }
    return [
      'N1',
      entityCode,
      required(entity.name, `${name}.name`),
      required(entity.idQualifier, `${name}.idQualifier`),
      required(entity.id, `${name}.id`),
    ];
  }

  #memberSegments({
    record, columns, sourceRow, intent,
  }) {
    const subscriber = normalized(record[columns.MEMBER_SSN])
      === normalized(record[columns.SUBSCRIBER_SSN]);
    const relationship = subscriber
      ? '18'
      : this.relationshipMap[normalized(record[columns.RELATIONSHIP])]
        ?? normalized(record[columns.RELATIONSHIP]);

    const maintenanceType = required(intent.maintenanceType, 'maintenanceType');
    const maintenanceReason = required(intent.maintenanceReason, 'maintenanceReason');
    const benefitStatus = required(intent.benefitStatus, 'benefitStatus');
    // Member SSN, relationship, city, gender, dates, and phone are optional; the
    // subscriber SSN is guaranteed by the required-field skip gate.
    const memberSsn = stringValue(record[columns.MEMBER_SSN]).trim();
    const subscriberSsn = required(record[columns.SUBSCRIBER_SSN], `row ${sourceRow} subscriber SSN`);
    const safe = (value) => sanitizeValue(value, this.reservedDelimiters);
    // Envelope and intent values are configuration, not row data, so they still fail fast.
    const strict = (value, field) => assertSafeValue(value, this.reservedDelimiters, field);

    const address = this.#address(record, columns);
    const segments = [
      ['INS', subscriber ? 'Y' : 'N', safe(relationship), maintenanceType, maintenanceReason, benefitStatus],
      ['REF', '0F', safe(subscriberSsn)],
      ['REF', '1L', strict(required(this.envelope.groupNumber, 'groupNumber'), 'group number')],
    ];

    if (record[columns.SUBSCRIBER_ID]) {
      segments.push(['REF', '23', safe(record[columns.SUBSCRIBER_ID])]);
    }
    if (this.envelope.subgroupNumber) {
      segments.push(['REF', 'DX', strict(this.envelope.subgroupNumber, 'subgroup number')]);
    }
    if (this.envelope.regionCode) {
      segments.push(['REF', 'ZZ', strict(this.envelope.regionCode, 'region code')]);
    }

    // NM108 and NM109 are sent together, and only when a member SSN is present.
    const nm109 = safe(memberSsn);
    segments.push([
      'NM1',
      'IL',
      '1',
      safe(required(record[columns.LAST_NAME], `row ${sourceRow} last name`)),
      safe(record[columns.FIRST_NAME]),
      '',
      '',
      '',
      nm109 ? '34' : '',
      nm109,
    ]);

    const phone = stringValue(record[columns.PHONE]).replace(/\D/g, '');
    if (phone.length === 10) {
      segments.push(['PER', 'IP', '', 'TE', phone]);
    }
    if (address.line1) {
      segments.push(['N3', safe(address.line1), safe(address.line2)]);
    }
    const city = safe(record[columns.CITY]);
    const state = safe(record[columns.STATE]);
    const zip = safe(record[columns.ZIP]);
    const country = safe(record[columns.COUNTRY]);
    if (city || state || zip || country) {
      segments.push(['N4', city, state, zip, country]);
    }
    const birthDate = optionalDate(record[columns.BIRTH_DATE]);
    const gender = safe(record[columns.GENDER]).trim();
    if (birthDate || gender) {
      segments.push(['DMG', birthDate ? 'D8' : '', birthDate, gender]);
    }

    const coverageLevel = subscriber ? stringValue(intent.coverageLevel) : '';
    segments.push([
      'HD',
      maintenanceType,
      '',
      'HMO',
      safe(record[columns.PLAN_CODE]),
      strict(coverageLevel, 'coverage level'),
    ]);
    const startDate = optionalDate(record[columns.START_DATE]);
    if (startDate) {
      segments.push(['DTP', '348', 'D8', startDate]);
    }
    const endDate = optionalDate(record[columns.END_DATE]);
    if (endDate) {
      segments.push(['DTP', '349', 'D8', endDate]);
    }
    return segments;
  }

  #address(record, columns) {
    const line1 = stringValue(record[columns.ADDRESS_1]);
    const line2 = stringValue(record[columns.ADDRESS_2]);
    const line3 = stringValue(record[columns.ADDRESS_3]);
    // Address line 3 has no 834 destination. Without a handler it is omitted, never rejected.
    if (line3.trim() && typeof this.addressLine3Handler === 'function') {
      const result = this.addressLine3Handler({ line1, line2, line3 });
      if (!result || typeof result !== 'object') {
        throw new Error('addressLine3Handler must return an object with line1 and line2');
      }
      return { line1: stringValue(result.line1), line2: stringValue(result.line2) };
    }
    return { line1, line2 };
  }

  #isa(now, controlNumber) {
    const usage = required(this.envelope.usageIndicator, 'usageIndicator');
    if (!['P', 'T'].includes(usage)) {
      throw new Error('usageIndicator must be P or T');
    }
    const senderQualifier = required(this.envelope.senderQualifier, 'senderQualifier');
    const receiverQualifier = required(this.envelope.receiverQualifier, 'receiverQualifier');
    if (senderQualifier.length !== 2 || receiverQualifier.length !== 2) {
      throw new Error('ISA sender and receiver qualifiers must contain exactly 2 characters');
    }

    const isa = [
      'ISA',
      '00',
      '          ',
      '00',
      '          ',
      senderQualifier,
      pad(this.envelope.senderId, 15, 'senderId'),
      receiverQualifier,
      pad(this.envelope.receiverId, 15, 'receiverId'),
      formatRuntimeDate(now).slice(2),
      formatRuntimeTime(now, false),
      this.repetitionSeparator,
      '00501',
      controlNumber,
      this.envelope.acknowledgmentRequested ?? '0',
      usage,
      this.componentSeparator,
    ].join(this.elementSeparator);

    if (isa.length !== 105) {
      throw new Error(`ISA segment must contain exactly 105 characters before its terminator; received ${isa.length}`);
    }
    return isa;
  }
}

