import { normalizeRcnoaAddress } from '../app/services/rcnoa/rcnoaAddressService.js';

export { normalizeRcnoaAddress };

export const RCNOA_MOCK_BUSINESS_DATE = '20260810';

const GROUPS = Object.freeze({
  ab: { id: 'complete-ab-rules', label: 'Complete A/B rule coverage' },
  f: { id: 'complete-f-rules', label: 'Complete F rule coverage' },
  i: { id: 'complete-i-rules', label: 'Complete I rule coverage' },
  n: { id: 'complete-n-rules', label: 'Complete N rule coverage' },
  fallback: { id: 'complete-fallback-rules', label: 'Complete fallback rule coverage' },
});

function syntheticIdentity(sequence) {
  const suffix = String(sequence).padStart(3, '0');
  return {
    subscriberId: `SUB${suffix}`,
    mrn: `MRN${suffix}`,
    annuitant: `ANN${suffix}`,
    firstName: `CASE${suffix}`,
    lastName: `TESTER${suffix}`,
    memberSsn: String(700000000 + sequence),
    subscriberSsn: String(700000000 + sequence),
  };
}

function baseRcno(sequence) {
  const identity = syntheticIdentity(sequence);
  const suffix = String(sequence).padStart(3, '0');
  const record = Array(73).fill('');
  const values = {
    0: '01', 1: identity.subscriberId, 2: identity.subscriberId, 3: 'M',
    4: identity.mrn, 5: identity.mrn, 6: 'M',
    7: identity.annuitant, 8: identity.annuitant, 9: 'M',
    10: identity.lastName, 11: identity.lastName, 12: 'M',
    13: identity.firstName, 14: identity.firstName, 15: 'M',
    16: '19800115', 17: '19800115', 18: 'M',
    19: identity.memberSsn, 20: identity.memberSsn, 21: 'M',
    22: identity.subscriberSsn, 23: identity.subscriberSsn, 24: 'M',
    25: 'ABC', 26: 'ABC', 27: 'M',
    28: '20260101', 29: '20260101', 30: 'M',
    31: '20261231', 32: '20261231', 33: 'M',
    34: '100 TEST ST', 35: '100 TEST ST', 36: 'M',
    37: '', 38: '', 39: 'M', 40: '', 41: '', 42: 'M',
    43: 'TEST CITY', 44: 'TEST CITY', 45: 'M',
    46: 'CA', 47: 'CA', 48: 'M', 49: '90001', 50: '90001', 51: 'M',
    52: 'US', 53: 'US', 54: 'M', 55: '5550100100', 56: '5550100100', 57: 'M',
    58: `case${suffix}@example.invalid`, 59: `case${suffix}@example.invalid`, 60: 'M',
    61: 'PO123', 62: 'PO123', 63: 'M', 64: '18', 65: '18', 66: 'M',
    67: '', 68: '', 69: 'M', 70: 'F', 71: 'F', 72: 'M',
  };
  Object.entries(values).forEach(([index, value]) => { record[Number(index)] = value; });
  return record;
}

function baseMembership(rcnoRecord) {
  const record = Array(25).fill('');
  const values = {
    0: rcnoRecord[5], 1: rcnoRecord[28], 2: rcnoRecord[31],
    3: rcnoRecord[13], 4: rcnoRecord[10], 5: rcnoRecord[19],
    6: rcnoRecord[70], 7: rcnoRecord[64], 8: rcnoRecord[25],
    9: rcnoRecord[7], 10: rcnoRecord[61], 11: 'N', 12: 'N',
    13: '20', 14: 'Y', 15: rcnoRecord[22], 16: 'N',
    17: rcnoRecord[16], 18: '', 19: rcnoRecord[34], 20: rcnoRecord[37],
    21: rcnoRecord[40], 22: rcnoRecord[43], 23: rcnoRecord[46], 24: rcnoRecord[49],
  };
  Object.entries(values).forEach(([index, value]) => { record[Number(index)] = value; });
  return record;
}

function applyOverrides(record, overrides = {}) {
  Object.entries(overrides).forEach(([index, value]) => { record[Number(index)] = value; });
  return record;
}

function scenario({
  sequence, group, testCaseId, ruleId, code, rcno = {}, membership = null,
  recent834Records = [], prior = null, x834Eligible = true,
}) {
  const rcnoRecord = applyOverrides(baseRcno(sequence), rcno);
  const membershipRecords = membership === null
    ? []
    : [applyOverrides(baseMembership(rcnoRecord), membership)];
  const priorRcnaRecords = prior
    ? [[...rcnoRecord, prior.priority, prior.code, prior.description, '', prior.agingMonths]]
    : [];
  return {
    sequence,
    group,
    testCaseId,
    expectedRuleId: ruleId,
    expectedCode: code,
    x834Eligible,
    rcnoRecord,
    membershipRecords,
    recent834Records: recent834Records.map((record) => (
      record === 'Y' || record === 'N'
        ? [rcnoRecord[22], rcnoRecord[28], rcnoRecord[31], record]
        : record
    )),
    priorRcnaRecords,
  };
}

const scenarios = [
  scenario({ sequence: 1, group: 'ab', testCaseId: 'CAT-001-A100', ruleId: 'A100', code: 'MM' }),
  scenario({
    sequence: 2, group: 'ab', testCaseId: 'CAT-002-B200', ruleId: 'B200', code: 'CE001',
    rcno: { 3: 'N' },
    prior: { priority: '4', code: 'CE001', description: 'OPM to send 834 cancellation', agingMonths: '2' },
  }),

  scenario({ sequence: 3, group: 'f', testCaseId: 'CAT-003-F1300', ruleId: 'F1300', code: 'CE502', rcno: { 3: 'F', 28: '20260201', 31: '20260201' }, membership: {} }),
  scenario({ sequence: 4, group: 'f', testCaseId: 'CAT-004-F2400', ruleId: 'F2400', code: 'CE001', rcno: { 3: 'F', 28: '20260201', 31: '20260201' }, membership: { 2: '20261231' } }),
  scenario({ sequence: 5, group: 'f', testCaseId: 'CAT-005-F3500', ruleId: 'F3500', code: 'CE500', rcno: { 3: 'F', 28: '20260201', 31: '20260201' }, membership: { 2: '20261231' }, recent834Records: ['Y'] }),
  scenario({ sequence: 6, group: 'f', testCaseId: 'CAT-006-F4600', ruleId: 'F4600', code: 'AE002', rcno: { 3: 'F' }, membership: { 12: 'Y' } }),
  scenario({ sequence: 7, group: 'f', testCaseId: 'CAT-007-F5700', ruleId: 'F5700', code: 'AE003', rcno: { 3: 'F' }, membership: { 11: 'Y' } }),
  scenario({ sequence: 8, group: 'f', testCaseId: 'CAT-008-F6800', ruleId: 'F6800', code: 'AE004', rcno: { 3: 'F', 64: '19', 65: '19' }, membership: { 7: '19', 13: '27', 14: 'Y' } }),
  scenario({ sequence: 9, group: 'f', testCaseId: 'CAT-009-F7000', ruleId: 'F7000', code: 'Z0000', rcno: { 3: 'F', 64: '1', 65: '1' }, membership: { 7: '1', 13: '27' }, x834Eligible: false }),
  scenario({ sequence: 10, group: 'f', testCaseId: 'CAT-010-F8000', ruleId: 'F8000', code: 'AE502', rcno: { 3: 'F', 31: '20260901' }, membership: { 2: '20261002' } }),
  scenario({ sequence: 11, group: 'f', testCaseId: 'CAT-011-F9000', ruleId: 'F9000', code: 'AE504', rcno: { 3: 'F', 16: '20000715', 17: '20000715', 28: '20000101', 29: '20000101', 31: '20260831', 32: '20260831' }, membership: { 1: '20000101', 2: '20260815', 17: '20000715' } }),
  scenario({ sequence: 12, group: 'f', testCaseId: 'CAT-012-F10000', ruleId: 'F10000', code: 'AE010', rcno: { 3: 'F', 31: '20260801' }, membership: { 1: '20260201' } }),
  scenario({ sequence: 13, group: 'f', testCaseId: 'CAT-013-F11000', ruleId: 'F11000', code: 'AE001', rcno: { 3: 'F' }, membership: { 1: '20260201' }, recent834Records: ['N'] }),
  scenario({ sequence: 14, group: 'f', testCaseId: 'CAT-014-F12000', ruleId: 'F12000', code: 'AE502', rcno: { 3: 'F' }, membership: {} }),
  scenario({ sequence: 15, group: 'f', testCaseId: 'CAT-015-F13000', ruleId: 'F13000', code: 'AE500', rcno: { 3: 'F' }, recent834Records: ['Y'] }),
  scenario({ sequence: 16, group: 'f', testCaseId: 'CAT-016-F14000', ruleId: 'F14000', code: 'AE501', rcno: { 3: 'F' }, recent834Records: ['N'] }),
  scenario({ sequence: 17, group: 'f', testCaseId: 'CAT-017-F20000', ruleId: 'F20000', code: 'AE013', rcno: { 3: 'F' } }),

  scenario({ sequence: 18, group: 'i', testCaseId: 'CAT-018-I1000', ruleId: 'I1000', code: 'AC002', rcno: { 3: 'I' }, membership: { 2: '20260731' } }),
  scenario({ sequence: 19, group: 'i', testCaseId: 'CAT-019-I2000', ruleId: 'I2000', code: 'AC004', rcno: { 3: 'I' }, membership: {} }),
  scenario({ sequence: 20, group: 'i', testCaseId: 'CAT-020-I3000', ruleId: 'I3000', code: 'CE001', rcno: { 3: 'I', 29: '20260201', 32: '20260201' }, membership: { 1: '20260101', 2: '20261231' } }),
  scenario({ sequence: 21, group: 'i', testCaseId: 'CAT-021-I4000', ruleId: 'I4000', code: 'AC500', rcno: { 3: 'I' }, membership: {}, recent834Records: ['Y'] }),
  scenario({ sequence: 22, group: 'i', testCaseId: 'CAT-022-I5000', ruleId: 'I5000', code: 'CE500', rcno: { 3: 'I', 29: '20260101', 32: '20260731' }, membership: { 2: '20260731' }, recent834Records: [[null, '20260101', '20260731', 'Y']] }),
  scenario({ sequence: 23, group: 'i', testCaseId: 'CAT-023-I6000', ruleId: 'I6000', code: 'AC501', rcno: { 3: 'I' }, membership: {}, recent834Records: ['N'] }),
  scenario({ sequence: 24, group: 'i', testCaseId: 'CAT-024-I7000', ruleId: 'I7000', code: 'CE501', rcno: { 3: 'I', 29: '20260101', 32: '20260731' }, membership: { 2: '20260731' }, recent834Records: [[null, '20260101', '20260731', 'N']] }),

  scenario({ sequence: 25, group: 'n', testCaseId: 'CAT-025-N0000', ruleId: 'N0000', code: 'KICKO', rcno: { 3: 'N', 6: 'N' }, x834Eligible: false }),
  scenario({ sequence: 26, group: 'n', testCaseId: 'CAT-026-N1000', ruleId: 'N1000', code: 'DM501', rcno: { 3: 'N', 6: 'N', 9: 'I' }, membership: { 9: 'OTHER' } }),
  scenario({ sequence: 27, group: 'n', testCaseId: 'CAT-027-N2000', ruleId: 'N2000', code: 'DM508', rcno: { 3: 'N', 6: 'N', 63: 'I' }, membership: { 10: 'OTHER' } }),
  scenario({ sequence: 28, group: 'n', testCaseId: 'CAT-028-N3000', ruleId: 'N3000', code: 'DM509', rcno: { 3: 'N', 6: 'N', 66: 'I' }, membership: { 7: '19' } }),
  scenario({ sequence: 29, group: 'n', testCaseId: 'CAT-029-N4000', ruleId: 'N4000', code: 'DM502', rcno: { 3: 'N', 6: 'N', 12: 'I' }, membership: { 4: 'TESTER029-SUFFIX' } }),
  scenario({ sequence: 30, group: 'n', testCaseId: 'CAT-030-N5000', ruleId: 'N5000', code: 'DM503', rcno: { 3: 'N', 6: 'N', 15: 'I' }, membership: { 3: 'CASE030-SUFFIX' } }),
  scenario({ sequence: 31, group: 'n', testCaseId: 'CAT-031-N4000_1', ruleId: 'N4000-1', code: 'DM001', rcno: { 3: 'N', 6: 'N', 12: 'I' }, membership: { 4: 'DIFFERENT' } }),
  scenario({ sequence: 32, group: 'n', testCaseId: 'CAT-032-N5000_1', ruleId: 'N5000-1', code: 'DM002', rcno: { 3: 'N', 6: 'N', 15: 'I' }, membership: { 3: 'DIFFERENT' } }),
  scenario({ sequence: 33, group: 'n', testCaseId: 'CAT-033-N5000_2', ruleId: 'N5000-2', code: 'AE014', rcno: { 3: 'N', 6: 'N' }, membership: { 18: '20260315' } }),
  scenario({ sequence: 34, group: 'n', testCaseId: 'CAT-034-N6000', ruleId: 'N6000', code: 'DM003', rcno: { 3: 'N', 6: 'N', 19: '000000000', 20: '000000000', 21: 'I', 64: '19', 65: '19' }, membership: { 5: '711223333', 7: '19' } }),
  scenario({ sequence: 35, group: 'n', testCaseId: 'CAT-035-N7000', ruleId: 'N7000', code: 'DM004', rcno: { 3: 'N', 6: 'N', 22: '999999999', 23: '999999999', 24: 'I' }, membership: { 5: '711223334' } }),
  scenario({ sequence: 36, group: 'n', testCaseId: 'CAT-036-N8000', ruleId: 'N8000', code: 'DM505', rcno: { 3: 'N', 6: 'N', 19: '722334444', 20: '722334444', 21: 'I', 64: '19', 65: '19' }, membership: { 5: '711223335', 7: '19' } }),
  scenario({ sequence: 37, group: 'n', testCaseId: 'CAT-037-N9000', ruleId: 'N9000', code: 'DM506', rcno: { 3: 'N', 6: 'N', 22: '722334445', 23: '722334445', 24: 'I' }, membership: { 5: '711223336' } }),
  scenario({ sequence: 38, group: 'n', testCaseId: 'CAT-038-N91000', ruleId: 'N91000', code: 'DM512', rcno: { 3: 'N', 6: 'N', 34: '100 TEST STREET', 36: 'I' }, membership: { 19: '100 TEST ST' } }),
  scenario({ sequence: 39, group: 'n', testCaseId: 'CAT-039-N92000', ruleId: 'N92000', code: 'DM507', rcno: { 3: 'N', 6: 'N', 34: '100 TEST ST', 36: 'I' }, membership: { 19: '200 OTHER ST' } }),
  scenario({ sequence: 40, group: 'n', testCaseId: 'CAT-040-N10000', ruleId: 'N10000', code: 'DM006', rcno: { 3: 'N', 6: 'N', 70: 'U', 71: 'U', 72: 'I' }, membership: { 6: 'F' } }),
  scenario({ sequence: 41, group: 'n', testCaseId: 'CAT-041-N11000', ruleId: 'N11000', code: 'DM510', rcno: { 3: 'N', 6: 'N', 70: 'M', 71: 'M', 72: 'I' }, membership: { 6: 'F' } }),
  scenario({ sequence: 42, group: 'n', testCaseId: 'CAT-042-N12000', ruleId: 'N12000', code: 'AE999', rcno: { 3: 'N', 6: 'N', 25: 'NEW', 26: 'NEW', 27: 'I', 28: '20260201', 29: '20260201', 30: 'I' }, membership: { 1: '20260101', 8: 'OLD' } }),
  scenario({ sequence: 43, group: 'n', testCaseId: 'CAT-043-N13000', ruleId: 'N13000', code: 'AE501', rcno: { 3: 'N', 6: 'N', 25: 'NEW', 26: 'NEW', 27: 'I' }, membership: { 8: 'OLD' } }),
  scenario({ sequence: 44, group: 'n', testCaseId: 'CAT-044-N14000', ruleId: 'N14000', code: 'AE504', rcno: { 3: 'N', 6: 'N', 33: 'I' }, membership: { 2: '20270131' } }),
  scenario({ sequence: 45, group: 'n', testCaseId: 'CAT-045-N15000', ruleId: 'N15000', code: 'DM007', rcno: { 3: 'N', 6: 'N', 16: '19800101', 17: '19800101', 18: 'I' }, membership: { 17: '19800115' } }),
  scenario({ sequence: 46, group: 'n', testCaseId: 'CAT-046-N16000', ruleId: 'N16000', code: 'DM504', rcno: { 3: 'N', 6: 'N', 16: '19800115', 17: '19800115', 18: 'I' }, membership: { 17: '19800116' } }),

  scenario({ sequence: 47, group: 'fallback', testCaseId: 'CAT-047-AE_1', ruleId: 'AE-1', code: 'AE*', rcno: { 3: 'N', 26: 'OTHER' }, membership: {}, x834Eligible: false }),
  scenario({ sequence: 48, group: 'fallback', testCaseId: 'CAT-048-AC_2', ruleId: 'AC-2', code: 'AC*', rcno: { 3: 'I' }, x834Eligible: false }),
  scenario({ sequence: 49, group: 'fallback', testCaseId: 'CAT-049-DM_3', ruleId: 'DM-3', code: 'DM*', rcno: { 3: 'N', 69: 'N' }, membership: {}, x834Eligible: false }),
  scenario({ sequence: 50, group: 'fallback', testCaseId: 'CAT-050-CE_4', ruleId: 'CE-4', code: 'CE*', rcno: { 3: 'I', 29: '20260201', 32: '20260201' }, x834Eligible: false }),
  scenario({ sequence: 51, group: 'fallback', testCaseId: 'CAT-051-No_rule99999', ruleId: 'No_rule99999', code: '0000', rcno: { 3: 'X', 28: '', 29: '', 31: '', 32: '' }, x834Eligible: false }),
];

// Fill scenario-relative recent-834 SSNs after all RCNO overrides have been applied.
scenarios.forEach((item) => {
  item.recent834Records.forEach((record) => {
    if (record[0] === null) record[0] = item.rcnoRecord[22];
  });
});

export const rcnoaMockScenarioGroups = Object.entries(GROUPS).map(([key, metadata]) => ({
  ...metadata,
  key,
  scenarios: scenarios.filter((item) => item.group === key),
}));

export const rcnoaMockScenarios = scenarios;