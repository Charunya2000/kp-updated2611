jest.mock('../blobStorageService', () => ({
  generateTemporaryDownloadLink: jest.fn(),
  writeFileBufferToBlobStorage: jest.fn(),
}));

import { createValidationWorkbook } from '../ediValidationReportArtifactService';

describe('EDI validation report workbook', () => {
  test('projects the canonical report into summary, findings, and subscriber sheets', async () => {
    const report = {
      'validation-summary': {
        total: 12,
        passed: 10,
        failed: 2,
        lookup: { total: 4, passed: 2, failed: 1, skipped: 1 },
      },
      'invalid-findings': [{
        'subscriber-index': 1,
        'subscriber-key': '001234567',
        segment: 'REF',
        ref: 'REF02',
        'failed-value': '00123',
        reason: 'Not found',
        'loop-name': '2000',
        'loop-description': 'Member Level Detail',
      }],
      'subscriber-statuses': [{
        'subscriber-index': 1,
        'subscriber-key': '001234567',
        status: 'completed-failed',
        'structure-total': 8,
        'structure-passed': 7,
        'structure-failed': 1,
        'db-attempted': 4,
        'db-passed': 2,
        'db-failed': 1,
        'db-skipped': 1,
        'started-at': '2026-09-09T14:00:00Z',
        'completed-at': '2026-09-09T14:01:00Z',
      }],
      report: {
        'run-id': '00001234',
        'started-at': '2026-09-09T14:00:00Z',
      },
    };

    const workbook = await createValidationWorkbook(report, {
      completedAt: '2026-09-09T14:01:00Z',
      ediDisplayName: 'input.edi',
      companionDisplayName: 'guide.csv',
    });

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Summary',
      'Invalid Findings',
      'Subscriber Statuses',
    ]);

    const summary = workbook.getWorksheet('Summary');
    expect(summary.getCell('B2').value).toBe(12);
    expect(summary.getCell('B9').value).toBe('00001234');
    expect(summary.getCell('B9').numFmt).toBe('@');

    const findings = workbook.getWorksheet('Invalid Findings');
    expect(findings.getCell('B2').value).toBe('001234567');
    expect(findings.getCell('E2').value).toBe('00123');
    expect(findings.getCell('B2').numFmt).toBe('@');
    expect(findings.getCell('E2').numFmt).toBe('@');

    const statuses = workbook.getWorksheet('Subscriber Statuses');
    expect(statuses.getCell('B2').value).toBe('001234567');
    expect(statuses.getCell('D2').value).toBe(8);
    expect(statuses.getCell('K2').value).toBe('2026-09-09T14:00:00Z');
    expect(statuses.getCell('K2').numFmt).toBe('@');

    await expect(workbook.xlsx.writeBuffer()).resolves.toBeDefined();
    expect(() => JSON.stringify(report, null, 2)).not.toThrow();
  });

  test('does not include parsed or enriched trees as worksheets', async () => {
    const workbook = await createValidationWorkbook({
      'validation-summary': {},
      'invalid-findings': [],
      'subscriber-statuses': [],
      parsed: { sensitive: true },
      enriched: { sensitive: true },
    });

    expect(workbook.getWorksheet('Parsed')).toBeUndefined();
    expect(workbook.getWorksheet('Enriched')).toBeUndefined();
  });
});
