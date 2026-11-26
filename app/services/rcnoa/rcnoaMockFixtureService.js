import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseRcnoText } from './rcnoaCore.js';

const FIXTURE_DIRECTORY = path.join(process.cwd(), 'docs', 'rcnoa', 'testFiles');
const MANIFEST_PATH = path.join(FIXTURE_DIRECTORY, 'manifest.json');

export function rcnoaMockFixturesEnabled(environment = process.env) {
  return environment.RCNOA_MOCK_FIXTURES_ENABLED === 'true'
    || environment.NODE_ENV === 'development'
    || environment.NODE_ENV === 'test';
}

async function readManifest() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  if (!manifest || !Array.isArray(manifest.fixtures)) {
    throw new Error('RCNOA mock fixture manifest is invalid');
  }
  return manifest;
}

export async function listRcnoaMockFixtures(environment = process.env) {
  if (!rcnoaMockFixturesEnabled(environment)) return [];
  const manifest = await readManifest();
  return manifest.fixtures.map((fixture) => ({
    id: fixture.id,
    label: fixture.label,
    version: fixture.version,
    fileName: fixture.rcnoFile,
    expectedRuleId: fixture.expectedRuleId,
    expectedCode: fixture.expectedCode,
    rowCount: fixture.rowCount || 1,
    ruleFamily: fixture.ruleFamily || null,
    rcnaOnly: fixture.rcnaOnly === true,
  }));
}

function validateExpectedRows(fixture, mock, rcnoText) {
  if (!fixture.rowCount) return;
  const rcnoRecords = parseRcnoText(rcnoText);
  if (
    rcnoRecords.length !== fixture.rowCount
    || !Array.isArray(mock.expectedRows)
    || mock.expectedRows.length !== fixture.rowCount
  ) {
    throw new Error('RCNOA multi-row mock fixture row count is invalid');
  }
  const testCaseIds = new Set();
  mock.expectedRows.forEach((row, index) => {
    if (
      row?.sourceRow !== index + 1
      || typeof row.testCaseId !== 'string'
      || typeof row.ruleId !== 'string'
      || typeof row.code !== 'string'
      || testCaseIds.has(row.testCaseId)
    ) {
      throw new Error('RCNOA multi-row mock fixture expectations are invalid');
    }
    testCaseIds.add(row.testCaseId);
  });
  if (
    !Array.isArray(fixture.catalogCaseIds)
    || fixture.catalogCaseIds.join('\0') !== mock.expectedRows.map((row) => row.testCaseId).join('\0')
    || mock.ruleFamily !== fixture.ruleFamily
    || mock.rcnaOnly !== fixture.rcnaOnly
  ) {
    throw new Error('RCNOA multi-row mock fixture metadata is invalid');
  }
}

export async function loadRcnoaMockFixture(fixtureId, environment = process.env) {
  if (!rcnoaMockFixturesEnabled(environment)) {
    throw new Error('RCNOA mock fixtures are not enabled in this environment');
  }
  const manifest = await readManifest();
  const fixture = manifest.fixtures.find((item) => item.id === fixtureId);
  if (!fixture) throw new Error('RCNOA mock fixture not found');

  const [rcnoText, mockText] = await Promise.all([
    fs.readFile(path.join(FIXTURE_DIRECTORY, fixture.rcnoFile), 'utf8'),
    fs.readFile(path.join(FIXTURE_DIRECTORY, fixture.mockFile), 'utf8'),
  ]);
  const mock = JSON.parse(mockText);
  if (mock.fixtureId !== fixture.id || !Array.isArray(mock.membershipRecords)
    || !Array.isArray(mock.recent834Records) || !Array.isArray(mock.priorRcnaRecords)) {
    throw new Error('RCNOA mock fixture response is invalid');
  }
  validateExpectedRows(fixture, mock, rcnoText);
  const checksum = createHash('sha256').update(rcnoText).update('\0').update(mockText).digest('hex');
  return {
    id: fixture.id,
    label: fixture.label,
    version: fixture.version,
    fileName: fixture.rcnoFile,
    expectedRuleId: fixture.expectedRuleId,
    expectedCode: fixture.expectedCode,
    rowCount: fixture.rowCount || 1,
    ruleFamily: fixture.ruleFamily || null,
    rcnaOnly: fixture.rcnaOnly === true,
    checksum,
    rcnoText,
    mock,
  };
}