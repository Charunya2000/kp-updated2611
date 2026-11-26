import {
  formatNoticeCodeDisplay,
  formatPriorityDisplay,
} from './rcnoaDecisionDisplay.js';

const RCNO_COLUMN_COUNT = 73;
const WORKING_RCNA_COLUMN_COUNT = 78;

const RCNO = Object.freeze({
  RESULT: 3,
  MENR_MEMBER_ID: 5,
  MEMBER_ID_RESULT: 6,
  PSHBS_ANNUITANT: 7,
  ANNUITANT_RESULT: 9,
  PSHBS_LAST_NAME: 10,
  MENR_LAST_NAME: 11,
  LAST_NAME_RESULT: 12,
  PSHBS_FIRST_NAME: 13,
  MENR_FIRST_NAME: 14,
  FIRST_NAME_RESULT: 15,
  PSHBS_BIRTH_DATE: 16,
  BIRTH_DATE_RESULT: 18,
  PSHBS_MEMBER_SSN: 19,
  MENR_MEMBER_SSN: 20,
  MEMBER_SSN_RESULT: 21,
  PSHBS_SUBSCRIBER_SSN: 22,
  SUBSCRIBER_SSN_RESULT: 24,
  PSHBS_PLAN_CODE: 25,
  PLAN_CODE_RESULT: 27,
  PSHBS_START_DATE: 28,
  MENR_START_DATE: 29,
  START_DATE_RESULT: 30,
  PSHBS_END_DATE: 31,
  MENR_END_DATE: 32,
  END_DATE_RESULT: 33,
  PSHBS_PAYROLL_OFFICE: 61,
  PAYROLL_OFFICE_RESULT: 63,
  PSHBS_RELATIONSHIP: 64,
  RELATIONSHIP_RESULT: 66,
  PSHBS_GENDER: 70,
  GENDER_RESULT: 72,
});

const MEMBERSHIP = Object.freeze({
  MRN: 0,
  START_DATE: 1,
  END_DATE: 2,
  FIRST_NAME: 3,
  LAST_NAME: 4,
  MEMBER_SSN: 5,
  GENDER: 6,
  RELATIONSHIP: 7,
  PLAN_CODE: 8,
  ANNUITANT: 9,
  PAYROLL_OFFICE: 10,
  MEMBER_DECEASED: 11,
  SUBSCRIBER_DECEASED: 12,
  MEMBER_AGE: 13,
  NOT_DISABLED: 14,
  SUBSCRIBER_SSN: 15,
  EXCEPTION_FLAG: 16,
  BIRTH_DATE: 17,
  DECEASED_DATE: 18,
});

const RECENT_834 = Object.freeze({
  SSN: 0,
  START_DATE: 1,
  END_DATE: 2,
  PROCESSED: 3,
});

const DEMOGRAPHIC_RESULT_COLUMNS = Object.freeze([
  6, 9, 12, 15, 18, 21, 24, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72,
]);

const ADDRESS_RESULT_COLUMNS = Object.freeze([36, 39, 42, 45, 48, 51, 54]);

const RULE_CATALOG = Object.freeze({
  F: [
    ['F1300', 'Ended PSHBS coverage exactly matches membership'],
    ['F2400', 'Ended PSHBS coverage differs and no recent 834 matches'],
    ['F3500', 'Ended PSHBS coverage differs and a recent 834 matches'],
    ['F4600', 'Active subscriber membership is deceased'],
    ['F5700', 'Active member membership is deceased'],
    ['F6800', 'Active over-age non-spouse member is not disabled'],
    ['F7000', 'Active over-age spouse creates an invalid scenario'],
    ['F8000', 'Coverage end differs only by an approved extension'],
    ['F9000', 'Coverage ends at the approved age-26 extension'],
    ['F10000', 'Active membership coverage differs without a pending 834'],
    ['F11000', 'Active membership coverage differs with a pending 834'],
    ['F12000', 'Active membership coverage dates match'],
    ['F13000', 'Membership is absent and a processed recent 834 exists'],
    ['F14000', 'Membership is absent and an unprocessed recent 834 exists'],
    ['F20000', 'Membership and recent 834 evidence are absent'],
  ],
  I: [
    ['I1000', 'Membership ended and MENR coverage ends at year-end'],
    ['I2000', 'MENR coverage is active or open and no recent 834 matches'],
    ['I3000', 'Membership exists and no cancellation transaction matches'],
    ['I4000', 'Processed recent 834 and active membership coverage exist'],
    ['I5000', 'Processed recent 834 exists without active membership coverage'],
    ['I6000', 'Unprocessed recent 834 and active membership coverage exist'],
    ['I7000', 'Unprocessed recent 834 exists without active membership coverage'],
  ],
  N: [
    ['N0000', 'No membership row matches MENR member ID/MRN'],
    ['N1000', 'Membership annuitant differs or is blank'],
    ['N2000', 'Membership payroll office differs or is blank'],
    ['N3000', 'Membership relationship differs or is blank'],
    ['N4000', 'Last name differs and partial or approved exception matching applies'],
    ['N5000', 'First name differs and partial or approved exception matching applies'],
    ['N4000-1', 'Last name differs without the partial-match exception'],
    ['N5000-1', 'First name differs without the partial-match exception'],
    ['N5000-2', 'Membership deceased date is populated'],
    ['N6000', 'Dependent member SSN differs and PSHBS member SSN is invalid'],
    ['N7000', 'Subscriber SSN differs and PSHBS subscriber SSN is invalid'],
    ['N8000', 'Dependent member SSN differs and PSHBS member SSN is valid'],
    ['N9000', 'Subscriber SSN differs and PSHBS subscriber SSN is valid'],
    ['N91000', 'Standardized membership and PSHBS addresses match'],
    ['N92000', 'Standardized membership and PSHBS addresses differ'],
    ['N10000', 'Gender differs and PSHBS gender is blank or unknown'],
    ['N11000', 'Gender differs and PSHBS gender is known'],
    ['N12000', 'Plan or coverage mismatch requires manual review'],
    ['N13000', 'Plan or coverage mismatch requires enrollment processing'],
    ['N14000', 'Coverage end differs only by an approved extension'],
    ['N15000', 'Birth date differs and the OPM correction condition applies'],
    ['N16000', 'Birth date differs and carrier correction applies'],
  ],
  catchAll: [
    ['AE-1', 'Active enrollment mismatch'],
    ['AC-2', 'Active carrier enrollment mismatch'],
    ['DM-3', 'Active demographic mismatch'],
    ['CE-4', 'Cancelled enrollment mismatch'],
    ['No_rule99999', 'No earlier rule applies'],
  ],
});

function stringValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function normalized(value) {
  return stringValue(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .toUpperCase();
}

function valuesEqual(left, right) {
  return normalized(left) === normalized(right);
}

function normalizedMrn(value) {
  const normalizedValue = normalized(value);
  if (!/^\d+$/.test(normalizedValue)) return normalizedValue;
  return normalizedValue.replace(/^0+(?=\d)/, '');
}

function isPopulated(value) {
  return normalized(value) !== '';
}

function parseDate(value, fieldName) {
  const text = normalized(value);
  if (!/^\d{8}$/.test(text)) {
    throw new Error(`${fieldName} must use YYYYMMDD format`);
  }

  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(4, 6));
  const day = Number(text.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} is not a valid date`);
  }

  return date;
}

function formatDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');
}

function compareDates(left, right, leftName, rightName) {
  return parseDate(left, leftName).getTime() - parseDate(right, rightName).getTime();
}

function addDays(value, days, fieldName) {
  const date = parseDate(value, fieldName);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function addYearsAndDays(value, years, days, fieldName) {
  const date = parseDate(value, fieldName);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function endOfYear(value) {
  const date = parseDate(value, 'date');
  return `${date.getUTCFullYear()}1231`;
}

function isDateInRange(value, start, end) {
  if (!isPopulated(start) || !isPopulated(end)) {
    return false;
  }

  return compareDates(value, start, 'business date', 'coverage start') >= 0
    && compareDates(value, end, 'business date', 'coverage end') <= 0;
}

function validSsn(value) {
  const ssn = normalized(value);
  return /^\d{9}$/.test(ssn) && ssn !== '000000000' && ssn !== '999999999';
}

function requireRecordArray(records, name) {
  if (!Array.isArray(records)) {
    throw new TypeError(`${name} must be an array`);
  }
}

function ambiguityError(message) {
  const error = new Error(message);
  error.code = 'AMBIGUOUS_LOOKUP_DUPLICATE';
  return error;
}

function canonicalRecord(record) {
  return record.map(normalized).join('\u001f');
}

function deduplicateRecords(records, keysForRecord, name, validateConflicts) {
  const seenKeys = new Map();
  const seenRecords = new Set();
  return records.filter((record) => {
    const canonical = canonicalRecord(record);
    for (const key of keysForRecord(record)) {
      const existing = seenKeys.get(key);
      if (validateConflicts && existing && existing !== canonical) {
        throw ambiguityError(`Conflicting duplicate ${name} candidates found`);
      }
      seenKeys.set(key, canonical);
    }
    if (seenRecords.has(canonical)) return false;
    seenRecords.add(canonical);
    return true;
  });
}

function deduplicateMembershipRecords(records, validateConflicts) {
  return deduplicateRecords(records, (record) => {
    const keys = [];
    const enrollment = [
      record[MEMBERSHIP.PLAN_CODE],
      record[MEMBERSHIP.START_DATE],
      record[MEMBERSHIP.END_DATE],
    ].map(normalized).join('|');
    if (isPopulated(record[MEMBERSHIP.MRN])) {
      keys.push(`MRN:${normalized(record[MEMBERSHIP.MRN])}|${enrollment}`);
    }
    const subscriberKey = [
      record[MEMBERSHIP.LAST_NAME],
      record[MEMBERSHIP.FIRST_NAME],
      record[MEMBERSHIP.SUBSCRIBER_SSN],
    ].map(normalized).join('|');
    if (subscriberKey !== '||') keys.push(`SUB:${subscriberKey}|${enrollment}`);
    return keys;
  }, 'membership', validateConflicts);
}

function deduplicateRecent834Records(records, validateConflicts) {
  return deduplicateRecords(records, (record) => [[
    record[RECENT_834.SSN],
    record[RECENT_834.START_DATE],
    record[RECENT_834.END_DATE],
  ].map(normalized).join('|')], 'recent enrollment', validateConflicts);
}

function validateWidth(record, expected, name, rowIndex, minimum = false) {
  if (!Array.isArray(record)) {
    throw new TypeError(`${name} row ${rowIndex + 1} must be an array`);
  }

  const valid = minimum ? record.length >= expected : record.length === expected;
  if (!valid) {
    const qualifier = minimum ? 'at least' : 'exactly';
    throw new Error(`${name} row ${rowIndex + 1} must contain ${qualifier} ${expected} columns`);
  }
}

function recent834Key(ssn, startDate, endDate) {
  return [ssn, startDate, endDate].map(normalized).join('\u001f');
}

function fMembershipKey(firstName, lastName, subscriberSsn) {
  return [firstName, lastName, subscriberSsn].map(normalized).join('\u001f');
}

function priorRcnaPrefixKey(record, length) {
  return record.slice(0, length).map(normalized).join('\u001f');
}

function pushToIndex(map, key, value) {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

function compareMembershipByCoverageEndDescending(left, right) {
  const leftEnd = normalized(left[MEMBERSHIP.END_DATE]);
  const rightEnd = normalized(right[MEMBERSHIP.END_DATE]);
  if (leftEnd === '' && rightEnd !== '') return 1;
  if (leftEnd !== '' && rightEnd === '') return -1;
  if (leftEnd !== rightEnd) return leftEnd > rightEnd ? -1 : 1;

  const leftCanonical = canonicalRecord(left);
  const rightCanonical = canonicalRecord(right);
  if (leftCanonical === rightCanonical) return 0;
  return leftCanonical < rightCanonical ? -1 : 1;
}

export class RcnoToRcnaService {
  constructor({
    businessDate = formatDate(new Date()),
    n12Code = 'AE999',
    addressNormalizer,
    validateLookupDuplicates = String(
      process.env.RCNOA_VALIDATE_LOOKUP_DUPLICATES ?? 'false',
    ).trim().toLowerCase() === 'true',
    reusePriorRcnaDecisions = String(
      process.env.RCNOA_REUSE_PRIOR_RCNA_DECISIONS ?? 'true',
    ).trim().toLowerCase() !== 'false',
  } = {}) {
    parseDate(businessDate, 'businessDate');
    this.businessDate = businessDate;
    this.n12Code = n12Code;
    this.addressNormalizer = addressNormalizer;
    this.validateLookupDuplicates = validateLookupDuplicates;
    this.reusePriorRcnaDecisions = reusePriorRcnaDecisions;
  }

  transform({
    rcnoRecords,
    membershipRecords = [],
    recent834Records = [],
    priorRcnaRecords = [],
    trace = false,
  }) {
    requireRecordArray(rcnoRecords, 'rcnoRecords');
    rcnoRecords.forEach((record, index) => validateWidth(record, RCNO_COLUMN_COUNT, 'RCNO', index));

    const prepared = RcnoToRcnaService.prepareReferenceData({
      membershipRecords,
      recent834Records,
      priorRcnaRecords,
      validateLookupDuplicates: this.validateLookupDuplicates,
    });

    const workingRecords = [];
    const outboundRecords = [];
    const audit = [];
    const traces = [];

    rcnoRecords.forEach((sourceRecord, rowIndex) => {
      const {
        workingRecord, outboundRecord, auditEntry, rowTrace,
      } = this.#transformOneInternal(sourceRecord, prepared, rowIndex, trace);
      workingRecords.push(workingRecord);
      outboundRecords.push(outboundRecord);
      audit.push(auditEntry);
      if (rowTrace) traces.push(rowTrace);
    });

    const result = { workingRecords, outboundRecords, audit };
    if (trace) result.traces = traces;
    return result;
  }

  // Transforms a single RCNO row against reference data that was already prepared
  // once via prepareReferenceData(). Intended for callers (such as a worker-thread
  // row coordinator) that isolate one row per call instead of looping internally.
  transformOne({
    rcnoRecord, prepared, sourceRowNumber = 1, trace = false,
  }) {
    if (!prepared || typeof prepared !== 'object') {
      throw new TypeError('prepared reference data is required');
    }
    const rowIndex = sourceRowNumber - 1;
    validateWidth(rcnoRecord, RCNO_COLUMN_COUNT, 'RCNO', rowIndex);
    const {
      workingRecord, outboundRecord, auditEntry, rowTrace,
    } = this.#transformOneInternal(rcnoRecord, prepared, rowIndex, trace);
    const result = { workingRecord, outboundRecord, audit: auditEntry };
    if (trace) result.trace = rowTrace;
    return result;
  }

  // Normalizes and indexes membership/recent834/priorRcna reference data exactly
  // once for an entire run. Building composite-key Maps here (instead of remapping
  // and re-filtering the full arrays for every RCNO row) removes the per-row
  // allocation churn that previously caused GC pressure on large recordsets.
  static prepareReferenceData({
    membershipRecords = [],
    recent834Records = [],
    priorRcnaRecords = [],
    validateLookupDuplicates = false,
  } = {}) {
    requireRecordArray(membershipRecords, 'membershipRecords');
    requireRecordArray(recent834Records, 'recent834Records');
    requireRecordArray(priorRcnaRecords, 'priorRcnaRecords');

    membershipRecords.forEach((record, index) => validateWidth(
      record,
      19,
      'membership',
      index,
      true,
    ));
    recent834Records.forEach((record, index) => validateWidth(
      record,
      4,
      'recent 834',
      index,
    ));
    priorRcnaRecords.forEach((record, index) => validateWidth(
      record,
      WORKING_RCNA_COLUMN_COUNT,
      'prior RCNA',
      index,
    ));

    const deterministicMembershipRecords = deduplicateMembershipRecords(
      membershipRecords,
      validateLookupDuplicates,
    );
    const deterministicRecent834Records = deduplicateRecent834Records(
      recent834Records,
      validateLookupDuplicates,
    );

    const membership = deterministicMembershipRecords.map((item) => item.map(stringValue));
    const recent834 = deterministicRecent834Records.map((item) => item.map(stringValue));
    const priorRcna = priorRcnaRecords.map((item) => item.map(stringValue));

    const membershipBySubscriberKey = new Map();
    const membershipByMrnIndex = new Map();
    membership.forEach((item) => {
      pushToIndex(
        membershipBySubscriberKey,
        fMembershipKey(
          item[MEMBERSHIP.FIRST_NAME],
          item[MEMBERSHIP.LAST_NAME],
          item[MEMBERSHIP.SUBSCRIBER_SSN],
        ),
        item,
      );
      const mrnKey = normalizedMrn(item[MEMBERSHIP.MRN]);
      if (mrnKey !== '') pushToIndex(membershipByMrnIndex, mrnKey, item);
    });
    membershipByMrnIndex.forEach((matches) => {
      matches.sort(compareMembershipByCoverageEndDescending);
    });

    const recent834ByKey = new Map();
    recent834.forEach((item) => {
      pushToIndex(
        recent834ByKey,
        recent834Key(item[RECENT_834.SSN], item[RECENT_834.START_DATE], item[RECENT_834.END_DATE]),
        item,
      );
    });

    const priorRcnaByExactPrefix = new Map();
    priorRcna.forEach((item) => {
      pushToIndex(priorRcnaByExactPrefix, priorRcnaPrefixKey(item, RCNO_COLUMN_COUNT), item);
    });

    return {
      membership,
      recent834,
      priorRcna,
      membershipBySubscriberKey,
      membershipByMrnIndex,
      recent834ByKey,
      priorRcnaByExactPrefix,
    };
  }

  #transformOneInternal(sourceRecord, prepared, rowIndex, trace) {
    const record = sourceRecord.map(stringValue);
    const context = this.#createContext(record, prepared, rowIndex);
    if (trace) {
      context.trace = {
        sourceRow: rowIndex + 1,
        businessDate: this.businessDate,
        family: context.family,
        selectedRuleId: null,
        evaluations: [],
      };
    }
    const decision = this.#evaluate(context);
    if (context.trace) {
      context.trace.selectedRuleId = decision.ruleId;
      if (!context.trace.evaluations.some((evaluation) => evaluation.outcome === 'selected')) {
        this.#completeRuleTrace(context, decision);
      }
    }
    const workingRecord = [
      ...record,
      formatPriorityDisplay(decision.priority),
      formatNoticeCodeDisplay(decision.code),
      decision.description,
      decision.notes ?? '',
      String(decision.agingMonths),
    ];

    validateWidth(workingRecord, WORKING_RCNA_COLUMN_COUNT, 'working RCNA', rowIndex);

    return {
      workingRecord,
      outboundRecord: [...workingRecord],
      auditEntry: {
        sourceRow: rowIndex + 1,
        ruleId: decision.ruleId,
        ...(decision.contributingRuleIds
          ? { contributingRuleIds: decision.contributingRuleIds }
          : {}),
        ...(decision.canonicalCodes ? { canonicalCodes: decision.canonicalCodes } : {}),
        membershipMatchCount: context.membershipMatches.length,
        recent834MatchCount: context.recent834Matches.length,
      },
      rowTrace: context.trace,
    };
  }

  #createContext(record, prepared, rowIndex) {
    const result = normalized(record[RCNO.RESULT]);
    const memberIdResult = normalized(record[RCNO.MEMBER_ID_RESULT]);
    const membershipBySubscriber = prepared.membershipBySubscriberKey.get(
      fMembershipKey(
        record[RCNO.PSHBS_FIRST_NAME],
        record[RCNO.PSHBS_LAST_NAME],
        record[RCNO.PSHBS_SUBSCRIBER_SSN],
      ),
    ) || [];
    const mrnKey = normalizedMrn(record[RCNO.MENR_MEMBER_ID]);
    const membershipByMrn = mrnKey === '' ? [] : (prepared.membershipByMrnIndex.get(mrnKey) || []);
    const membershipMatches = result === 'F' ? membershipBySubscriber : membershipByMrn;
    const recent834Matches = prepared.recent834ByKey.get(
      recent834Key(
        record[RCNO.PSHBS_SUBSCRIBER_SSN],
        record[RCNO.PSHBS_START_DATE],
        record[RCNO.PSHBS_END_DATE],
      ),
    ) || [];

    return {
      record,
      prepared,
      sourceRow: rowIndex + 1,
      membership: prepared.membership,
      recent834: prepared.recent834,
      priorRcna: prepared.priorRcna,
      membershipMatches,
      membershipByMrn,
      recent834Matches,
      result,
      memberIdResult,
      family: ['F', 'I'].includes(result)
        ? result
        : memberIdResult === 'N'
        ? 'N'
        : 'default',
    };
  }

  #decision(ruleId, priority, code, description, agingMonths = 0, notes = '') {
    return { ruleId, priority, code, description, agingMonths, notes };
  }

  #aggregateDecisions(decisions) {
    const contributingRuleIds = decisions.map(({ ruleId }) => ruleId);
    const canonicalCodes = decisions.map(({ code }) => code);
    const descriptions = decisions.map(({ description }) => description);
    return {
      ...this.#decision(
        contributingRuleIds.join('/'),
        3,
        canonicalCodes.join('/'),
        descriptions.join('/'),
      ),
      contributingRuleIds,
      canonicalCodes,
    };
  }

  #completeRuleTrace(context, decision) {
    const familyCatalog = RULE_CATALOG[context.family] || [];
    const catchAllSelected = RULE_CATALOG.catchAll.some(([ruleId]) => ruleId === decision.ruleId);
    const catalog = catchAllSelected
      ? [...familyCatalog, ...RULE_CATALOG.catchAll]
      : familyCatalog;
    const selectedIndex = catalog.findIndex(([ruleId]) => ruleId === decision.ruleId);
    const evaluatedRules = selectedIndex >= 0
      ? catalog.slice(0, selectedIndex + 1)
      : [[decision.ruleId, decision.description]];

    evaluatedRules.forEach(([ruleId, condition]) => {
      const selected = ruleId === decision.ruleId;
      context.trace.evaluations.push({
        order: context.trace.evaluations.length + 1,
        ruleId,
        family: RULE_CATALOG.catchAll.some(([id]) => id === ruleId) ? 'catch-all' : context.trace.family,
        outcome: selected ? 'selected' : 'failed',
        condition,
        predicates: [{
          name: 'governingConditionSatisfied',
          left: {
            sourceResult: context.record[RCNO.RESULT],
            membershipCandidateCount: context.membership.length,
            membershipMatchCount: context.membershipMatches.length,
            membershipMrnMatchCount: context.membershipByMrn.length,
            recent834CandidateCount: context.recent834.length,
            recent834MatchCount: context.recent834Matches.length,
          },
          operator: 'satisfies ordered rule condition',
          right: { ruleId, condition },
          normalization: ['comparison normalization defined by the rule implementation'],
          result: selected,
        }],
        reason: selected
          ? decision.description
          : `Rule ${ruleId} did not satisfy its governing condition`,
      });
    });
  }

  #evaluate(context) {
    const { record, result } = context;
    if (result === 'M') {
      context.trace?.evaluations.push({
        order: 1,
        ruleId: 'A100',
        family: 'match',
        outcome: 'selected',
        condition: 'RCNO overall result equals M',
        predicates: [{
          name: 'overallResultIsMatch',
          left: { field: 'RCNO_Subscriber_ID_Result', value: record[RCNO.RESULT] },
          operator: 'equals',
          right: { value: 'M' },
          normalization: ['remove control characters', 'trim', 'uppercase'],
          result: true,
        }],
        reason: 'The normalized RCNO overall result is M',
      });
      return this.#decision('A100', 5, 'MM', 'Matches (no action required)');
    }

    context.trace?.evaluations.push({
      order: 1,
      ruleId: 'A100',
      family: 'match',
      outcome: 'failed',
      condition: 'RCNO overall result equals M',
      predicates: [{
        name: 'overallResultIsMatch',
        left: { field: 'RCNO_Subscriber_ID_Result', value: record[RCNO.RESULT] },
        operator: 'equals',
        right: { value: 'M' },
        normalization: ['remove control characters', 'trim', 'uppercase'],
        result: false,
      }],
      reason: `The normalized RCNO overall result is ${result || 'blank'}`,
    });

    const matchingPriorRecords = this.reusePriorRcnaDecisions
      ? (context.prepared.priorRcnaByExactPrefix.get(priorRcnaPrefixKey(record, RCNO_COLUMN_COUNT)) || [])
      : [];
    const prior = matchingPriorRecords[0];
    if (prior) {
      const priorAging = normalized(prior[77]);
      if (!/^\d+$/.test(priorAging)) {
        throw new Error('Rule B200 requires prior Aging Months to be a nonnegative integer');
      }
      context.trace?.evaluations.push({
        order: 2,
        ruleId: 'B200',
        family: 'prior-decision',
        outcome: 'selected',
        condition: 'Current RCNO columns 1-73 match a prior RCNA record',
        predicates: [{
          name: 'exactPriorRcnaMatch',
          left: { fieldSet: 'current RCNO columns 1-73' },
          operator: 'equals after comparison normalization',
          right: {
            fieldSet: 'prior RCNA columns 1-73',
            candidateCount: context.priorRcna.length,
            matchingCandidateCount: matchingPriorRecords.length,
          },
          normalization: ['remove control characters', 'normalize spaces', 'trim', 'uppercase'],
          result: true,
        }],
        reason: `A prior decision matched; aging months increment from ${priorAging} to ${Number(priorAging) + 1}`,
      });
      return this.#decision(
        'B200',
        prior[73],
        prior[74],
        prior[75],
        Number(priorAging) + 1,
      );
    }
    context.trace?.evaluations.push({
      order: 2,
      ruleId: 'B200',
      family: 'prior-decision',
      outcome: 'failed',
      condition: 'Current RCNO columns 1-73 match a prior RCNA record',
      predicates: [{
        name: 'exactPriorRcnaMatch',
        left: { fieldSet: 'current RCNO columns 1-73' },
        operator: 'equals after comparison normalization',
        right: {
          fieldSet: 'prior RCNA columns 1-73',
          candidateCount: context.priorRcna.length,
          matchingCandidateCount: 0,
        },
        normalization: ['remove control characters', 'normalize spaces', 'trim', 'uppercase'],
        result: false,
      }],
      reason: !this.reusePriorRcnaDecisions
        ? 'Prior RCNA decision reuse is disabled'
        : context.priorRcna.length === 0
        ? 'No prior RCNA candidates were supplied'
        : 'No prior RCNA candidate matched all 73 source fields',
    });
    if (result === 'F') {
      return this.#resolveWithCatchAll(context, this.#evaluateF(context));
    }
    if (result === 'I') {
      return this.#resolveWithCatchAll(context, this.#evaluateI(context));
    }
    if (context.memberIdResult === 'N') {
      return this.#resolveWithCatchAll(context, this.#evaluateN(context));
    }

    return this.#catchAllOrDefault(context);
  }

  // A specific F/I/N rule and a catch-all rule (AE-1/AC-2/DM-3/CE-4) can both be
  // satisfied by the same row. Stakeholder precedence is 1 > 2 > 4 > 3 > 5;
  // a tie keeps the
  // already-selected specific rule. Every overlap is logged for debugging so it
  // is auditable which rule fired, at what priority, and for which RCNO row.
  #resolveWithCatchAll(context, specificDecision) {
    const specificIsCatchAllOrDefault = RULE_CATALOG.catchAll
      .some(([ruleId]) => ruleId === specificDecision.ruleId);
    if (specificIsCatchAllOrDefault) {
      // No specific F/I/N rule matched; #evaluateF/I/N already fell back to
      // #catchAllOrDefault, so there is nothing else to compare against.
      return specificDecision;
    }

    const catchAllDecision = this.#evaluateCatchAllConditions(context);
    if (!catchAllDecision) {
      return specificDecision;
    }

    const precedence = new Map([['1', 0], ['2', 1], ['4', 2], ['3', 3], ['5', 4]]);
    const specificRank = precedence.get(String(specificDecision.priority)) ?? Number.MAX_SAFE_INTEGER;
    const catchAllRank = precedence.get(String(catchAllDecision.priority)) ?? Number.MAX_SAFE_INTEGER;
    const finalDecision = catchAllRank < specificRank ? catchAllDecision : specificDecision;

    this.#logCatchAllOverlap(context, specificDecision, catchAllDecision, finalDecision);

    return finalDecision;
  }

  #logCatchAllOverlap(context, specificDecision, catchAllDecision, finalDecision) {
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'rcnoCatchAllOverlapDetected',
        detail: {
          sourceRow: context.sourceRow,
          specificRule: { ruleId: specificDecision.ruleId, priority: specificDecision.priority },
          catchAllRule: { ruleId: catchAllDecision.ruleId, priority: catchAllDecision.priority },
          selectedRuleId: finalDecision.ruleId,
          priorityDiffered: specificDecision.priority !== catchAllDecision.priority,
        },
      },
    }));
  }

  #evaluateF(context) {
    const { record, membershipMatches, recent834Matches } = context;
    const membership = membershipMatches[0];
    const start = record[RCNO.PSHBS_START_DATE];
    const end = record[RCNO.PSHBS_END_DATE];
    const endedRange = isPopulated(start)
      && isPopulated(end)
      && compareDates(end, start, 'PSHBS coverage end', 'PSHBS coverage start') <= 0;
    const activeRange = isPopulated(start)
      && isPopulated(end)
      && compareDates(end, start, 'PSHBS coverage end', 'PSHBS coverage start') > 0;
    const exactMembership = membership
      && valuesEqual(start, membership[MEMBERSHIP.START_DATE])
      && valuesEqual(end, membership[MEMBERSHIP.END_DATE]);
    const alignedMembership = exactMembership
      && valuesEqual(record[RCNO.PSHBS_LAST_NAME], membership[MEMBERSHIP.LAST_NAME])
      && valuesEqual(record[RCNO.PSHBS_FIRST_NAME], membership[MEMBERSHIP.FIRST_NAME])
      && valuesEqual(record[RCNO.PSHBS_SUBSCRIBER_SSN], membership[MEMBERSHIP.SUBSCRIBER_SSN]);
    const mismatchedMembership = membership && !exactMembership;
    const mismatchedSubscriberMembership = mismatchedMembership
      && (valuesEqual(membership[MEMBERSHIP.RELATIONSHIP], 'S')
        || valuesEqual(membership[MEMBERSHIP.RELATIONSHIP], '18'));
    // 10/08 business rule change (revised): F4600, F5700, F6800, F8000, F9000,
    // F11000, F12000, F13000, F14000 and F20000 require the PSHBS coverage end
    // date (RCNO column 32) to be populated and on/AFTER the current business
    // date (RCNO column 4 = "F" AND column 32 >= CURRENT_DATE). F10000 is not
    // part of that change and keeps its on/before CURRENT_DATE gate.
    const endOnOrAfterBusinessDate = isPopulated(end)
      && compareDates(end, this.businessDate, 'PSHBS coverage end', 'business date') >= 0;
    const endOnOrBeforeBusinessDate = isPopulated(end)
      && compareDates(end, this.businessDate, 'PSHBS coverage end', 'business date') <= 0;

    if (endedRange && alignedMembership) {
      return this.#decision('F1300', 4, 'CE502', 'Carrier data matches RCNO; no action');
    }
    if (endedRange && mismatchedSubscriberMembership && recent834Matches.length === 0) {
      return this.#decision('F2400', 4, 'CE001', 'OPM to send 834 cancellation');
    }
    if (endedRange && mismatchedSubscriberMembership && recent834Matches.length > 0) {
      return this.#decision('F3500', 4, 'CE500', 'Carrier to investigate and reprocess the 834');
    }

    if (
      activeRange
      && endOnOrAfterBusinessDate
      && membership
      && valuesEqual(membership[MEMBERSHIP.SUBSCRIBER_DECEASED], 'Y')
    ) {
      return this.#decision('F4600', 1, 'AE002', 'OPM to match ended coverage');
    }
    if (
      activeRange
      && endOnOrAfterBusinessDate
      && membership
      && valuesEqual(membership[MEMBERSHIP.MEMBER_DECEASED], 'Y')
    ) {
      return this.#decision('F5700', 1, 'AE003', 'OPM to terminate member coverage (and adjust enrollment type, if necessary)');
    }
    if (
      activeRange
      && endOnOrAfterBusinessDate
      && membership
      && !valuesEqual(membership[MEMBERSHIP.MEMBER_DECEASED], 'Y')
      && !valuesEqual(membership[MEMBERSHIP.RELATIONSHIP], '1')
      && Number(membership[MEMBERSHIP.MEMBER_AGE]) > 26
      && valuesEqual(membership[MEMBERSHIP.NOT_DISABLED], 'Y')
    ) {
      return this.#decision('F6800', 1, 'AE004', 'OPM to investigate missing 834 or age-out handling');
    }
    if (
      activeRange
      && membership
      && !valuesEqual(membership[MEMBERSHIP.MEMBER_DECEASED], 'Y')
      && valuesEqual(membership[MEMBERSHIP.RELATIONSHIP], '1')
      && Number(membership[MEMBERSHIP.MEMBER_AGE]) > 26
    ) {
      return this.#decision('F7000', 1, 'Z0000', 'Invalid scenario');
    }

    if (
      activeRange
      && endOnOrAfterBusinessDate
      && membership
      && valuesEqual(start, membership[MEMBERSHIP.START_DATE])
    ) {
      const memberEnd = membership[MEMBERSHIP.END_DATE];
      const extensionMatch = valuesEqual(memberEnd, addDays(end, 31, 'PSHBS coverage end'))
        || (
          end === endOfYear(end)
          && compareDates(memberEnd, end, 'membership coverage end', 'PSHBS coverage end') > 0
        );
      if (!valuesEqual(end, memberEnd) && extensionMatch) {
        return this.#decision('F8000', 1, 'AE502', 'Carrier data matches RCNO; no action');
      }

      if (
        !valuesEqual(end, memberEnd)
        && isPopulated(membership[MEMBERSHIP.BIRTH_DATE])
        && valuesEqual(
          memberEnd,
          addYearsAndDays(membership[MEMBERSHIP.BIRTH_DATE], 26, 31, 'membership birth date'),
        )
      ) {
        return this.#decision('F9000', 1, 'AE504', 'No action required');
      }
    }

    const unprocessed834 = recent834Matches.some((item) => (
      valuesEqual(item[RECENT_834.PROCESSED], 'N')
    ));
    if (activeRange && endOnOrBeforeBusinessDate && membership && mismatchedMembership && !unprocessed834) {
      return this.#decision('F10000', 4, 'CE002', 'OPM to correct match');
    }
    if (activeRange && endOnOrAfterBusinessDate && membership && mismatchedMembership && unprocessed834) {
      return this.#decision('F11000', 1, 'AE001', 'OPM to correct the coverage start date');
    }
    if (activeRange && endOnOrAfterBusinessDate && exactMembership) {
      return this.#decision('F12000', 1, 'AE502', 'Carrier data matches RCNO; no action');
    }

    if (membershipMatches.length === 0 && endOnOrAfterBusinessDate) {
      if (recent834Matches.some((item) => valuesEqual(item[RECENT_834.PROCESSED], 'Y'))) {
        return this.#decision('F13000', 1, 'AE500', 'Carrier to investigate and reprocess the 834');
      }
      if (recent834Matches.some((item) => valuesEqual(item[RECENT_834.PROCESSED], 'N'))) {
        return this.#decision('F14000', 1, 'AE501', 'Carrier to process the 834 enrollment');
      }
      if (activeRange && recent834Matches.length === 0) {
        return this.#decision('F20000', 1, 'AE013', 'OPM to investigate why an 834 was not sent');
      }
    }

    return this.#catchAllOrDefault(context);
  }

  #evaluateI(context) {
    const { record, prepared, membershipByMrn: matches } = context;
    const member = matches[0];
    const start = record[RCNO.MENR_START_DATE];
    const end = record[RCNO.MENR_END_DATE];
    const matching834 = prepared.recent834ByKey.get(
      recent834Key(record[RCNO.PSHBS_SUBSCRIBER_SSN], start, end),
    ) || [];

    if (
      member
      && isPopulated(member[MEMBERSHIP.END_DATE])
      && compareDates(
        this.businessDate,
        member[MEMBERSHIP.END_DATE],
        'business date',
        'membership coverage end',
      ) > 0
      && isPopulated(end)
      && end === endOfYear(this.businessDate)
    ) {
      return this.#decision('I1000', 2, 'AC002', 'OPM to match ended coverage');
    }

    const menrActiveOrOpen = member && (
      !isPopulated(end)
      || compareDates(end, start, 'MENR coverage end', 'MENR coverage start') > 0
    );
    // 10/08 business rule change: I2000 additionally requires the MENR coverage
    // end date (RCNO column 33) to be populated and after the current business
    // date (RCNO column 4 = "I" AND column 33 > CURRENT_DATE).
    const menrEndAfterBusinessDate = isPopulated(end)
      && compareDates(end, this.businessDate, 'MENR coverage end', 'business date') > 0;
    if (menrActiveOrOpen && matching834.length === 0 && menrEndAfterBusinessDate) {
      return this.#decision('I2000', 2, 'AC004', 'No 834 termination or cancellation received');
    }
    if (member && !menrActiveOrOpen && matching834.length === 0) {
      return this.#decision('I3000', 4, 'CE001', 'OPM to send 834 cancellation');
    }

    const processed = matching834.some((item) => valuesEqual(item[RECENT_834.PROCESSED], 'Y'));
    const unprocessed = matching834.some((item) => valuesEqual(item[RECENT_834.PROCESSED], 'N'));
    const activeCoverageExists = member
      && isPopulated(member[MEMBERSHIP.START_DATE])
      && compareDates(
        member[MEMBERSHIP.START_DATE],
        this.businessDate,
        'membership coverage start',
        'business date',
      ) <= 0
      && (
        !isPopulated(member[MEMBERSHIP.END_DATE])
        || compareDates(
          member[MEMBERSHIP.END_DATE],
          this.businessDate,
          'membership coverage end',
          'business date',
        ) >= 0
      );

    if (processed) {
      if (activeCoverageExists) {
        return this.#decision('I4000', 2, 'AC500', 'Carrier to investigate and reprocess the 834');
      }
      return this.#decision('I5000', 4, 'CE500', 'Carrier to investigate and reprocess the 834');
    }

    if (unprocessed) {
      if (activeCoverageExists) {
        return this.#decision('I6000', 2, 'AC501', 'Cancellation or termination awaiting processing');
      }
      return this.#decision('I7000', 4, 'CE501', 'Carrier to process the 834 cancellation');
    }

    return this.#catchAllOrDefault(context);
  }

  #evaluateN(context) {
    const { record, membershipByMrn, prepared } = context;
    if (membershipByMrn.length === 0) {
      return this.#decision('N0000', 1, 'KICKO', 'MRN not found on an N record');
    }

    const member = membershipByMrn[0];
    // Revised 10/08 business rule change: N5000-2, N13000, N14000 and N12000 additionally
    // require the PSHBS coverage end date (RCNO column 32) to be populated and on/AFTER
    // the current business date (PSHBS coverage end >= CURRENT_DATE).
    const endOnOrAfterBusinessDate = isPopulated(record[RCNO.PSHBS_END_DATE])
      && compareDates(
        record[RCNO.PSHBS_END_DATE],
        this.businessDate,
        'PSHBS coverage end',
        'business date',
      ) >= 0;

    const planDiffers = !valuesEqual(member[MEMBERSHIP.PLAN_CODE], record[RCNO.PSHBS_PLAN_CODE]);
    const startDiffers = !valuesEqual(member[MEMBERSHIP.START_DATE], record[RCNO.PSHBS_START_DATE]);
    const endDiffers = !valuesEqual(member[MEMBERSHIP.END_DATE], record[RCNO.PSHBS_END_DATE]);
    const eligiblePlanDiffers = valuesEqual(record[RCNO.PLAN_CODE_RESULT], 'I') && planDiffers;
    const eligibleStartDiffers = valuesEqual(record[RCNO.START_DATE_RESULT], 'I') && startDiffers;
    const endResultIsInconsistent = valuesEqual(record[RCNO.END_DATE_RESULT], 'I');
    const eligibleEndDiffers = endResultIsInconsistent && endDiffers;
    const extension = isPopulated(record[RCNO.PSHBS_END_DATE]) && (
      valuesEqual(
        member[MEMBERSHIP.END_DATE],
        addDays(record[RCNO.PSHBS_END_DATE], 31, 'PSHBS coverage end'),
      )
      || (
        isPopulated(member[MEMBERSHIP.BIRTH_DATE])
        && valuesEqual(
          member[MEMBERSHIP.END_DATE],
          addYearsAndDays(member[MEMBERSHIP.BIRTH_DATE], 26, 31, 'membership birth date'),
        )
      )
    );
    const matching834 = (prepared.recent834ByKey.get(
      recent834Key(
        record[RCNO.PSHBS_SUBSCRIBER_SSN],
        record[RCNO.MENR_START_DATE],
        record[RCNO.MENR_END_DATE],
      ),
    ) || []).length > 0;
    const actionableCoverageMismatch = eligiblePlanDiffers
      || eligibleStartDiffers
      || (eligibleEndDiffers && !extension);
    const manualReview = actionableCoverageMismatch
      && isPopulated(record[RCNO.PSHBS_START_DATE])
      && isPopulated(member[MEMBERSHIP.START_DATE])
      && compareDates(
        record[RCNO.PSHBS_START_DATE],
        member[MEMBERSHIP.START_DATE],
        'PSHBS coverage start',
        'membership coverage start',
      ) > 0
      && !matching834;

    if (endOnOrAfterBusinessDate && actionableCoverageMismatch && !manualReview) {
      return this.#decision('N13000', 1, 'AE501', 'Carrier to process the 834 enrollment');
    }
    if (endOnOrAfterBusinessDate && !planDiffers && !startDiffers && eligibleEndDiffers && extension) {
      return this.#decision('N14000', 1, 'AE504', 'No action required');
    }
    if (endOnOrAfterBusinessDate && manualReview) {
      if (!isPopulated(this.n12Code)) {
        throw new Error('Rule N12000 requires an approved n12Code configuration value');
      }
      return this.#decision('N12000', 1, this.n12Code, 'Manual business review');
    }

    const mismatches = [];
    // N5000-2 is a Priority 3 rule: it is aggregated with the other Priority 3 mismatches
    // (catalog order 26, ahead of N1000) and no longer pre-empts the Priority 1 rules.
    if (endOnOrAfterBusinessDate && isPopulated(member[MEMBERSHIP.DECEASED_DATE])) {
      mismatches.push(this.#decision('N5000-2', 3, 'AE014', 'OPM to correct date of death and coverage end'));
    }
    if (
      valuesEqual(record[RCNO.ANNUITANT_RESULT], 'I')
      &&
      isPopulated(record[RCNO.PSHBS_ANNUITANT])
      && (
        !isPopulated(member[MEMBERSHIP.ANNUITANT])
        || !valuesEqual(member[MEMBERSHIP.ANNUITANT], record[RCNO.PSHBS_ANNUITANT])
      )
    ) {
      mismatches.push(this.#decision('N1000', 3, 'DM501', 'Carrier to update member field'));
    }
    if (
      valuesEqual(record[RCNO.PAYROLL_OFFICE_RESULT], 'I')
      &&
      isPopulated(record[RCNO.PSHBS_PAYROLL_OFFICE])
      && (
        !isPopulated(member[MEMBERSHIP.PAYROLL_OFFICE])
        || !valuesEqual(member[MEMBERSHIP.PAYROLL_OFFICE], record[RCNO.PSHBS_PAYROLL_OFFICE])
      )
    ) {
      mismatches.push(this.#decision('N2000', 3, 'DM508', 'Carrier to update member field'));
    }
    if (
      valuesEqual(record[RCNO.RELATIONSHIP_RESULT], 'I')
      &&
      isPopulated(record[RCNO.PSHBS_RELATIONSHIP])
      && (
        !isPopulated(member[MEMBERSHIP.RELATIONSHIP])
        || !valuesEqual(member[MEMBERSHIP.RELATIONSHIP], record[RCNO.PSHBS_RELATIONSHIP])
      )
    ) {
      mismatches.push(this.#decision('N3000', 3, 'DM509', 'Carrier to update member field'));
    }

    const lastNameDiffers = !valuesEqual(member[MEMBERSHIP.LAST_NAME], record[RCNO.PSHBS_LAST_NAME]);
    const firstNameDiffers = !valuesEqual(member[MEMBERSHIP.FIRST_NAME], record[RCNO.PSHBS_FIRST_NAME]);
    const nameException = valuesEqual(record[RCNO.PSHBS_LAST_NAME], 'NEWBORN')
      || valuesEqual(member[MEMBERSHIP.EXCEPTION_FLAG], 'Y');
    const partialLastName = normalized(member[MEMBERSHIP.LAST_NAME])
      .startsWith(normalized(record[RCNO.PSHBS_LAST_NAME]));
    const partialFirstName = normalized(member[MEMBERSHIP.FIRST_NAME])
      .startsWith(normalized(record[RCNO.PSHBS_FIRST_NAME]));

    const lastNameResultIsInconsistent = valuesEqual(record[RCNO.LAST_NAME_RESULT], 'I');
    const firstNameResultIsInconsistent = valuesEqual(record[RCNO.FIRST_NAME_RESULT], 'I');
    if (lastNameResultIsInconsistent && lastNameDiffers && (partialLastName || nameException)) {
      mismatches.push(this.#decision('N4000', 3, 'DM502', 'OPM to update member field'));
    } else if (lastNameResultIsInconsistent && lastNameDiffers) {
      mismatches.push(this.#decision('N4000-1', 3, 'DM001', 'OPM to update member field'));
    }
    if (firstNameResultIsInconsistent && firstNameDiffers && (partialFirstName || nameException)) {
      mismatches.push(this.#decision('N5000', 3, 'DM503', 'OPM to update member field'));
    } else if (firstNameResultIsInconsistent && firstNameDiffers) {
      mismatches.push(this.#decision('N5000-1', 3, 'DM002', 'OPM to update member field'));
    }

    const relationshipIsSubscriber = valuesEqual(member[MEMBERSHIP.RELATIONSHIP], 'S')
      || valuesEqual(member[MEMBERSHIP.RELATIONSHIP], '18');
    const memberSsnDiffers = !valuesEqual(
      member[MEMBERSHIP.MEMBER_SSN],
      record[RCNO.PSHBS_MEMBER_SSN],
    );
    const subscriberSsnDiffers = !valuesEqual(
      member[MEMBERSHIP.MEMBER_SSN],
      record[RCNO.PSHBS_SUBSCRIBER_SSN],
    );
    if (
      valuesEqual(record[RCNO.MEMBER_SSN_RESULT], 'I')
      &&
      !relationshipIsSubscriber
      && memberSsnDiffers
      && isPopulated(member[MEMBERSHIP.MEMBER_SSN])
      && !validSsn(record[RCNO.PSHBS_MEMBER_SSN])
    ) {
      mismatches.push(this.#decision('N6000', 3, 'DM003', 'OPM to update member SSN'));
    }
    if (
      valuesEqual(record[RCNO.SUBSCRIBER_SSN_RESULT], 'I')
      &&
      relationshipIsSubscriber
      && subscriberSsnDiffers
      && isPopulated(member[MEMBERSHIP.MEMBER_SSN])
      && !validSsn(record[RCNO.PSHBS_SUBSCRIBER_SSN])
    ) {
      mismatches.push(this.#decision('N7000', 3, 'DM004', 'OPM to update subscriber SSN'));
    }
    if (
      valuesEqual(record[RCNO.MEMBER_SSN_RESULT], 'I')
      && !relationshipIsSubscriber
      && memberSsnDiffers
      && validSsn(record[RCNO.PSHBS_MEMBER_SSN])
    ) {
      mismatches.push(this.#decision('N8000', 3, 'DM505', 'Carrier to update member SSN'));
    }
    if (
      valuesEqual(record[RCNO.SUBSCRIBER_SSN_RESULT], 'I')
      &&
      relationshipIsSubscriber
      && subscriberSsnDiffers
      && validSsn(record[RCNO.PSHBS_SUBSCRIBER_SSN])
    ) {
      mismatches.push(this.#decision('N9000', 3, 'DM506', 'Carrier to update subscriber SSN'));
    }

    if (ADDRESS_RESULT_COLUMNS.some((index) => valuesEqual(record[index], 'I'))) {
      if (typeof this.addressNormalizer !== 'function') {
        throw new Error('Address normalizer is required to evaluate N91 and N92');
      }
      const pshbsAddress = record.slice(34, 54);
      const membershipAddress = member.slice(19, 25);
      const addressesMatch = valuesEqual(
        this.addressNormalizer(pshbsAddress),
        this.addressNormalizer(membershipAddress),
      );
      mismatches.push(addressesMatch
        ? this.#decision('N91000', 3, 'DM512', 'No action required')
        : this.#decision('N92000', 3, 'DM507', 'Carrier to update mailing address'));
    }

    if (
      valuesEqual(record[RCNO.GENDER_RESULT], 'I')
      &&
      !valuesEqual(member[MEMBERSHIP.GENDER], record[RCNO.PSHBS_GENDER])
      && isPopulated(member[MEMBERSHIP.GENDER])
      && !valuesEqual(member[MEMBERSHIP.GENDER], 'U')
      && (!isPopulated(record[RCNO.PSHBS_GENDER]) || valuesEqual(record[RCNO.PSHBS_GENDER], 'U'))
    ) {
      mismatches.push(this.#decision('N10000', 3, 'DM006', 'OPM to update gender'));
    } else if (
      valuesEqual(record[RCNO.GENDER_RESULT], 'I')
      &&
      !valuesEqual(member[MEMBERSHIP.GENDER], record[RCNO.PSHBS_GENDER])
      && isPopulated(record[RCNO.PSHBS_GENDER])
      && !valuesEqual(record[RCNO.PSHBS_GENDER], 'U')
    ) {
      mismatches.push(this.#decision('N11000', 3, 'DM510', 'Carrier to update gender'));
    }

    if (
      valuesEqual(record[RCNO.BIRTH_DATE_RESULT], 'I')
      &&
      isPopulated(member[MEMBERSHIP.BIRTH_DATE])
      && !valuesEqual(member[MEMBERSHIP.BIRTH_DATE], record[RCNO.PSHBS_BIRTH_DATE])
    ) {
      const pshbsBirthDate = parseDate(record[RCNO.PSHBS_BIRTH_DATE], 'PSHBS birth date');
      const membershipBirthDate = parseDate(member[MEMBERSHIP.BIRTH_DATE], 'membership birth date');
      const opmCorrection = valuesEqual(member[MEMBERSHIP.EXCEPTION_FLAG], 'Y')
        || (pshbsBirthDate.getUTCDate() === 1 && membershipBirthDate.getUTCDate() !== 1);
      mismatches.push(opmCorrection
        ? this.#decision('N15000', 3, 'DM007', 'OPM to update member field')
        : this.#decision('N16000', 3, 'DM504', 'Carrier to update member field'));
    }

    if (mismatches.length > 0) return this.#aggregateDecisions(mismatches);
    return this.#catchAllOrDefault(context);
  }

  // Evaluates the AE-1/AC-2/DM-3/CE-4 catch-all conditions on their own, independent
  // of whether a specific F/I/N rule already matched. Returns null when none apply.
  #evaluateCatchAllConditions(context) {
    const { record, result } = context;
    const pshbsActive = isDateInRange(
      this.businessDate,
      record[RCNO.PSHBS_START_DATE],
      record[RCNO.PSHBS_END_DATE],
    );
    const menrActive = isDateInRange(
      this.businessDate,
      record[RCNO.MENR_START_DATE],
      record[RCNO.MENR_END_DATE],
    );
    const planDiffers = !valuesEqual(record[RCNO.PSHBS_PLAN_CODE], record[26]);
    const datesDiffer = !valuesEqual(record[RCNO.PSHBS_START_DATE], record[RCNO.MENR_START_DATE])
      || !valuesEqual(record[RCNO.PSHBS_END_DATE], record[RCNO.MENR_END_DATE]);

    if (
      (result === 'F' && pshbsActive)
      || (result === 'N' && pshbsActive && (planDiffers || datesDiffer))
    ) {
      return this.#decision('AE-1', 1, 'AE*', 'Active enrollment mismatch');
    }
    if (result === 'I' && menrActive) {
      return this.#decision('AC-2', 2, 'AC*', 'Active carrier enrollment mismatch');
    }
    if (
      result === 'N'
      && pshbsActive
      && DEMOGRAPHIC_RESULT_COLUMNS.some((index) => normalized(record[index]) !== 'M')
    ) {
      return this.#decision('DM-3', 3, 'DM*', 'Active demographic mismatch');
    }

    // 10/08 business rule change: CE-4 additionally treats coverage as
    // cancelled when the relevant end date has already passed the current
    // business date, even if it has not yet fallen on/before its start date.
    const pshbsCancelled = ['F', 'N'].includes(result)
      && isPopulated(record[RCNO.PSHBS_END_DATE])
      && (
        (
          isPopulated(record[RCNO.PSHBS_START_DATE])
          && compareDates(
            record[RCNO.PSHBS_END_DATE],
            record[RCNO.PSHBS_START_DATE],
            'PSHBS coverage end',
            'PSHBS coverage start',
          ) <= 0
        )
        || compareDates(
          record[RCNO.PSHBS_END_DATE],
          this.businessDate,
          'PSHBS coverage end',
          'business date',
        ) < 0
      );
    const menrCancelled = result === 'I'
      && isPopulated(record[RCNO.MENR_END_DATE])
      && (
        (
          isPopulated(record[RCNO.MENR_START_DATE])
          && compareDates(
            record[RCNO.MENR_END_DATE],
            record[RCNO.MENR_START_DATE],
            'MENR coverage end',
            'MENR coverage start',
          ) <= 0
        )
        || compareDates(
          record[RCNO.MENR_END_DATE],
          this.businessDate,
          'MENR coverage end',
          'business date',
        ) < 0
      );
    if (pshbsCancelled || menrCancelled) {
      return this.#decision('CE-4', 4, 'CE*', 'Cancelled enrollment mismatch');
    }

    return null;
  }

  #catchAllOrDefault(context) {
    return this.#evaluateCatchAllConditions(context)
      || this.#decision('No_rule99999', 1, '0000', 'No Rules Applied');
  }
}

