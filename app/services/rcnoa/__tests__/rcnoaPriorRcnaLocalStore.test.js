import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

jest.mock('../../../../db/connection.js', () => ({
  connectToDatabase: jest.fn(() => {
    throw new Error('MongoDB must not be accessed during RCNOA local testing');
  }),
}));

import {
  loadPriorRcnaRecords,
  localPriorRcnaFilePath,
  savePriorRcnaRecords,
} from '../rcnoaRepositoryService.js';
import { parseRcnaText, prepareUploadedRcnaPriorRecords } from '../rcnoaCore.js';

describe('local prior RCNA store', () => {
  let outputDirectory;
  const originalEnvironment = { ...process.env };

  beforeEach(async () => {
    outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'rcnoa-prior-'));
    process.env.RCNOA_LOCAL_TESTING = 'true';
    process.env.RCNOA_LOCAL_OUTPUT_DIR = outputDirectory;
  });

  afterEach(async () => {
    process.env = { ...originalEnvironment };
    await rm(outputDirectory, { recursive: true, force: true });
  });

  test('saves decision data locally and reconstructs matching prior records', async () => {
    const currentRecord = Array.from({ length: 73 }, (_, index) => `value-${index}`);
    const workingRecord = [
      ...currentRecord,
      '3: Active Demographic Mismatches',
      'A100',
      'Matches',
      'local note',
      '2',
    ];

    await expect(savePriorRcnaRecords(
      'run-1',
      [workingRecord],
      '202609',
      'local-test-secret',
      'local-user',
    )).resolves.toBe(1);

    const store = JSON.parse(await readFile(localPriorRcnaFilePath(), 'utf-8'));
    expect(store.records).toHaveLength(1);
    expect(store.records[0]).toMatchObject({
      parentId: 'run-1',
      reconciliationCycle: '202609',
      priority: '3: Active Demographic Mismatches',
      noticeCode: 'A100',
      noticeDescription: 'Matches',
      notes: 'local note',
      ageMonths: 2,
    });
    expect(JSON.stringify(store)).not.toContain('value-0');

    await expect(loadPriorRcnaRecords(
      [currentRecord],
      '202609',
      'local-test-secret',
    )).resolves.toEqual([workingRecord]);
  });

  test('upserts matching records and keeps reconciliation cycles separate', async () => {
    const prefix = Array(73).fill('member');
    await savePriorRcnaRecords(
      'run-1',
      [[...prefix, '1: Active Enrollment mismatch', 'A100', 'first', '', '0']],
      '202609',
      'local-test-secret',
      'local-user',
    );
    await savePriorRcnaRecords(
      'run-2',
      [[...prefix, '2: Active Carrier Enrollment Mismatch', 'A200', 'second', '', '1']],
      '202609',
      'local-test-secret',
      'local-user',
    );
    await savePriorRcnaRecords(
      'run-3',
      [[...prefix, '3: Active Demographic Mismatches', 'A300', 'third', '', '2']],
      '202610',
      'local-test-secret',
      'local-user',
    );

    const store = JSON.parse(await readFile(localPriorRcnaFilePath(), 'utf-8'));
    expect(store.records).toHaveLength(2);
    await expect(loadPriorRcnaRecords([prefix], '202609', 'local-test-secret'))
      .resolves.toEqual([[...prefix, '2: Active Carrier Enrollment Mismatch', 'A200', 'second', '', '1']]);
  });

  test('makes an uploaded 76-column RCNA available only in its selected cycle', async () => {
    const prefix = Array.from({ length: 73 }, (_, index) => `uploaded-${index}`);
    const outboundRecord = [
      ...prefix,
      '2: Active Carrier Enrollment Mismatch',
      'A200',
      'Uploaded prior decision',
    ];
    const workingRecords = prepareUploadedRcnaPriorRecords(
      parseRcnaText(outboundRecord.join('|')),
    );

    await savePriorRcnaRecords(
      'upload-run',
      workingRecords,
      '202611',
      'local-test-secret',
      'local-user',
    );

    await expect(loadPriorRcnaRecords([prefix], '202611', 'local-test-secret'))
      .resolves.toEqual([[
        ...outboundRecord,
        '',
        '0',
      ]]);
    await expect(loadPriorRcnaRecords([prefix], '202612', 'local-test-secret'))
      .resolves.toEqual([]);
  });
});