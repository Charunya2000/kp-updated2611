import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  generateTemporaryDownloadLink,
  generateTemporaryUploadLink,
  getBlockBlobClient,
  writeFileBufferToBlobStorage,
} from '../blobStorageService.js';
import { buildRcnoaBlobName, RCNOA_DEFAULTS, sanitizeFileName } from './rcnoaCore.js';

export const RCNOA_BLOB_CONTAINER = 'rcnoa-processing';
const LOCAL_OUTPUT_DIRECTORY = 'rcnoa-local-output';

export function isRcnoaLocalTesting(environment = process.env) {
  return String(environment.RCNOA_LOCAL_TESTING).toLowerCase() === 'true';
}

export function rcnoaLocalArtifactPath(blobName, environment = process.env) {
  if (!blobName?.startsWith('rcnoa-processing/')) {
    throw new Error('Invalid local RCNOA artifact location');
  }
  const root = path.resolve(
    process.cwd(),
    environment.RCNOA_LOCAL_OUTPUT_DIR || LOCAL_OUTPUT_DIRECTORY,
  );
  const artifactPath = path.resolve(root, ...blobName.split('/'));
  if (!artifactPath.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid local RCNOA artifact location');
  }
  return artifactPath;
}

function usesLocalStorage(blobName) {
  return isRcnoaLocalTesting() && blobName?.startsWith('rcnoa-processing/');
}

export async function createRcnoaUploadTarget({ runId, nuid, fileName }) {
  if (isRcnoaLocalTesting()) {
    throw new Error('Direct Azure uploads are disabled during RCNOA local testing');
  }
  const safeFileName = sanitizeFileName(fileName);
  const blobName = buildRcnoaBlobName({
    mode: 'adhoc',
    nuid,
    runId,
    direction: 'input',
    fileName: safeFileName,
  });
  const uploadUrl = await generateTemporaryUploadLink(
    RCNOA_BLOB_CONTAINER,
    blobName,
    RCNOA_DEFAULTS.sasExpiryMinutes,
  );
  return { containerName: RCNOA_BLOB_CONTAINER, blobName, fileName: safeFileName, uploadUrl };
}

export async function confirmRcnoaUpload({ containerName, blobName }) {
  if (containerName !== RCNOA_BLOB_CONTAINER || !blobName?.startsWith('rcnoa-processing/adhoc/')) {
    throw new Error('Invalid RCNOA upload location');
  }
  const runId = blobName.split('/')[3];
  let endpointHost = null;
  try {
    const blobClient = await getBlockBlobClient(containerName, blobName);
    endpointHost = new URL(blobClient.url).host;
    const exists = await blobClient.exists();
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'confirmRcnoaUpload',
        detail: { runId, containerName, endpointHost, stage: 'existenceChecked', exists },
      },
    }));
    if (!exists) throw new Error('Uploaded RCNO file was not found');
    const properties = await blobClient.getProperties();
    const sizeBytes = Number(properties.contentLength || 0);
    if (sizeBytes <= 0 || sizeBytes > RCNOA_DEFAULTS.maxUploadBytes) {
      throw new Error(`Uploaded RCNO file must be between 1 byte and ${RCNOA_DEFAULTS.maxUploadBytes} bytes`);
    }
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'confirmRcnoaUpload',
        detail: {
          runId,
          containerName,
          endpointHost,
          stage: 'propertiesRead',
          sizeBytes,
          contentType: properties.contentType || 'text/plain',
          etag: properties.etag,
        },
      },
    }));
    return {
      sizeBytes,
      contentType: properties.contentType || 'text/plain',
      etag: properties.etag,
    };
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'confirmRcnoaUpload',
        detail: { runId, containerName, endpointHost, error: error.message },
      },
    }));
    throw error;
  }
}

export async function stageRcnoaArtifact({
  mode,
  nuid,
  runId,
  direction,
  fileName,
  content,
  contentType = 'text/plain',
}) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf-8');
  const blobName = buildRcnoaBlobName({ mode, nuid, runId, direction, fileName });
  if (usesLocalStorage(blobName)) {
    const artifactPath = rcnoaLocalArtifactPath(blobName);
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, buffer);
  } else {
    const uploaded = await writeFileBufferToBlobStorage(
      buffer,
      RCNOA_BLOB_CONTAINER,
      blobName,
      contentType,
    );
    if (!uploaded) throw new Error('Failed to stage RCNOA artifact');
  }
  return {
    containerName: RCNOA_BLOB_CONTAINER,
    blobName,
    fileName: sanitizeFileName(fileName),
    contentType,
    sizeBytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

export async function readRcnoaArtifact(artifact) {
  if (!artifact || artifact.containerName !== RCNOA_BLOB_CONTAINER || !artifact.blobName) {
    throw new Error('RCNOA artifact not found');
  }
  if (usesLocalStorage(artifact.blobName)) {
    return readFile(rcnoaLocalArtifactPath(artifact.blobName));
  }
  const blobClient = await getBlockBlobClient(artifact.containerName, artifact.blobName);
  return blobClient.downloadToBuffer();
}

export async function readRcnoaArtifactText(artifact) {
  return (await readRcnoaArtifact(artifact)).toString('utf-8');
}

export async function createRcnoaDownloadLink(artifact, localDownloadUrl) {
  if (!artifact || artifact.containerName !== RCNOA_BLOB_CONTAINER || !artifact.blobName) {
    throw new Error('RCNOA artifact not found');
  }
  if (usesLocalStorage(artifact.blobName)) {
    if (!localDownloadUrl) throw new Error('RCNOA local download URL is required');
    return localDownloadUrl;
  }
  return generateTemporaryDownloadLink(
    artifact.containerName,
    artifact.blobName,
    RCNOA_DEFAULTS.sasExpiryMinutes,
    sanitizeFileName(artifact.fileName),
  );
}

export async function deleteRcnoaArtifactBlob(artifact) {
  if (!artifact || artifact.containerName !== RCNOA_BLOB_CONTAINER
    || !artifact.blobName?.startsWith('rcnoa-processing/')) {
    throw new Error('Invalid RCNOA artifact location');
  }
  if (usesLocalStorage(artifact.blobName)) {
    await rm(rcnoaLocalArtifactPath(artifact.blobName), { force: true });
    return { succeeded: true };
  }
  const blobClient = await getBlockBlobClient(artifact.containerName, artifact.blobName);
  return blobClient.deleteIfExists();
}