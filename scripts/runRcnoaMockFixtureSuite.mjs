import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeRcnoaAddress } from '../app/services/rcnoa/rcnoaAddressService.js';
import { parseRcnoText, serializeRcnoaRecords } from '../app/services/rcnoa/rcnoaCore.js';
import {
  listRcnoaMockFixtures,
  loadRcnoaMockFixture,
} from '../app/services/rcnoa/rcnoaMockFixtureService.js';
import { RcnaTo834Service } from '../app/services/rcnoa/RcnaTo834Service.js';
import { RcnoToRcnaService } from '../app/services/rcnoa/RcnoToRcnaService.js';

const enabledEnvironment = { NODE_ENV: 'test', RCNOA_MOCK_FIXTURES_ENABLED: 'true' };

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function sanitizeError(error) {
  return String(error?.message || error || 'Unknown fixture execution error')
    .replace(/\b\d{9}\b/g, '[REDACTED]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 1000);
}

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

function compareRows(expectedRows, result) {
  return expectedRows.map((expected, index) => {
    const audit = result.audit[index];
    const workingRecord = result.workingRecords[index];
    const actual = audit && workingRecord ? {
      ruleId: audit.ruleId,
      code: workingRecord[74],
      membershipMatchCount: audit.membershipMatchCount,
      recent834MatchCount: audit.recent834MatchCount,
    } : null;
    const checks = {
      ruleId: actual?.ruleId === expected.ruleId,
      code: actual?.code === expected.code,
      membershipMatchCount: expected.membershipMatchCount === undefined
        || actual?.membershipMatchCount === expected.membershipMatchCount,
      recent834MatchCount: expected.recent834MatchCount === undefined
        || actual?.recent834MatchCount === expected.recent834MatchCount,
    };
    return {
      sourceRow: index + 1,
      testCaseId: expected.testCaseId || null,
      expected: {
        ruleId: expected.ruleId,
        code: expected.code,
        membershipMatchCount: expected.membershipMatchCount,
        recent834MatchCount: expected.recent834MatchCount,
      },
      actual,
      checks,
      passed: Object.values(checks).every(Boolean),
    };
  });
}

async function executeFixture(summary, outputDirectory) {
  const fixtureDirectory = path.join(outputDirectory, 'fixtures', summary.id);
  await fs.mkdir(fixtureDirectory, { recursive: true });
  const startedAt = new Date();
  const comparison = {
    fixtureId: summary.id,
    label: summary.label,
    ruleFamily: summary.ruleFamily,
    rcnaOnly: summary.rcnaOnly,
    expectedRowCount: summary.rowCount,
    checksum: null,
    rows: [],
    rcna: { status: 'NOT_RUN', file: null },
    x834: { status: summary.rcnaOnly ? 'NOT_APPLICABLE' : 'NOT_RUN', file: null },
    passed: false,
    error: null,
    startedAt: startedAt.toISOString(),
    completedAt: null,
    durationMs: 0,
  };

  try {
    const fixture = await loadRcnoaMockFixture(summary.id, enabledEnvironment);
    comparison.checksum = fixture.checksum;
    await fs.writeFile(path.join(fixtureDirectory, 'input.rcno'), fixture.rcnoText, 'utf8');
    const rcnoRecords = parseRcnoText(fixture.rcnoText);
    const service = new RcnoToRcnaService({
      businessDate: fixture.mock.businessDate,
      n12Code: 'AE999',
      addressNormalizer: normalizeRcnoaAddress,
    });
    const result = service.transform({
      rcnoRecords,
      membershipRecords: fixture.mock.membershipRecords,
      recent834Records: fixture.mock.recent834Records,
      priorRcnaRecords: fixture.mock.priorRcnaRecords,
    });
    const expectedRows = fixture.mock.expectedRows || [{
      sourceRow: 1,
      testCaseId: null,
      ruleId: fixture.expectedRuleId,
      code: fixture.expectedCode,
    }];
    comparison.rows = compareRows(expectedRows, result);
    const widthsValid = result.workingRecords.every((record) => record.length === 78)
      && result.outboundRecords.every((record) => record.length === 76);
    const rowCountsValid = rcnoRecords.length === summary.rowCount
      && result.workingRecords.length === summary.rowCount
      && result.outboundRecords.length === summary.rowCount
      && comparison.rows.length === summary.rowCount;
    const rcnaFile = path.join(fixtureDirectory, 'actual.rcna');
    await fs.writeFile(rcnaFile, serializeRcnoaRecords(result.outboundRecords), 'utf8');
    comparison.rcna = {
      status: widthsValid && rowCountsValid && comparison.rows.every((row) => row.passed)
        ? 'PASSED'
        : 'FAILED',
      file: 'actual.rcna',
      workingRowCount: result.workingRecords.length,
      outboundRowCount: result.outboundRecords.length,
      widthsValid,
      rowCountsValid,
    };

    if (!fixture.rcnaOnly) {
      const code = result.workingRecords[0][74];
      const x834 = new RcnaTo834Service(x12Configuration(code)).transform({
        workingRcnaRecords: result.workingRecords,
      });
      await fs.writeFile(path.join(fixtureDirectory, 'actual.834.x12'), x834.x12, 'utf8');
      comparison.x834 = {
        status: x834.counts.members === result.workingRecords.length ? 'PASSED' : 'FAILED',
        file: 'actual.834.x12',
        counts: x834.counts,
      };
    }

    comparison.passed = comparison.rcna.status === 'PASSED'
      && ['PASSED', 'NOT_APPLICABLE'].includes(comparison.x834.status);
  } catch (error) {
    comparison.error = sanitizeError(error);
    comparison.rcna.status = comparison.rcna.status === 'NOT_RUN' ? 'FAILED' : comparison.rcna.status;
    if (!summary.rcnaOnly && comparison.x834.status === 'NOT_RUN') comparison.x834.status = 'FAILED';
  }

  const completedAt = new Date();
  comparison.completedAt = completedAt.toISOString();
  comparison.durationMs = completedAt.getTime() - startedAt.getTime();
  await fs.writeFile(
    path.join(fixtureDirectory, 'comparison.json'),
    `${JSON.stringify(comparison, null, 2)}\n`,
    'utf8',
  );
  return comparison;
}

async function main() {
  const outputArgument = argumentValue('--output');
  if (!outputArgument) throw new Error('--output is required');
  const outputDirectory = path.resolve(outputArgument);
  await fs.mkdir(path.join(outputDirectory, 'raw'), { recursive: true });
  await fs.mkdir(path.join(outputDirectory, 'fixtures'), { recursive: true });

  const startedAt = new Date();
  const fixtures = await listRcnoaMockFixtures(enabledEnvironment);
  const results = [];
  for (const fixture of fixtures) {
    results.push(await executeFixture(fixture, outputDirectory));
  }
  const completedAt = new Date();
  const catalogRows = results.flatMap((fixture) => fixture.rows)
    .filter((row) => row.testCaseId);
  const summary = {
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    fixtureCount: results.length,
    passedFixtureCount: results.filter((fixture) => fixture.passed).length,
    failedFixtureCount: results.filter((fixture) => !fixture.passed).length,
    transformedRowCount: results.reduce((total, fixture) => total + fixture.rows.length, 0),
    catalogCaseCount: catalogRows.length,
    uniqueCatalogCaseCount: new Set(catalogRows.map((row) => row.testCaseId)).size,
    passedCatalogCaseCount: catalogRows.filter((row) => row.passed).length,
    rcnaFileCount: results.filter((fixture) => fixture.rcna.file).length,
    x834FileCount: results.filter((fixture) => fixture.x834.file).length,
    passed: results.length === 15
      && results.every((fixture) => fixture.passed)
      && catalogRows.length === 51
      && new Set(catalogRows.map((row) => row.testCaseId)).size === 51,
    fixtures: results,
  };
  await fs.writeFile(
    path.join(outputDirectory, 'raw', 'fixture-execution.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `Executed ${summary.fixtureCount} fixtures and ${summary.transformedRowCount} rows: `
    + `${summary.passedFixtureCount} passed, ${summary.failedFixtureCount} failed`,
  );
  if (!summary.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(sanitizeError(error));
  process.exitCode = 1;
});