import { getOracleConnection } from './oracleService.js';

const SSN_DIGITS_LENGTH = 9;
const ORACLE_IN_CHUNK_SIZE = 500;
// 0F (subscriber SSN) is validated via identifier lookup to avoid duplicate errors.
const SUPPORTED_REF_QUALIFIERS = new Set(['1L', 'DX', 'ZZ']);

function normalizeDigits(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/\D/g, '');
}

function isLikelySsn(value) {
  const digits = normalizeDigits(value);
  return digits.length === SSN_DIGITS_LENGTH;
}

function sanitizeIdentifier(value) {
  const digits = normalizeDigits(value);
  if (!isLikelySsn(digits)) {
    return null;
  }

  return digits;
}

function maskIdentifier(digits) {
  if (!digits || digits.length < 4) {
    return '***';
  }

  return `***-**-${digits.slice(-4)}`;
}

function normalizeValidationScopeOption(validationScope) {
  const mode = String(validationScope?.mode || '').trim();
  if (mode !== 'single-subscriber' && mode !== 'single-subscriber-overrides') {
    return {
      mode: 'all-subscribers',
      subscriberSsn: null,
    };
  }

  const subscriberSsn = sanitizeIdentifier(validationScope?.subscriberSsn);
  return {
    mode: 'single-subscriber',
    subscriberSsn: subscriberSsn || null,
  };
}

function buildScopePrefixes(path) {
  if (!path) {
    return [];
  }

  const prefixes = [path];
  let current = path;

  for (let i = 0; i < 6; i += 1) {
    const next = current.replace(/\[[0-9]+\]$/, '');
    if (!next || next === current) {
      break;
    }
    prefixes.push(next);
    current = next;
  }

  return prefixes;
}

function pathMatchesAnyScope(path, scopePrefixes) {
  if (!path || !Array.isArray(scopePrefixes) || scopePrefixes.length === 0) {
    return false;
  }

  return scopePrefixes.some((prefix) => prefix && path.startsWith(prefix));
}

function getDataSegmentMeta(dataSegment) {
  const meta = dataSegment.find((entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && entry['loop-name']);
  return {
    loopName: meta?.['loop-name'] || null,
    segmentDescription: meta?.['segment-description'] || null,
  };
}

function getSegId(dataSegment) {
  const segIdEntry = dataSegment.find((entry) => Array.isArray(entry) && entry[0] === 'seg_id');
  return segIdEntry?.[1] || null;
}

function getDataSegmentUnits(dataSegment, currentPath) {
  const units = [];

  dataSegment.forEach((entry, index) => {
    if (!Array.isArray(entry)) {
      return;
    }

    if (entry[0] !== 'data_segment_unit' && entry[0] !== 'isa_data_segment_unit') {
      return;
    }

    const meta = entry[1];
    const value = entry[2];

    if (!meta || typeof meta !== 'object') {
      return;
    }

    units.push({
      ref: meta.ref || null,
      name: meta.name || null,
      value,
      path: `${currentPath}[${index}]`,
    });
  });

  return units;
}

function getUnitValue(units, ref) {
  const unit = units.find((entry) => entry.ref === ref);
  return unit ? unit.value : null;
}

function buildNmRefMap(units) {
  const refMap = new Map();

  units.forEach((unit) => {
    const ref = String(unit?.ref || '');
    if (!/^NM10\d$/.test(ref)) {
      return;
    }

    const refNum = Number(ref.slice(2));
    if (!Number.isFinite(refNum)) {
      return;
    }

    refMap.set(refNum, unit?.value);
  });

  return refMap;
}

function inferNmQualifierRefNum(units) {
  const refMap = buildNmRefMap(units);

  if (refMap.size === 0) {
    return null;
  }

  // Detect where the "34" qualifier actually landed when optional NM1 fields collapse.
  for (const [refNum, value] of refMap.entries()) {
    if (String(value || '').trim() !== '34') {
      continue;
    }

    const nextDigits = sanitizeIdentifier(refMap.get(refNum + 1));
    if (!nextDigits) {
      continue;
    }

    return refNum;
  }

  return null;
}

function extractCanonicalNm1Values(units) {
  const refMap = buildNmRefMap(units);
  const nm = {
    NM101: String(refMap.get(101) || '').trim(),
    NM102: String(refMap.get(102) || '').trim(),
    NM103: String(refMap.get(103) || '').trim(),
    NM104: String(refMap.get(104) || '').trim(),
    NM105: String(refMap.get(105) || '').trim(),
    NM106: String(refMap.get(106) || '').trim(),
    NM107: String(refMap.get(107) || '').trim(),
    NM108: String(refMap.get(108) || '').trim(),
    NM109: String(refMap.get(109) || '').trim(),
  };

  const qualifierRefNum = inferNmQualifierRefNum(units);

  // In collapsed payloads, NM108/109 can shift left into NM105-107 slots.
  // Preserve NM101-104 as-is and only blank optional NM105-107 range that was collapsed.
  if (Number.isFinite(qualifierRefNum) && qualifierRefNum >= 105 && qualifierRefNum <= 108) {
    nm.NM108 = String(refMap.get(qualifierRefNum) || '').trim();
    nm.NM109 = String(refMap.get(qualifierRefNum + 1) || '').trim();

    for (let refNum = qualifierRefNum; refNum <= 107; refNum += 1) {
      nm[`NM${refNum}`] = '';
    }
  }

  return nm;
}

function normalizeRefValueForQualifier(qualifier, value) {
  if (value === null || value === undefined) {
    return null;
  }

  const asText = String(value).trim();
  if (!asText) {
    return null;
  }

  if (qualifier === '0F') {
    return sanitizeIdentifier(asText);
  }

  return asText;
}

function extractIdentifierFromRefSegment(units) {
  const qualifier = getUnitValue(units, 'REF01');
  const value = getUnitValue(units, 'REF02');

  if (qualifier !== '0F') {
    return null;
  }

  const normalized = sanitizeIdentifier(value);
  if (!normalized) {
    return null;
  }

  return {
    digits: normalized,
    sourceRef: 'REF02',
    qualifierRef: 'REF01',
    qualifierValue: String(qualifier),
  };
}

function extractRefCandidateFromRefSegment(units) {
  const qualifier = String(getUnitValue(units, 'REF01') || '').trim();
  if (!SUPPORTED_REF_QUALIFIERS.has(qualifier)) {
    return null;
  }

  const value = getUnitValue(units, 'REF02');
  const normalizedValue = normalizeRefValueForQualifier(qualifier, value);

  if (!normalizedValue) {
    return null;
  }

  return {
    qualifier,
    value: normalizedValue,
    sourceRef: 'REF02',
    qualifierRef: 'REF01',
  };
}

function extractIdentifierFromNmSegment(units) {
  const nm108 = getUnitValue(units, 'NM108');
  const nm109 = getUnitValue(units, 'NM109');

  if (nm108 === '34') {
    const normalized = sanitizeIdentifier(nm109);
    if (normalized) {
      return {
        digits: normalized,
        sourceRef: 'NM109',
        qualifierRef: 'NM108',
        qualifierValue: '34',
      };
    }
  }

  // Some enriched payloads collapse optional NM1 elements and shift refs by one position.
  for (let i = 0; i < units.length - 1; i += 1) {
    const current = units[i];
    const next = units[i + 1];

    if (!current?.ref || !next?.ref) {
      continue;
    }

    if (!/^NM10\d$/.test(current.ref) || !/^NM10\d$/.test(next.ref)) {
      continue;
    }

    if (String(current.value) !== '34') {
      continue;
    }

    const normalized = sanitizeIdentifier(next.value);
    if (!normalized) {
      continue;
    }

    return {
      digits: normalized,
      sourceRef: next.ref,
      qualifierRef: current.ref,
      qualifierValue: '34',
    };
  }

  return null;
}

function walkForMemberIdentifiers(value, currentPath, collector) {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    if (value[0] === 'data_segment') {
      const segId = getSegId(value);
      const meta = getDataSegmentMeta(value);
      const units = getDataSegmentUnits(value, currentPath);

      let extracted = null;
      if (segId === 'REF') {
        extracted = extractIdentifierFromRefSegment(units);
      }

      if (!extracted && segId === 'NM1') {
        extracted = extractIdentifierFromNmSegment(units);
      }

      if (extracted) {
        collector.push({
          identifierDigits: extracted.digits,
          sourceRef: extracted.sourceRef,
          qualifierRef: extracted.qualifierRef,
          qualifierValue: extracted.qualifierValue,
          loopName: meta.loopName,
          segmentDescription: meta.segmentDescription,
          path: currentPath,
        });
      }
    }

    value.forEach((entry, index) => {
      walkForMemberIdentifiers(entry, `${currentPath}[${index}]`, collector);
    });
    return;
  }

  Object.entries(value).forEach(([key, entryValue]) => {
    const nextPath = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
      ? `${currentPath}.${key}`
      : `${currentPath}[${JSON.stringify(key)}]`;

    walkForMemberIdentifiers(entryValue, nextPath, collector);
  });
}

export function extractCandidateIdentifiersFromEnriched(enrichedResult) {
  const collected = [];
  walkForMemberIdentifiers(enrichedResult, 'enrichedResult', collected);

  const dedupe = new Map();

  collected.forEach((entry) => {
    if (!dedupe.has(entry.identifierDigits)) {
      dedupe.set(entry.identifierDigits, entry);
      return;
    }

    const existing = dedupe.get(entry.identifierDigits);
    if (existing.sourceRef !== 'REF02' && entry.sourceRef === 'REF02') {
      dedupe.set(entry.identifierDigits, entry);
    }
  });

  return Array.from(dedupe.values());
}

export function extractRefCandidatesFromEnriched(enrichedResult) {
  const collected = [];

  function walk(value, currentPath) {
    if (!value || typeof value !== 'object') {
      return;
    }

    if (Array.isArray(value)) {
      if (value[0] === 'data_segment') {
        const segId = getSegId(value);

        if (segId === 'REF') {
          const meta = getDataSegmentMeta(value);
          const units = getDataSegmentUnits(value, currentPath);
          const extracted = extractRefCandidateFromRefSegment(units);

          if (extracted) {
            collected.push({
              qualifier: extracted.qualifier,
              refValue: extracted.value,
              sourceRef: extracted.sourceRef,
              qualifierRef: extracted.qualifierRef,
              loopName: meta.loopName,
              segmentDescription: meta.segmentDescription,
              path: currentPath,
            });
          }
        }
      }

      value.forEach((entry, index) => {
        walk(entry, `${currentPath}[${index}]`);
      });

      return;
    }

    Object.entries(value).forEach(([key, entryValue]) => {
      const nextPath = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
        ? `${currentPath}.${key}`
        : `${currentPath}[${JSON.stringify(key)}]`;

      walk(entryValue, nextPath);
    });
  }

  walk(enrichedResult, 'enrichedResult');

  const dedupe = new Map();
  collected.forEach((entry) => {
    const dedupeKey = `${entry.qualifier}||${entry.refValue}`;
    if (!dedupe.has(dedupeKey)) {
      dedupe.set(dedupeKey, entry);
    }
  });

  return Array.from(dedupe.values());
}

export function extractNm1CandidatesFromEnriched(enrichedResult) {
  const collected = [];

  function walk(value, currentPath) {
    if (!value || typeof value !== 'object') {
      return;
    }

    if (Array.isArray(value)) {
      if (value[0] === 'data_segment') {
        const segId = getSegId(value);

        if (segId === 'NM1') {
          const meta = getDataSegmentMeta(value);
          const units = getDataSegmentUnits(value, currentPath);
          const nm = extractCanonicalNm1Values(units);

          const nm101 = String(nm.NM101 || '').trim();
          if (nm101 === 'IL') {
            const identifier = extractIdentifierFromNmSegment(units);
            if (identifier?.digits) {
              collected.push({
                subscriberSsn: identifier.digits,
                sourceRef: identifier.sourceRef,
                qualifierRef: identifier.qualifierRef,
                qualifierValue: identifier.qualifierValue,
                loopName: meta.loopName,
                segmentDescription: meta.segmentDescription,
                path: currentPath,
                nm1: nm,
              });
            }
          }
        }
      }

      value.forEach((entry, index) => {
        walk(entry, `${currentPath}[${index}]`);
      });
      return;
    }

    Object.entries(value).forEach(([key, entryValue]) => {
      const nextPath = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
        ? `${currentPath}.${key}`
        : `${currentPath}[${JSON.stringify(key)}]`;

      walk(entryValue, nextPath);
    });
  }

  walk(enrichedResult, 'enrichedResult');
  return collected;
}

function buildInClauseAndBinds(chunk) {
  const bindNames = [];
  const binds = {};

  chunk.forEach((value, index) => {
    const bindName = `id${index}`;
    bindNames.push(`:${bindName}`);
    binds[bindName] = value;
  });

  return {
    inClause: bindNames.join(', '),
    binds,
  };
}

async function fetchExistingIdentifiers(identifierDigitsList) {
  const existing = new Set();
  let connection;

  try {
    connection = await getOracleConnection();

    if (!connection) {
      throw new Error('Unable to get Oracle connection from pool');
    }

    for (let i = 0; i < identifierDigitsList.length; i += ORACLE_IN_CHUNK_SIZE) {
      const chunk = identifierDigitsList.slice(i, i + ORACLE_IN_CHUNK_SIZE);
      const { inClause, binds } = buildInClauseAndBinds(chunk);

      const sql = `
        SELECT DISTINCT REGEXP_REPLACE(NVL(IDENTIFICATION_VALUE, ''), '[^0-9]') AS IDENTIFIER_DIGITS
        FROM MEMBER_OWNER.TAP_PERSON_EXTERNAL_IDENTIFIER
        WHERE RECORD_STATUS_CODE = 'C'
          AND REGEXP_REPLACE(NVL(IDENTIFICATION_VALUE, ''), '[^0-9]') IN (${inClause})
      `;

      const response = await connection.execute(sql, binds);
      const rows = response?.rows || [];

      rows.forEach((row) => {
        const normalized = sanitizeIdentifier(Array.isArray(row) ? row[0] : row?.IDENTIFIER_DIGITS);
        if (normalized) {
          existing.add(normalized);
        }
      });
    }
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {
        // no-op
      }
    }
  }

  return existing;
}

async function fetchExistingRefValues(qualifier, values) {
  const existing = new Set();
  let connection;

  const sqlByQualifier = {
    '0F': `
      SELECT DISTINCT REGEXP_REPLACE(NVL(SUBSCRIBER_SSN, ''), '[^0-9]') AS REF_VALUE
      FROM MEMBER_OWNER.TAP_COVERAGE
      WHERE RECORD_STATUS_CODE = 'C'
        AND REGEXP_REPLACE(NVL(SUBSCRIBER_SSN, ''), '[^0-9]') IN (__IN_CLAUSE__)
    `,
    '1L': `
      SELECT DISTINCT TRIM(NVL(EMPLOYER_GROUP_NUMBER, '')) AS REF_VALUE
      FROM MEMBER_OWNER.TAP_COVERAGE
      WHERE RECORD_STATUS_CODE = 'C'
        AND TRIM(NVL(EMPLOYER_GROUP_NUMBER, '')) IN (__IN_CLAUSE__)
    `,
    DX: `
      SELECT DISTINCT TRIM(NVL(ELIGIBILITY_SUBGROUP_ID, '')) AS REF_VALUE
      FROM MEMBER_OWNER.TAP_PLAN_GROUP
      WHERE RECORD_STATUS_CODE = 'C'
        AND TRIM(NVL(ELIGIBILITY_SUBGROUP_ID, '')) IN (__IN_CLAUSE__)
    `,
    ZZ: `
      SELECT DISTINCT TRIM(NVL(REGEXP_SUBSTR(PPG_GROUP_SUBGROUP, '[^*]+$'), '')) AS REF_VALUE
      FROM MEMBER_OWNER.TAP_PLAN_GROUP
      WHERE RECORD_STATUS_CODE = 'C'
        AND TRIM(NVL(REGEXP_SUBSTR(PPG_GROUP_SUBGROUP, '[^*]+$'), '')) IN (__IN_CLAUSE__)
    `,
  };

  const sqlTemplate = sqlByQualifier[qualifier];
  if (!sqlTemplate || values.length === 0) {
    return existing;
  }

  try {
    connection = await getOracleConnection();

    if (!connection) {
      throw new Error('Unable to get Oracle connection from pool');
    }

    for (let i = 0; i < values.length; i += ORACLE_IN_CHUNK_SIZE) {
      const chunk = values.slice(i, i + ORACLE_IN_CHUNK_SIZE);
      const { inClause, binds } = buildInClauseAndBinds(chunk);
      const sql = sqlTemplate.replace('__IN_CLAUSE__', inClause);

      const response = await connection.execute(sql, binds);
      const rows = response?.rows || [];

      rows.forEach((row) => {
        const rawValue = Array.isArray(row) ? row[0] : row?.REF_VALUE;
        const normalized = normalizeRefValueForQualifier(qualifier, rawValue);
        if (normalized) {
          existing.add(normalized);
        }
      });
    }
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {
        // no-op
      }
    }
  }

  return existing;
}

async function fetchPersonNameRowsBySubscriberSsn(subscriberSsnList) {
  const rowsBySsn = new Map();
  let connection;

  try {
    connection = await getOracleConnection();

    if (!connection) {
      throw new Error('Unable to get Oracle connection from pool');
    }

    for (let i = 0; i < subscriberSsnList.length; i += ORACLE_IN_CHUNK_SIZE) {
      const chunk = subscriberSsnList.slice(i, i + ORACLE_IN_CHUNK_SIZE);
      const { inClause, binds } = buildInClauseAndBinds(chunk);

      const sql = `
        SELECT
          REGEXP_REPLACE(NVL(tc.SUBSCRIBER_SSN, ''), '[^0-9]') AS SUBSCRIBER_SSN_DIGITS,
          TRIM(NVL(p.FIRST_NAME, '')) AS FIRST_NAME,
          TRIM(NVL(p.MIDDLE_NAME, '')) AS MIDDLE_NAME,
          TRIM(NVL(p.LAST_NAME, '')) AS LAST_NAME,
          TRIM(NVL(p.PREFIX, '')) AS PREFIX,
          TRIM(NVL(p.SUFFIX, '')) AS SUFFIX
        FROM MEMBER_OWNER.TAP_COVERAGE tc
        JOIN MEMBER_OWNER.TAP_PERSON_COVERAGE pc
          ON pc.COVERAGE_ID = tc.COVERAGE_ID
         AND pc.RECORD_STATUS_CODE = 'C'
        JOIN MEMBER_OWNER.TAP_PERSON p
          ON p.PERSON_ID = pc.PERSON_ID
         AND p.RECORD_STATUS_CODE = 'C'
        WHERE tc.RECORD_STATUS_CODE = 'C'
          AND REGEXP_REPLACE(NVL(tc.SUBSCRIBER_SSN, ''), '[^0-9]') IN (${inClause})
      `;

      const response = await connection.execute(sql, binds, { outFormat: 4002 });
      const rows = response?.rows || [];

      rows.forEach((row) => {
        const ssn = sanitizeIdentifier(row?.SUBSCRIBER_SSN_DIGITS);
        if (!ssn) {
          return;
        }

        if (!rowsBySsn.has(ssn)) {
          rowsBySsn.set(ssn, []);
        }

        rowsBySsn.get(ssn).push({
          firstName: String(row?.FIRST_NAME || '').trim(),
          middleName: String(row?.MIDDLE_NAME || '').trim(),
          lastName: String(row?.LAST_NAME || '').trim(),
          prefix: String(row?.PREFIX || '').trim(),
          suffix: String(row?.SUFFIX || '').trim(),
        });
      });
    }
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {
        // no-op
      }
    }
  }

  return rowsBySsn;
}

export async function validateIdentifiersAgainstDataHub(enrichedResult, { validationScope = null } = {}) {
  const scope = normalizeValidationScopeOption(validationScope);
  let extracted = extractCandidateIdentifiersFromEnriched(enrichedResult);

  if (scope.mode === 'single-subscriber' && scope.subscriberSsn) {
    extracted = extracted.filter((entry) => entry.identifierDigits === scope.subscriberSsn);
  }

  const identifierDigitsList = extracted.map((entry) => entry.identifierDigits);

  if (identifierDigitsList.length === 0) {
    return {
      summary: {
        status: 'completed',
        warning: null,
        extractedCount: 0,
        matchedCount: 0,
        missingCount: 0,
      },
      missingIdentifiers: [],
    };
  }

  try {
    const existingIdentifiers = await fetchExistingIdentifiers(identifierDigitsList);

    const missingIdentifiers = extracted
      .filter((entry) => !existingIdentifiers.has(entry.identifierDigits))
      .map((entry) => ({
        ...entry,
        maskedIdentifier: maskIdentifier(entry.identifierDigits),
      }));

    return {
      summary: {
        status: 'completed',
        warning: null,
        extractedCount: extracted.length,
        matchedCount: extracted.length - missingIdentifiers.length,
        missingCount: missingIdentifiers.length,
      },
      missingIdentifiers,
    };
  } catch (error) {
    return {
      summary: {
        status: 'warning',
        warning: `DataHub lookup unavailable: ${error?.message || 'Unknown error'}`,
        extractedCount: extracted.length,
        matchedCount: 0,
        missingCount: 0,
      },
      missingIdentifiers: [],
    };
  }
}

export async function validateLoop2000RefValuesAgainstDataHub(enrichedResult, { validationScope = null } = {}) {
  const scope = normalizeValidationScopeOption(validationScope);
  let extracted = extractRefCandidatesFromEnriched(enrichedResult);

  if (scope.mode === 'single-subscriber' && scope.subscriberSsn) {
    const scopedIdentifiers = extractCandidateIdentifiersFromEnriched(enrichedResult)
      .filter((entry) => entry.identifierDigits === scope.subscriberSsn);

    if (scopedIdentifiers.length === 0) {
      extracted = [];
    } else {
      const scopePrefixes = scopedIdentifiers.flatMap((entry) => buildScopePrefixes(entry.path));
      extracted = extracted.filter((entry) => pathMatchesAnyScope(entry.path, scopePrefixes));
    }
  }

  if (extracted.length === 0) {
    return {
      summary: {
        status: 'completed',
        warning: null,
        extractedCount: 0,
        matchedCount: 0,
        missingCount: 0,
      },
      missingRefValues: [],
    };
  }

  try {
    const valuesByQualifier = new Map();

    extracted.forEach((entry) => {
      if (!valuesByQualifier.has(entry.qualifier)) {
        valuesByQualifier.set(entry.qualifier, new Set());
      }

      valuesByQualifier.get(entry.qualifier).add(entry.refValue);
    });

    const existingByQualifier = new Map();
    for (const [qualifier, valueSet] of valuesByQualifier.entries()) {
      const existingValues = await fetchExistingRefValues(qualifier, Array.from(valueSet));
      existingByQualifier.set(qualifier, existingValues);
    }

    const missingRefValues = extracted.filter((entry) => {
      const existing = existingByQualifier.get(entry.qualifier);
      return !existing || !existing.has(entry.refValue);
    });

    return {
      summary: {
        status: 'completed',
        warning: null,
        extractedCount: extracted.length,
        matchedCount: extracted.length - missingRefValues.length,
        missingCount: missingRefValues.length,
      },
      missingRefValues,
    };
  } catch (error) {
    return {
      summary: {
        status: 'warning',
        warning: `DataHub REF lookup unavailable: ${error?.message || 'Unknown error'}`,
        extractedCount: extracted.length,
        matchedCount: 0,
        missingCount: 0,
      },
      missingRefValues: [],
    };
  }
}

export async function validateNm1ValuesAgainstDataHub(enrichedResult, { validationScope = null } = {}) {
  const scope = normalizeValidationScopeOption(validationScope);
  let extracted = extractNm1CandidatesFromEnriched(enrichedResult);

  if (scope.mode === 'single-subscriber' && scope.subscriberSsn) {
    extracted = extracted.filter((entry) => entry.subscriberSsn === scope.subscriberSsn);
  }

  if (extracted.length === 0) {
    return {
      summary: {
        status: 'completed',
        warning: null,
        extractedCount: 0,
        mismatchedCount: 0,
      },
      mismatches: [],
    };
  }

  try {
    const uniqueSubscriberSsns = Array.from(new Set(extracted.map((entry) => entry.subscriberSsn)));
    const dbRowsBySsn = await fetchPersonNameRowsBySubscriberSsn(uniqueSubscriberSsns);
    const mismatches = [];

    const equalsIgnoreCase = (left, right) => String(left || '').trim().toUpperCase() === String(right || '').trim().toUpperCase();

    extracted.forEach((entry) => {
      const dbRows = dbRowsBySsn.get(entry.subscriberSsn) || [];
      if (dbRows.length === 0) {
        return;
      }

      const checks = [
        { field: 'NM103', dbField: 'lastName' },
        { field: 'NM104', dbField: 'firstName' },
        { field: 'NM105', dbField: 'middleName' },
        { field: 'NM106', dbField: 'prefix' },
        { field: 'NM107', dbField: 'suffix' },
      ];

      checks.forEach(({ field, dbField }) => {
        const ediValue = String(entry?.nm1?.[field] || '').trim();
        if (!ediValue) {
          return;
        }

        const matchedAny = dbRows.some((row) => equalsIgnoreCase(ediValue, row?.[dbField]));
        if (!matchedAny) {
          const dbValues = Array.from(new Set(dbRows.map((row) => String(row?.[dbField] || '').trim()).filter(Boolean)));

          mismatches.push({
            subscriberSsn: entry.subscriberSsn,
            field,
            ediValue,
            dbValues,
            loopName: entry.loopName,
            segmentDescription: entry.segmentDescription,
            path: entry.path,
            sourceRef: field,
          });
        }
      });
    });

    return {
      summary: {
        status: 'completed',
        warning: null,
        extractedCount: extracted.length,
        mismatchedCount: mismatches.length,
      },
      mismatches,
    };
  } catch (error) {
    return {
      summary: {
        status: 'warning',
        warning: `DataHub NM1 lookup unavailable: ${error?.message || 'Unknown error'}`,
        extractedCount: extracted.length,
        mismatchedCount: 0,
      },
      mismatches: [],
    };
  }
}
