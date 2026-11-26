import fs from 'node:fs/promises';
import path from 'node:path';
import { RcnoToRcnaService } from '../app/services/rcnoa/RcnoToRcnaService.js';
import { formatNoticeCodeDisplay } from '../app/services/rcnoa/rcnoaDecisionDisplay.js';
import {
  normalizeRcnoaAddress,
  RCNOA_MOCK_BUSINESS_DATE,
  rcnoaMockScenarioGroups,
  rcnoaMockScenarios,
} from './rcnoaMockScenarioDefinitions.mjs';

const outputDirectory = path.join(process.cwd(), 'docs', 'rcnoa', 'testFiles');
const businessDate = '20260810';

function baseRcno() {
  const record = Array(73).fill('');
  const values = {
    0: '01', 1: 'EMP000001', 2: 'EMP000001', 3: 'M', 4: 'MRN001', 5: 'MRN001', 6: 'M',
    7: 'ANN001', 8: 'ANN001', 9: 'M', 10: 'TESTER', 11: 'TESTER', 12: 'M',
    13: 'ALEX', 14: 'ALEX', 15: 'M', 16: '19800102', 17: '19800102', 18: 'M',
    19: '111223333', 20: '111223333', 21: 'M', 22: '111223333', 23: '111223333', 24: 'M',
    25: 'ABC', 26: 'ABC', 27: 'M', 28: '20260101', 29: '20260101', 30: 'M',
    31: '20261231', 32: '20261231', 33: 'M', 34: '100 TEST ST', 35: '100 TEST ST', 36: 'M',
    39: 'M', 42: 'M', 43: 'TEST CITY', 44: 'TEST CITY', 45: 'M', 46: 'CA', 47: 'CA', 48: 'M',
    49: '90001', 50: '90001', 51: 'M', 52: 'US', 53: 'US', 54: 'M',
    55: '5550100100', 56: '5550100100', 57: 'M',
    58: 'alex.tester@example.invalid', 59: 'alex.tester@example.invalid', 60: 'M',
    61: 'PO123', 62: 'PO123', 63: 'M', 64: '18', 65: '18', 66: 'M',
    69: 'M', 70: 'F', 71: 'F', 72: 'M',
  };
  Object.entries(values).forEach(([index, value]) => { record[Number(index)] = value; });
  return record;
}

function membership(overrides = {}) {
  const record = [
    'MRN001', '20260101', '20261231', 'ALEX', 'TESTER', '111223333', 'F', '18', 'ABC',
    'ANN001', 'PO123', 'N', 'N', '46', 'Y', '111223333', '', '19800102', '',
  ];
  Object.entries(overrides).forEach(([index, value]) => { record[Number(index)] = value; });
  return record;
}

function fixture({ id, label, ruleId, code, rcno = {}, membershipRecords = [], recent834Records = [], prior }) {
  const rcnoRecord = baseRcno();
  Object.entries(rcno).forEach(([index, value]) => { rcnoRecord[Number(index)] = value; });
  const priorRcnaRecords = prior ? [[...rcnoRecord, ...prior]] : [];
  return {
    id,
    label,
    expectedRuleId: ruleId,
    expectedCode: code,
    rcnoRecord,
    mock: { businessDate, membershipRecords, recent834Records, priorRcnaRecords },
  };
}

const fixtures = [
  fixture({ id: 'a100-perfect-match', label: 'A100 - Perfect match', ruleId: 'A100', code: 'MM' }),
  fixture({
    id: 'b200-prior-reuse', label: 'B200 - Reuse prior decision', ruleId: 'B200', code: 'DM501',
    rcno: { 3: 'N' }, prior: ['3', 'DM501', 'Carrier to update member field', 'prior fixture', '4'],
  }),
  fixture({
    id: 'f13000-processed-834', label: 'F13000 - Missing membership, processed 834',
    ruleId: 'F13000', code: 'AE500', rcno: { 3: 'F' },
    recent834Records: [['111223333', '20260101', '20261231', 'Y']],
  }),
  fixture({
    id: 'f14000-unprocessed-834', label: 'F14000 - Missing membership, unprocessed 834',
    ruleId: 'F14000', code: 'AE501', rcno: { 3: 'F' },
    recent834Records: [['111223333', '20260101', '20261231', 'N']],
  }),
  ...[
    ['i4000-active-processed', 'I4000 - Active membership, processed 834', 'Y', '20261231', 'I4000', 'AC500'],
    ['i5000-inactive-processed', 'I5000 - Inactive membership, processed 834', 'Y', '20260731', 'I5000', 'CE500'],
    ['i6000-active-unprocessed', 'I6000 - Active membership, unprocessed 834', 'N', '20261231', 'I6000', 'AC501'],
    ['i7000-inactive-unprocessed', 'I7000 - Inactive membership, unprocessed 834', 'N', '20260731', 'I7000', 'CE501'],
  ].map(([id, label, processed, memberEnd, ruleId, code]) => fixture({
    id, label, ruleId, code,
    rcno: { 3: 'I', 29: '20260101', 32: '20260731' },
    membershipRecords: [membership({ 2: memberEnd })],
    recent834Records: [['111223333', '20260101', '20260731', processed]],
  })),
  fixture({
    id: 'n0000-missing-membership', label: 'N0000 - MRN not found', ruleId: 'N0000', code: 'KICKO',
    rcno: { 3: 'N', 5: 'MRN-NOT-FOUND', 6: 'N' },
  }),
  fixture({
    id: 'n12000-manual-review', label: 'N12000 - Manual business review', ruleId: 'N12000', code: 'AE999',
    rcno: { 3: 'N', 6: 'N', 25: 'NEW', 27: 'I', 28: '20260201', 30: 'I' },
    membershipRecords: [membership()],
  }),
];

await fs.mkdir(outputDirectory, { recursive: true });
const manifest = { version: '1.0.0', fixtures: [] };

for (const item of fixtures) {
  const result = new RcnoToRcnaService({ businessDate, n12Code: 'AE999' }).transform({
    rcnoRecords: [item.rcnoRecord],
    ...item.mock,
  });
  const actualRuleId = result.audit[0].ruleId;
  const actualCode = result.workingRecords[0][74];
  if (
    actualRuleId !== item.expectedRuleId
    || actualCode !== formatNoticeCodeDisplay(item.expectedCode)
  ) {
    throw new Error(`${item.id} produced ${actualRuleId}/${actualCode}, expected ${item.expectedRuleId}/${item.expectedCode}`);
  }

  const rcnoFile = `${item.id}.rcno`;
  const mockFile = `${item.id}.mock.json`;
  await fs.writeFile(path.join(outputDirectory, rcnoFile), `${item.rcnoRecord.join('|')}\r\n`, 'utf8');
  await fs.writeFile(path.join(outputDirectory, mockFile), `${JSON.stringify({
    fixtureId: item.id,
    version: '1.0.0',
    ...item.mock,
    expected: { ruleId: item.expectedRuleId, code: item.expectedCode },
  }, null, 2)}\n`, 'utf8');
  manifest.fixtures.push({
    id: item.id,
    label: item.label,
    version: '1.0.0',
    rcnoFile,
    mockFile,
    expectedRuleId: item.expectedRuleId,
    expectedCode: item.expectedCode,
  });
}

const completeSuitePath = path.join(process.cwd(), 'docs', 'rcnoa', 'RCNO-RCNA-Complete-TestCases.json');
const completeSuite = JSON.parse(await fs.readFile(completeSuitePath, 'utf8'));
const catalogCases = completeSuite.testCases.filter((testCase) => testCase.category === 'rule-catalog');
const scenarioIds = rcnoaMockScenarios.map((item) => item.testCaseId);
const catalogIds = catalogCases.map((item) => item.id);
if (
  scenarioIds.length !== 51
  || new Set(scenarioIds).size !== scenarioIds.length
  || JSON.stringify(scenarioIds) !== JSON.stringify(catalogIds)
) {
  throw new Error('Broad-coverage scenarios must match all 51 catalog cases in source order');
}

for (const item of rcnoaMockScenarios) {
  const catalogCase = catalogCases.find((testCase) => testCase.id === item.testCaseId);
  if (
    catalogCase.expected.selectedRuleId !== item.expectedRuleId
    || catalogCase.expected.workingRcna.PSHB_Code !== formatNoticeCodeDisplay(item.expectedCode)
  ) {
    throw new Error(`${item.testCaseId} does not match the complete test-case catalog expectation`);
  }
}

for (const group of rcnoaMockScenarioGroups) {
  const membershipRecords = group.scenarios.flatMap((item) => item.membershipRecords);
  const recent834Records = group.scenarios.flatMap((item) => item.recent834Records);
  const priorRcnaRecords = group.scenarios.flatMap((item) => item.priorRcnaRecords);
  const service = new RcnoToRcnaService({
    businessDate: RCNOA_MOCK_BUSINESS_DATE,
    n12Code: 'AE999',
    addressNormalizer: normalizeRcnoaAddress,
  });
  const result = service.transform({
    rcnoRecords: group.scenarios.map((item) => item.rcnoRecord),
    membershipRecords,
    recent834Records,
    priorRcnaRecords,
  });
  const expectedRows = group.scenarios.map((item, index) => {
    const actualRuleId = result.audit[index].ruleId;
    const actualCode = result.workingRecords[index][74];
    if (
      actualRuleId !== item.expectedRuleId
      || actualCode !== formatNoticeCodeDisplay(item.expectedCode)
    ) {
      throw new Error(
        `${item.testCaseId} produced ${actualRuleId}/${actualCode}, `
        + `expected ${item.expectedRuleId}/${item.expectedCode}`,
      );
    }
    return {
      sourceRow: index + 1,
      testCaseId: item.testCaseId,
      ruleId: item.expectedRuleId,
      code: item.expectedCode,
      x834Eligible: item.x834Eligible,
      membershipMatchCount: result.audit[index].membershipMatchCount,
      recent834MatchCount: result.audit[index].recent834MatchCount,
    };
  });

  const rcnoFile = `${group.id}.rcno`;
  const mockFile = `${group.id}.mock.json`;
  const rcnoText = group.scenarios.map((item) => item.rcnoRecord.join('|')).join('\r\n') + '\r\n';
  const mock = {
    fixtureId: group.id,
    version: '1.0.0',
    businessDate: RCNOA_MOCK_BUSINESS_DATE,
    ruleFamily: group.key,
    rcnaOnly: true,
    membershipRecords,
    recent834Records,
    priorRcnaRecords,
    expectedRows,
  };
  await fs.writeFile(path.join(outputDirectory, rcnoFile), rcnoText, 'utf8');
  await fs.writeFile(path.join(outputDirectory, mockFile), `${JSON.stringify(mock, null, 2)}\n`, 'utf8');
  manifest.fixtures.push({
    id: group.id,
    label: group.label,
    version: '1.0.0',
    rcnoFile,
    mockFile,
    rowCount: group.scenarios.length,
    ruleFamily: group.key,
    rcnaOnly: true,
    catalogCaseIds: group.scenarios.map((item) => item.testCaseId),
  });
}

await fs.writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(
  `Generated ${fixtures.length} focused and ${rcnoaMockScenarioGroups.length} broad-coverage `
  + `RCNOA mock fixtures in ${outputDirectory}`,
);