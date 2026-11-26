jest.mock('../rcnoaBlobService.js', () => ({
  stageRcnoaArtifact: jest.fn().mockResolvedValue({
    id: 'blob-1',
    fileName: 'uploaded.rcna',
    blobName: 'input/uploaded.rcna',
  }),
}));

jest.mock('../rcnoaProcessingService.js', () => ({
  loadWorkingRcnaRecords: jest.fn(),
  processRcnoaRun: jest.fn(),
  stage834FromRcnaArtifact: jest.fn(),
}));

jest.mock('../rcnoaRepositoryService.js', () => ({
  createRcnoaRun: jest.fn(),
  createRcnoaArtifact: jest.fn(),
  getRcnoaRun: jest.fn(),
  getRcnoaBusinessConfiguration: jest.fn(),
  listRcnoaArtifacts: jest.fn(),
  savePriorRcnaRecords: jest.fn(),
  transitionRcnoaRun: jest.fn(),
}));

import { loadWorkingRcnaRecords, stage834FromRcnaArtifact } from '../rcnoaProcessingService.js';
import {
  createRcnoaArtifact,
  createRcnoaRun,
  getRcnoaRun,
  getRcnoaBusinessConfiguration,
  listRcnoaArtifacts,
  savePriorRcnaRecords,
  transitionRcnoaRun,
} from '../rcnoaRepositoryService.js';
import { generate834ForRcnoaRun, importUploadedRcna } from '../rcnoaOperationsService.js';

describe('uploaded RCNA operation', () => {
  const workingRecord = [...Array(73).fill('member'), '2', 'A200', 'decision', '', '0'];
  const carrierActionRecord = [
    ...Array(73).fill('carrier-member'),
    '2',
    'AE501',
    'Carrier to process the 834 enrollment',
    '',
    '0',
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    createRcnoaRun.mockResolvedValue({
      id: 'run-1',
      mode: 'adhoc',
      requestedBy: 'user-1',
      counts: { rcnaWritten: 0, members834Written: 0 },
    });
    createRcnoaArtifact.mockResolvedValue({ id: 'artifact-1', fileName: 'uploaded.rcna' });
    transitionRcnoaRun.mockImplementation(async (runId, update) => ({
      id: runId,
      mode: 'adhoc',
      requestedBy: 'user-1',
      counts: { rcnaWritten: 0, members834Written: 0 },
      ...update,
    }));
    getRcnoaBusinessConfiguration.mockResolvedValue({
      priorRcnaMatchKeySecret: 'test-secret-that-is-at-least-32-characters',
    });
    savePriorRcnaRecords.mockResolvedValue(1);
  });

  test('imports eligible and noneligible rows without generating an 834', async () => {
    loadWorkingRcnaRecords.mockResolvedValue([workingRecord, carrierActionRecord]);

    const result = await importUploadedRcna({
      fileName: 'uploaded.rcna',
      content: Buffer.from('content'),
      contentType: 'text/plain',
    }, '202611', 'user-1');

    expect(savePriorRcnaRecords).toHaveBeenCalledWith(
      'run-1',
      [workingRecord, carrierActionRecord],
      '202611',
      'test-secret-that-is-at-least-32-characters',
      'user-1',
    );
    expect(stage834FromRcnaArtifact).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'AWAITING_RCNA_REVIEW',
      currentStage: 'AWAITING_RCNA_REVIEW',
      counts: expect.objectContaining({ received: 2, processed: 2, rcnaWritten: 2 }),
    });
  });

  test('does not import prior evidence when RCNA validation fails', async () => {
    loadWorkingRcnaRecords.mockRejectedValue(new Error('Invalid RCNA row'));

    await expect(importUploadedRcna({
      fileName: 'uploaded.rcna',
      content: Buffer.from('content'),
      contentType: 'text/plain',
    }, '202611', 'user-1')).rejects.toThrow('Invalid RCNA row');

    expect(savePriorRcnaRecords).not.toHaveBeenCalled();
    expect(transitionRcnoaRun).toHaveBeenLastCalledWith('run-1', expect.objectContaining({
      status: 'ERROR',
      errorCode: 'RCNOA_RCNA_IMPORT_FAILED',
    }));
  });

  test('generates an 834 later from an imported RCNA run', async () => {
    getRcnoaRun.mockResolvedValue({
      id: 'run-1',
      mode: 'adhoc',
      operation: 'RCNA_IMPORT',
      requestedBy: 'user-1',
      status: 'AWAITING_RCNA_REVIEW',
      counts: { received: 1, processed: 1, rcnaWritten: 1, members834Written: 0 },
    });
    listRcnoaArtifacts.mockResolvedValue([
      { id: 'artifact-1', artifactType: 'rcna', fileName: 'uploaded.rcna' },
    ]);
    stage834FromRcnaArtifact.mockResolvedValue({ counts: { members: 1 } });

    const result = await generate834ForRcnoaRun('run-1', 'user-1');

    expect(stage834FromRcnaArtifact).toHaveBeenCalledWith(expect.objectContaining({
      rcnaArtifact: expect.objectContaining({ artifactType: 'rcna' }),
      actor: 'user-1',
    }));
    expect(result).toMatchObject({
      status: 'COMPLETE',
      currentStage: '834_GENERATED',
      counts: expect.objectContaining({ members834Written: 1, members834Skipped: 0 }),
    });
  });

  test('records the number of qualified rows skipped from the 834', async () => {
    getRcnoaRun.mockResolvedValue({
      id: 'run-1',
      mode: 'adhoc',
      operation: 'RCNA_IMPORT',
      requestedBy: 'user-1',
      status: 'AWAITING_RCNA_REVIEW',
      counts: { received: 3, processed: 3, rcnaWritten: 3, members834Written: 0 },
    });
    listRcnoaArtifacts.mockResolvedValue([
      { id: 'artifact-1', artifactType: 'rcna', fileName: 'uploaded.rcna' },
    ]);
    stage834FromRcnaArtifact.mockResolvedValue({ counts: { members: 1, skipped: 2 } });

    const result = await generate834ForRcnoaRun('run-1', 'user-1');

    expect(result.counts).toEqual(expect.objectContaining({
      members834Written: 1,
      members834Skipped: 2,
    }));
  });

  test('returns an imported run to review when later 834 generation fails', async () => {
    const importedRun = {
      id: 'run-1',
      mode: 'adhoc',
      operation: 'RCNA_IMPORT',
      requestedBy: 'user-1',
      status: 'AWAITING_RCNA_REVIEW',
      counts: { received: 1, processed: 1, rcnaWritten: 1, members834Written: 0 },
    };
    getRcnoaRun.mockResolvedValue(importedRun);
    listRcnoaArtifacts.mockResolvedValue([
      { id: 'artifact-1', artifactType: 'rcna', fileName: 'uploaded.rcna' },
    ]);
    stage834FromRcnaArtifact.mockRejectedValue(new Error('Missing approved intent'));

    await expect(generate834ForRcnoaRun('run-1', 'user-1'))
      .rejects.toThrow('Missing approved intent');

    expect(savePriorRcnaRecords).not.toHaveBeenCalled();
    expect(transitionRcnoaRun).toHaveBeenLastCalledWith('run-1', expect.objectContaining({
      status: 'AWAITING_RCNA_REVIEW',
      currentStage: 'AWAITING_RCNA_REVIEW',
      errorCode: 'RCNOA_834_GENERATION_FAILED',
    }));
  });
});