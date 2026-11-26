import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

jest.mock('../../blobStorageService.js', () => ({
  generateTemporaryDownloadLink: jest.fn(),
  generateTemporaryUploadLink: jest.fn(),
  getBlockBlobClient: jest.fn(),
  writeFileBufferToBlobStorage: jest.fn(),
}));

import {
  createRcnoaUploadTarget,
  deleteRcnoaArtifactBlob,
  readRcnoaArtifactText,
  rcnoaLocalArtifactPath,
  stageRcnoaArtifact,
} from '../rcnoaBlobService.js';

describe('rcnoaBlobService local testing', () => {
  let outputDirectory;
  const originalEnvironment = { ...process.env };

  beforeEach(async () => {
    outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'rcnoa-output-'));
    process.env.RCNOA_LOCAL_TESTING = 'true';
    process.env.RCNOA_LOCAL_OUTPUT_DIR = outputDirectory;
  });

  afterEach(async () => {
    process.env = { ...originalEnvironment };
    await rm(outputDirectory, { recursive: true, force: true });
  });

  test('writes, reads, and deletes output artifacts on local disk', async () => {
    const artifact = await stageRcnoaArtifact({
      mode: 'adhoc',
      nuid: 'A123456',
      runId: '12345678-1234-1234-1234-123456789abc',
      direction: 'output',
      fileName: 'sample.rcna.txt',
      content: 'RCNA content',
    });
    const artifactPath = rcnoaLocalArtifactPath(artifact.blobName);

    await expect(readFile(artifactPath, 'utf-8')).resolves.toBe('RCNA content');
    await expect(readRcnoaArtifactText(artifact)).resolves.toBe('RCNA content');
    await expect(deleteRcnoaArtifactBlob(artifact)).resolves.toEqual({ succeeded: true });
    await expect(readFile(artifactPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('writes input artifacts locally without requesting an Azure upload', async () => {
    const artifact = await stageRcnoaArtifact({
      mode: 'adhoc',
      nuid: 'A123456',
      runId: '12345678-1234-1234-1234-123456789abc',
      direction: 'input',
      fileName: 'sample.rcno.txt',
      content: 'RCNO content',
    });

    await expect(readRcnoaArtifactText(artifact)).resolves.toBe('RCNO content');
    await expect(createRcnoaUploadTarget({
      runId: '12345678-1234-1234-1234-123456789abc',
      nuid: 'A123456',
      fileName: 'sample.rcno.txt',
    })).rejects.toThrow('Direct Azure uploads are disabled');
  });
});