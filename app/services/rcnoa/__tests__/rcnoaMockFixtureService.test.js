import {
  listRcnoaMockFixtures,
  loadRcnoaMockFixture,
  rcnoaMockFixturesEnabled,
} from '../rcnoaMockFixtureService';
import { parseRcnoText } from '../rcnoaCore';
import { formatNoticeCodeDisplay } from '../rcnoaDecisionDisplay.js';
import { RcnoToRcnaService } from '../RcnoToRcnaService';
import { RcnaTo834Service } from '../RcnaTo834Service';
import { normalizeRcnoaAddress } from '../rcnoaAddressService';

const enabledEnvironment = { NODE_ENV: 'production', RCNOA_MOCK_FIXTURES_ENABLED: 'true' };

const N_RULE_RESULT_COLUMNS = Object.freeze({
  N1000: [9],
  N2000: [63],
  N3000: [66],
  N4000: [12],
  N5000: [15],
  'N4000-1': [12],
  'N5000-1': [15],
  N6000: [21],
  N7000: [24],
  N8000: [21],
  N9000: [24],
  N91000: [36, 39, 42, 45, 48, 51, 54],
  N92000: [36, 39, 42, 45, 48, 51, 54],
  N10000: [72],
  N11000: [72],
  N12000: [27, 30, 33],
  N13000: [27, 30, 33],
  N14000: [33],
  N15000: [18],
  N16000: [18],
});

function x12Configuration(code) {
  return {
    envelope: {
      senderQualifier: 'ZZ',
      senderId: 'TEST SENDER',
      receiverQualifier: 'ZZ',
      receiverId: 'TEST RECEIVER',
      usageIndicator: 'T',
      interchangeControlNumber: '1',
      applicationSenderCode: 'TEST SENDER',
      applicationReceiverCode: 'TEST RECEIVER',
      groupControlNumber: '1',
      transactionControlNumber: '1',
      transactionReference: 'RCNOA-MOCK',
      groupNumber: 'TEST-GROUP',
      sponsor: { name: 'TEST SPONSOR', idQualifier: 'FI', id: '111111111' },
      payer: { name: 'TEST PAYER', idQualifier: 'FI', id: '222222222' },
    },
    intentByCode: {
      [code]: {
        bgnAction: '2',
        maintenanceType: '001',
        maintenanceReason: 'AI',
        benefitStatus: 'A',
        coverageLevel: 'FAM',
      },
    },
    relationshipMap: {},
    clock: () => new Date('2026-08-10T12:00:00.000Z'),
  };
}

describe('rcnoaMockFixtureService', () => {
  test('requires explicit enablement outside development and test', () => {
    expect(rcnoaMockFixturesEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(rcnoaMockFixturesEnabled(enabledEnvironment)).toBe(true);
  });

  test('loads only manifest fixtures and verifies their transformer outcome', async () => {
    const fixtures = await listRcnoaMockFixtures(enabledEnvironment);
    expect(fixtures).toHaveLength(15);

    const coveredCatalogCases = [];

    for (const summary of fixtures) {
      const fixture = await loadRcnoaMockFixture(summary.id, enabledEnvironment);
      const rcnoRecords = parseRcnoText(fixture.rcnoText);
      const result = new RcnoToRcnaService({
        businessDate: fixture.mock.businessDate,
        n12Code: 'AE999',
        addressNormalizer: normalizeRcnoaAddress,
      }).transform({
        rcnoRecords,
        membershipRecords: fixture.mock.membershipRecords,
        recent834Records: fixture.mock.recent834Records,
        priorRcnaRecords: fixture.mock.priorRcnaRecords,
      });
      expect(fixture.checksum).toMatch(/^[a-f0-9]{64}$/);

      if (fixture.mock.expectedRows) {
        expect(fixture.rcnaOnly).toBe(true);
        expect(rcnoRecords).toHaveLength(summary.rowCount);
        expect(result.audit.map((row) => row.ruleId))
          .toEqual(fixture.mock.expectedRows.map((row) => row.ruleId));
        expect(result.workingRecords.map((row) => row[74]))
          .toEqual(fixture.mock.expectedRows.map((row) => formatNoticeCodeDisplay(row.code)));
        expect(result.audit.map((row) => row.membershipMatchCount))
          .toEqual(fixture.mock.expectedRows.map((row) => row.membershipMatchCount));
        expect(result.audit.map((row) => row.recent834MatchCount))
          .toEqual(fixture.mock.expectedRows.map((row) => row.recent834MatchCount));
        coveredCatalogCases.push(...fixture.mock.expectedRows.map((row) => row.testCaseId));
      } else {
        expect(result.audit[0].ruleId).toBe(summary.expectedRuleId);
        expect(result.workingRecords[0][74]).toBe(formatNoticeCodeDisplay(summary.expectedCode));
        const x834 = new RcnaTo834Service(x12Configuration(summary.expectedCode)).transform({
          workingRcnaRecords: result.workingRecords,
        });
        expect(x834.counts.members).toBe(1);
        expect(x834.x12).toContain('ST*834*000000001*005010X220A1~');
      }
    }

    expect(coveredCatalogCases).toHaveLength(51);
    expect(new Set(coveredCatalogCases)).toHaveProperty('size', 51);
  });

  test('suppresses every attribute-specific N rule when its result column is not I', async () => {
    const fixture = await loadRcnoaMockFixture('complete-n-rules', enabledEnvironment);
    const rcnoRecords = parseRcnoText(fixture.rcnoText);
    const gatedRows = fixture.mock.expectedRows.filter(
      ({ ruleId }) => ruleId !== 'N0000' && ruleId !== 'N5000-2',
    );

    expect(gatedRows.map(({ ruleId }) => ruleId).sort())
      .toEqual(Object.keys(N_RULE_RESULT_COLUMNS).sort());

    gatedRows.forEach(({ sourceRow, ruleId }) => {
      const record = [...rcnoRecords[sourceRow - 1]];
      N_RULE_RESULT_COLUMNS[ruleId].forEach((index) => {
        record[index] = 'M';
      });

      const result = new RcnoToRcnaService({
        businessDate: fixture.mock.businessDate,
        n12Code: 'AE999',
        addressNormalizer: normalizeRcnoaAddress,
      }).transform({
        rcnoRecords: [record],
        membershipRecords: fixture.mock.membershipRecords,
        recent834Records: fixture.mock.recent834Records,
        priorRcnaRecords: fixture.mock.priorRcnaRecords,
      });

      expect(result.audit[0].ruleId).not.toBe(ruleId);
    });
  });

  test('does not allow arbitrary fixture paths', async () => {
    await expect(loadRcnoaMockFixture('../manifest', enabledEnvironment))
      .rejects.toThrow('not found');
  });
});