import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeAmbiguousMembershipRows } from '../rcnoaFailureDiagnosticService.js';

describe('rcnoaFailureDiagnosticService', () => {
  let outputDirectory;

  beforeEach(async () => {
    outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'rcnoa-failures-'));
  });

  afterEach(async () => {
    await rm(outputDirectory, { recursive: true, force: true });
  });

  test('writes only rows that failed with conflicting duplicate membership candidates', async () => {
    const records = [
      Array(73).fill('row-1'),
      Array(73).fill('row-2'),
      Array(73).fill('row-3'),
    ];

    const filePath = await writeAmbiguousMembershipRows({
      runId: 'run-123',
      rcnoRecords: records,
      failures: [
        { sourceRowNumber: 1, errorCode: 'RCNO_ROW_TRANSFORM_FAILED' },
        { sourceRowNumber: 2, errorCode: 'AMBIGUOUS_LOOKUP_DUPLICATE' },
        { sourceRowNumber: 3, errorCode: 'AMBIGUOUS_LOOKUP_DUPLICATE' },
      ],
      environment: { RCNOA_LOCAL_OUTPUT_DIR: outputDirectory },
    });

    expect(filePath).toBe(path.join(
      outputDirectory,
      'diagnostics',
      'run-123-conflicting-duplicate-membership.rcno',
    ));
    expect(await readFile(filePath, 'utf-8')).toBe(
      `${records[1].join('|')}\r\n${records[2].join('|')}\r\n`,
    );
  });

  test('does not create a file when the ambiguity error is absent', async () => {
    await expect(writeAmbiguousMembershipRows({
      runId: 'run-123',
      rcnoRecords: [Array(73).fill('row-1')],
      failures: [{ sourceRowNumber: 1, errorCode: 'RCNO_ROW_TRANSFORM_FAILED' }],
      environment: { RCNOA_LOCAL_OUTPUT_DIR: outputDirectory },
    })).resolves.toBeNull();
  });
});