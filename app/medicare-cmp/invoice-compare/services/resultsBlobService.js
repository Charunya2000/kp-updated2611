import { writeFileBufferToBlobStorage, getBlockBlobClient } from '@/app/services/blobStorageService';
import {
  generateFinalResultsInWorker,
  VALID_DATABASES,
  VALID_INVOICE_TYPES,
  buildFinalResultsFilename,
} from './resultsDownloadService';

/**
 * Container name used for all Medicare comparison result files.
 */
const CONTAINER_NAME = 'medicare-results';

// ---------------------------------------------------------------------------
// Global export concurrency limiter (Phase 4)
// ---------------------------------------------------------------------------

/**
 * Maximum number of simultaneous Excel export workers across all runs.
 * With 2Gi AKS pods and ~500 MB peak per export, only 1 should run at a time.
 */
const MAX_CONCURRENT_EXPORTS = 1;
let activeExports = 0;
const exportWaitQueue = [];

function acquireExportSlot() {
  if (activeExports < MAX_CONCURRENT_EXPORTS) {
    activeExports++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    exportWaitQueue.push(resolve);
  });
}

function releaseExportSlot() {
  if (exportWaitQueue.length > 0) {
    const next = exportWaitQueue.shift();
    next();
  } else {
    activeExports = Math.max(0, activeExports - 1);
  }
}

/** Log process.memoryUsage() from the main thread in kpmsg format. */
function logMemoryUsage(operation, extra = {}) {
  const mem = process.memoryUsage();
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'excelExportMemory - medicare',
      detail: {
        operation,
        heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
        rssMB: (mem.rss / 1024 / 1024).toFixed(1),
        externalMB: (mem.external / 1024 / 1024).toFixed(1),
        ...extra,
      },
    },
  }));
}

/**
 * Content type for .xlsx files.
 */
const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Build a deterministic blob path from run parameters.
 * The path is predictable so we never need to store the URL — it can
 * always be derived from the runId, batchNumber, targetDatabase, and
 * invoiceType.
 *
 * Format: {targetDatabase}/{invoiceType}/{runId}/{batchNumber}.xlsx
 *
 * @param {object} params
 * @param {string|number} params.runId
 * @param {string|number} params.batchNumber
 * @param {string} params.targetDatabase
 * @param {string} params.invoiceType
 * @returns {string} The blob name (path within the container).
 */
export function buildBlobName({ runId, batchNumber, targetDatabase, invoiceType = 'med' }) {
  return `${targetDatabase}/${invoiceType}/${runId}/${batchNumber}.xlsx`;
}

/**
 * Build the blob path for a single part of a multi-part result set.
 *
 * @param {object} params
 * @param {string|number} params.runId
 * @param {string|number} params.batchNumber
 * @param {string} params.targetDatabase
 * @param {string} params.invoiceType
 * @param {number} params.partNumber  1-based part index
 * @returns {string}
 */
export function buildPartBlobName({ runId, batchNumber, targetDatabase, invoiceType = 'med', partNumber }) {
  return `${targetDatabase}/${invoiceType}/${runId}/${batchNumber}-part-${partNumber}.xlsx`;
}

function buildLegacyBlobName({ runId, batchNumber, targetDatabase }) {
  return `${targetDatabase}/${runId}/${batchNumber}.xlsx`;
}

function buildLegacyPartBlobName({ runId, batchNumber, targetDatabase, partNumber }) {
  return `${targetDatabase}/${runId}/${batchNumber}-part-${partNumber}.xlsx`;
}

/**
 * Build the blob path for the multi-part manifest JSON.
 *
 * @param {object} params
 * @param {string|number} params.runId
 * @param {string|number} params.batchNumber
 * @param {string} params.targetDatabase
 * @param {string} params.invoiceType
 * @returns {string}
 */
function buildManifestBlobName({ runId, batchNumber, targetDatabase, invoiceType = 'med' }) {
  return `${targetDatabase}/${invoiceType}/${runId}/${batchNumber}-manifest.json`;
}

function buildLegacyManifestBlobName({ runId, batchNumber, targetDatabase }) {
  return `${targetDatabase}/${runId}/${batchNumber}-manifest.json`;
}

/**
 * Build the path for the upload-lock sentinel blob.
 * While this blob exists another upload is considered in-progress.
 */
function buildLockBlobName({ runId, batchNumber, targetDatabase, invoiceType = 'med' }) {
  return `${targetDatabase}/${invoiceType}/${runId}/${batchNumber}.lock`;
}

function normalizeInvoiceType(invoiceType = 'med') {
  return String(invoiceType || 'med').toLowerCase();
}

async function deleteBlobIfExists({ containerName, blobName, runId, batchNumber, targetDatabase }) {
  if (!blobName) {
    return false;
  }

  try {
    const client = await getBlockBlobClient(containerName, blobName);
    await client.deleteIfExists();
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteRunHistoryArtifactBlobAttempt - medicare',
        detail: {
          runId,
          batchNumber,
          targetDatabase,
          containerName,
          blobName,
        },
      },
    }));
    return true;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteRunHistoryArtifactBlobFailure - medicare',
        detail: {
          runId,
          batchNumber,
          targetDatabase,
          containerName,
          blobName,
          error: error.message,
        },
      },
    }));
    return false;
  }
}

async function getManifestTotalParts({ runId, batchNumber, targetDatabase, invoiceType }) {
  const manifestCandidates = [
    buildManifestBlobName({ runId, batchNumber, targetDatabase, invoiceType }),
  ];

  if (invoiceType === 'med') {
    manifestCandidates.push(buildLegacyManifestBlobName({ runId, batchNumber, targetDatabase }));
  }

  for (const manifestBlobName of manifestCandidates) {
    try {
      const client = await getBlockBlobClient(CONTAINER_NAME, manifestBlobName);
      if (!(await client.exists())) {
        continue;
      }

      const downloadResponse = await client.download(0);
      const chunks = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(chunk);
      }

      const manifest = JSON.parse(Buffer.concat(chunks).toString());
      return { manifestBlobName, totalParts: Number(manifest.totalParts || 0) };
    } catch {
      // Continue to the next manifest candidate.
    }
  }

  return { manifestBlobName: null, totalParts: 0 };
}

async function deleteResultArtifactsForInvoiceType({ runId, batchNumber, targetDatabase, invoiceType }) {
  const normalizedInvoiceType = normalizeInvoiceType(invoiceType);
  const { manifestBlobName, totalParts } = await getManifestTotalParts({
    runId,
    batchNumber,
    targetDatabase,
    invoiceType: normalizedInvoiceType,
  });

  const deleteTargets = new Set([
    buildBlobName({ runId, batchNumber, targetDatabase, invoiceType: normalizedInvoiceType }),
    buildLockBlobName({ runId, batchNumber, targetDatabase, invoiceType: normalizedInvoiceType }),
    buildManifestBlobName({ runId, batchNumber, targetDatabase, invoiceType: normalizedInvoiceType }),
    buildMetaBlobName({ runId, batchNumber, targetDatabase }),
  ]);

  if (normalizedInvoiceType === 'med') {
    deleteTargets.add(buildLegacyBlobName({ runId, batchNumber, targetDatabase }));
    deleteTargets.add(buildLegacyManifestBlobName({ runId, batchNumber, targetDatabase }));
  }

  const partCount = Math.max(1, totalParts);
  for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    deleteTargets.add(buildPartBlobName({ runId, batchNumber, targetDatabase, invoiceType: normalizedInvoiceType, partNumber }));

    if (normalizedInvoiceType === 'med') {
      deleteTargets.add(buildLegacyPartBlobName({ runId, batchNumber, targetDatabase, partNumber }));
    }
  }

  await Promise.all([...deleteTargets].map((blobName) => deleteBlobIfExists({
    containerName: CONTAINER_NAME,
    blobName,
    runId,
    batchNumber,
    targetDatabase,
  })));

  return {
    invoiceType: normalizedInvoiceType,
    manifestBlobName,
    totalParts: partCount,
  };
}

export async function deleteRunHistoryArtifacts({ runId, batchNumber, targetDatabase }) {
  if (!runId || !batchNumber) {
    throw new Error('runId and batchNumber are required.');
  }

  if (!VALID_DATABASES.includes(targetDatabase)) {
    throw new Error(`targetDatabase must be one of: ${VALID_DATABASES.join(', ')}`);
  }

  const medResult = await deleteResultArtifactsForInvoiceType({
    runId,
    batchNumber,
    targetDatabase,
    invoiceType: 'med',
  });

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'deleteRunHistoryArtifactsSuccess - medicare',
      detail: {
        containerName: CONTAINER_NAME,
        runId,
        batchNumber,
        targetDatabase,
        deletedInvoiceTypes: [medResult.invoiceType],
      },
    },
  }));

  return {
    success: true,
    deletedArtifacts: [medResult],
  };
}

/**
 * Try to create the lock blob.  Returns true if the lock was acquired
 * (i.e. no other upload is running), false if the lock already exists.
 */
export async function acquireUploadLock({ runId, batchNumber, targetDatabase, invoiceType = 'med' }) {
  const normalizedInvoiceType = normalizeInvoiceType(invoiceType);
  const lockName = buildLockBlobName({
    runId,
    batchNumber,
    targetDatabase,
    invoiceType: normalizedInvoiceType,
  });
  try {
    const client = await getBlockBlobClient(CONTAINER_NAME, lockName);
    // Atomic lock acquisition: create only if blob does NOT already exist.
    // This avoids races when multiple callers check/create concurrently.
    await client.upload('', 0, {
      conditions: { ifNoneMatch: '*' },
    });
    return true;
  } catch (error) {
    // 409/412 = lock already exists (another uploader won).
    if (error?.statusCode === 409 || error?.statusCode === 412) {
      return false;
    }
    return false;
  }
}

/**
 * Delete the lock blob so future uploads can proceed.
 */
export async function releaseUploadLock({ runId, batchNumber, targetDatabase, invoiceType = 'med' }) {
  const normalizedInvoiceType = normalizeInvoiceType(invoiceType);
  const lockName = buildLockBlobName({
    runId,
    batchNumber,
    targetDatabase,
    invoiceType: normalizedInvoiceType,
  });
  try {
    const client = await getBlockBlobClient(CONTAINER_NAME, lockName);
    await client.deleteIfExists();
    return true;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'releaseUploadLock - medicare',
        detail: {
          runId,
          batchNumber,
          targetDatabase,
          invoiceType: normalizedInvoiceType,
          lockName,
          error: error.message,
        },
      },
    }));
    return false;
  }
}

/**
 * Check whether an upload lock blob exists.
 */
export async function isUploadLocked({ runId, batchNumber, targetDatabase, invoiceType = 'med' }) {
  const normalizedInvoiceType = normalizeInvoiceType(invoiceType);
  const lockName = buildLockBlobName({
    runId,
    batchNumber,
    targetDatabase,
    invoiceType: normalizedInvoiceType,
  });
  try {
    const client = await getBlockBlobClient(CONTAINER_NAME, lockName);
    return await client.exists();
  } catch {
    return false;
  }
}

/**
 * Generate the final-results Excel file from Oracle and upload it to
 * Azure Blob Storage.
 *
 * @param {object} params
 * @param {string|number} params.runId
 * @param {string|number} params.batchNumber
 * @param {string} params.targetDatabase  - 'jpt' | 'perf'
 * @param {string} params.invoiceType  - 'med'
 * @returns {Promise<{ success: boolean, blobName?: string, error?: string }>}
 */
export async function uploadFinalResultsToBlob({ runId, batchNumber, targetDatabase, invoiceType = 'med' }) {
  if (!runId || !batchNumber) {
    return { success: false, error: 'runId and batchNumber are required.' };
  }

  if (!VALID_DATABASES.includes(targetDatabase)) {
    return {
      success: false,
      error: `targetDatabase must be one of: ${VALID_DATABASES.join(', ')}`,
    };
  }

  const normalizedInvoiceType = normalizeInvoiceType(invoiceType);
  if (!VALID_INVOICE_TYPES.includes(normalizedInvoiceType)) {
    return {
      success: false,
      error: `invoiceType must be one of: ${VALID_INVOICE_TYPES.join(', ')}`,
    };
  }

  const blobName = buildBlobName({
    runId,
    batchNumber,
    targetDatabase,
    invoiceType: normalizedInvoiceType,
  });

  // Check whether the file already exists (idempotency guard).
  // A multi-part manifest or the single-file blob both count as "exists".
  try {
    const manifestBlobName = buildManifestBlobName({
      runId,
      batchNumber,
      targetDatabase,
      invoiceType: normalizedInvoiceType,
    });
    const manifestClient = await getBlockBlobClient(CONTAINER_NAME, manifestBlobName);
    if (await manifestClient.exists()) {
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'uploadFinalResultsToBlob - medicare',
          detail: {
            runId,
            batchNumber,
            targetDatabase,
            invoiceType: normalizedInvoiceType,
            message: 'Manifest already exists, skipping upload.',
          },
        },
      }));
      return { success: true, blobName };
    }
  } catch {
    // continue to single-file check
  }

  // Backward compatibility: older CA uploads used paths without invoiceType.
  if (normalizedInvoiceType === 'med') {
    try {
      const legacyManifestBlobName = buildLegacyManifestBlobName({ runId, batchNumber, targetDatabase });
      const legacyManifestClient = await getBlockBlobClient(CONTAINER_NAME, legacyManifestBlobName);
      if (await legacyManifestClient.exists()) {
        console.log(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'uploadFinalResultsToBlob - medicare',
            detail: {
              runId,
              batchNumber,
              targetDatabase,
              invoiceType: normalizedInvoiceType,
              message: 'Legacy Medicare manifest already exists, skipping upload.',
            },
          },
        }));
        return { success: true, blobName };
      }
    } catch {
      // continue
    }
  }

  try {
    const existingClient = await getBlockBlobClient(CONTAINER_NAME, blobName);
    const exists = await existingClient.exists();
    if (exists) {
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'uploadFinalResultsToBlob - medicare',
          detail: {
            runId,
            batchNumber,
            targetDatabase,
            invoiceType: normalizedInvoiceType,
            message: 'Blob already exists, skipping upload.',
          },
        },
      }));
      return { success: true, blobName };
    }
  } catch {
    // If the existence check fails we still attempt the upload.
  }

  if (normalizedInvoiceType === 'med') {
    try {
      const legacyBlobName = buildLegacyBlobName({ runId, batchNumber, targetDatabase });
      const legacyClient = await getBlockBlobClient(CONTAINER_NAME, legacyBlobName);
      if (await legacyClient.exists()) {
        console.log(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'uploadFinalResultsToBlob - medicare',
            detail: {
              runId,
              batchNumber,
              targetDatabase,
              invoiceType: normalizedInvoiceType,
              message: 'Legacy Medicare blob already exists, skipping upload.',
            },
          },
        }));
        return { success: true, blobName };
      }
    } catch {
      // continue
    }
  }

  // Acquire the upload lock so concurrent callers don't duplicate work.
  const lockAcquired = await acquireUploadLock({
    runId,
    batchNumber,
    targetDatabase,
    invoiceType: normalizedInvoiceType,
  });
  if (!lockAcquired) {
    return { success: false, error: 'Upload already in progress.', alreadyRunning: true };
  }

  let exportSlotAcquired = false;
  try {
    // Global concurrency gate — wait if another heavy export is running.
    await acquireExportSlot();
    exportSlotAcquired = true;

    logMemoryUsage('beforeWorker', { runId, batchNumber, targetDatabase, invoiceType: normalizedInvoiceType });

    // Retrieve the processedOn date persisted at submission time so it can
    // be injected into every Excel row as the PROCESS_DATE column value.
    const runMeta = await getRunMetadata({ runId, batchNumber, targetDatabase });

    // Incremental upload: each completed part is uploaded to blob storage
    // immediately via the onPart callback, then its buffer can be GC'd.
    let uploadedParts = 0;
    const serviceResult = await generateFinalResultsInWorker({
      runId,
      batchNumber,
      targetDatabase,
      invoiceType: normalizedInvoiceType,
      processedOn: runMeta.processedOn || null,
      onPart: async ({ partNumber, buffer }) => {
        // For single-file results (totalParts === 1) we use the plain blob name;
        // for multi-part we use the part-specific name. Since we don't know the
        // final totalParts until 'complete', always use part naming and write a
        // manifest afterward (simplifies the check/download logic).
        const partBlobName = buildPartBlobName({
          runId,
          batchNumber,
          targetDatabase,
          invoiceType: normalizedInvoiceType,
          partNumber,
        });
        const uploaded = await writeFileBufferToBlobStorage(
          buffer,
          CONTAINER_NAME,
          partBlobName,
          XLSX_CONTENT_TYPE,
        );
        if (!uploaded) {
          throw new Error(`Failed to upload part ${partNumber} to blob storage.`);
        }
        uploadedParts++;
        logMemoryUsage('partUploaded', { partNumber, runId, batchNumber });
      },
    });

    logMemoryUsage('afterWorker', { runId, batchNumber, targetDatabase, invoiceType: normalizedInvoiceType });

    if (serviceResult.error) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'uploadFinalResultsToBlob - medicare',
          detail: {
            runId,
            batchNumber,
            targetDatabase,
            invoiceType: normalizedInvoiceType,
            error: serviceResult.error,
            details: serviceResult.details,
          },
        },
      }));

      return { success: false, error: serviceResult.error, details: serviceResult.details };
    }

    if (serviceResult.noData) {
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'uploadFinalResultsToBlob - medicare',
          detail: {
            runId,
            batchNumber,
            targetDatabase,
            invoiceType: normalizedInvoiceType,
            totalRows: 0,
            message: 'No final results rows found. Skipping upload.',
          },
        },
      }));
      return { success: true, skipped: true, reason: 'No records found for this run.' };
    }

    const { totalParts = uploadedParts, totalRows = 0 } = serviceResult;

    // Always write a manifest so the check / download endpoints can
    // determine part count without scanning the container.
    const manifest = JSON.stringify({ totalParts, totalRows });
    const manifestBlobName = buildManifestBlobName({
      runId,
      batchNumber,
      targetDatabase,
      invoiceType: normalizedInvoiceType,
    });
    const manifestClient = await getBlockBlobClient(CONTAINER_NAME, manifestBlobName);
    await manifestClient.upload(manifest, Buffer.byteLength(manifest), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'uploadFinalResultsToBlob - medicare',
        detail: {
          runId,
          batchNumber,
          targetDatabase,
          invoiceType: normalizedInvoiceType,
          totalParts,
          totalRows,
          blobName,
        },
      },
    }));

    return { success: true, blobName: totalParts > 1 ? `${blobName} (${totalParts} parts)` : blobName };
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'uploadFinalResultsToBlob - medicare',
        detail: {
          runId,
          batchNumber,
          targetDatabase,
          invoiceType: normalizedInvoiceType,
          blobName,
          error: error.message,
        },
      },
    }));
    return { success: false, error: 'Failed to upload results to blob storage.', details: error.message };
  } finally {
    if (exportSlotAcquired) {
      releaseExportSlot();
    }

    // Always release the per-run lock, even on error, so a retry can proceed.
    const released = await releaseUploadLock({
      runId,
      batchNumber,
      targetDatabase,
      invoiceType: normalizedInvoiceType,
    });
    if (!released) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'uploadFinalResultsToBlob - medicare',
          detail: {
            runId,
            batchNumber,
            targetDatabase,
            invoiceType: normalizedInvoiceType,
            blobName,
            error: 'Failed to delete upload lock blob.',
          },
        },
      }));
    }
  }
}

/**
 * Check whether the final-results blob exists in Azure Blob Storage
 * and whether an upload is currently in progress (lock blob present).
 *
 * @param {object} params
 * @param {string|number} params.runId
 * @param {string|number} params.batchNumber
 * @param {string} params.targetDatabase
 * @param {string} params.invoiceType
 * @returns {Promise<{ exists: boolean, uploading: boolean }>}
 */
export async function checkFinalResultsBlobExists({ runId, batchNumber, targetDatabase, invoiceType = 'med' }) {
  const normalizedInvoiceType = normalizeInvoiceType(invoiceType);
  if (
    !runId ||
    !batchNumber ||
    !VALID_DATABASES.includes(targetDatabase) ||
    !VALID_INVOICE_TYPES.includes(normalizedInvoiceType)
  ) {
    return { exists: false, uploading: false, totalParts: 0 };
  }

  // 1. Check for a multi-part manifest first.
  try {
    const manifestBlobName = buildManifestBlobName({
      runId,
      batchNumber,
      targetDatabase,
      invoiceType: normalizedInvoiceType,
    });
    const manifestClient = await getBlockBlobClient(CONTAINER_NAME, manifestBlobName);
    const manifestExists = await manifestClient.exists();

    if (manifestExists) {
      const downloadResponse = await manifestClient.download(0);
      const chunks = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(chunk);
      }
      const manifest = JSON.parse(Buffer.concat(chunks).toString());
      return { exists: true, uploading: false, totalParts: manifest.totalParts };
    }
  } catch {
    // Fall through to single-file check.
  }

  if (normalizedInvoiceType === 'med') {
    try {
      const legacyManifestBlobName = buildLegacyManifestBlobName({ runId, batchNumber, targetDatabase });
      const legacyManifestClient = await getBlockBlobClient(CONTAINER_NAME, legacyManifestBlobName);
      const legacyManifestExists = await legacyManifestClient.exists();

      if (legacyManifestExists) {
        const downloadResponse = await legacyManifestClient.download(0);
        const chunks = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(chunk);
        }
        const manifest = JSON.parse(Buffer.concat(chunks).toString());
        return { exists: true, uploading: false, totalParts: manifest.totalParts };
      }
    } catch {
      // Fall through to single-file checks.
    }
  }

  // 2. Check for a single-file blob.
  const blobName = buildBlobName({
    runId,
    batchNumber,
    targetDatabase,
    invoiceType: normalizedInvoiceType,
  });
  let exists = false;
  let uploading = false;

  try {
    const blobClient = await getBlockBlobClient(CONTAINER_NAME, blobName);
    exists = await blobClient.exists();
  } catch {
    // default false
  }

  if (!exists && normalizedInvoiceType === 'med') {
    try {
      const legacyBlobName = buildLegacyBlobName({ runId, batchNumber, targetDatabase });
      const legacyClient = await getBlockBlobClient(CONTAINER_NAME, legacyBlobName);
      exists = await legacyClient.exists();
    } catch {
      // default false
    }
  }

  if (!exists) {
    uploading = await isUploadLocked({
      runId,
      batchNumber,
      targetDatabase,
      invoiceType: normalizedInvoiceType,
    });
  }

  return { exists, uploading, totalParts: exists ? 1 : 0 };
}

/**
 * Download the final-results Excel file from Azure Blob Storage.
 *
 * Returns the file buffer and metadata, or an error object.
 *
 * @param {object} params
 * @param {string|number} params.runId
 * @param {string|number} params.batchNumber
 * @param {string} params.targetDatabase
 * @param {string} params.invoiceType
 * @returns {Promise<{ buffer?: Buffer, filename?: string, contentType?: string, error?: string, status?: number }>}
 */
export async function downloadFinalResultsFromBlob({
  runId,
  batchNumber,
  targetDatabase,
  invoiceType = 'med',
  partNumber,
}) {
  if (!runId || !batchNumber) {
    return { status: 400, error: 'runId and batchNumber are required.' };
  }

  if (!VALID_DATABASES.includes(targetDatabase)) {
    return {
      status: 400,
      error: `targetDatabase must be one of: ${VALID_DATABASES.join(', ')}`,
    };
  }

  const normalizedInvoiceType = normalizeInvoiceType(invoiceType);
  if (!VALID_INVOICE_TYPES.includes(normalizedInvoiceType)) {
    return {
      status: 400,
      error: `invoiceType must be one of: ${VALID_INVOICE_TYPES.join(', ')}`,
    };
  }

  // Determine which blob to fetch.
  const blobName = partNumber
    ? buildPartBlobName({
      runId,
      batchNumber,
      targetDatabase,
      invoiceType: normalizedInvoiceType,
      partNumber,
    })
    : buildBlobName({ runId, batchNumber, targetDatabase, invoiceType: normalizedInvoiceType });

  try {
    let blobClient = await getBlockBlobClient(CONTAINER_NAME, blobName);
    let exists = await blobClient.exists();

    if (!exists && normalizedInvoiceType === 'med') {
      const legacyBlobName = partNumber
        ? buildLegacyPartBlobName({ runId, batchNumber, targetDatabase, partNumber })
        : buildLegacyBlobName({ runId, batchNumber, targetDatabase });

      const legacyClient = await getBlockBlobClient(CONTAINER_NAME, legacyBlobName);
      const legacyExists = await legacyClient.exists();
      if (legacyExists) {
        blobClient = legacyClient;
        exists = true;
      }
    }

    if (!exists) {
      return { status: 404, error: 'Results file not found. It may still be uploading.' };
    }

    const downloadResponse = await blobClient.download(0);
    const chunks = [];

    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const filename = await buildFinalResultsFilename({
      runId,
      batchNumber,
      invoiceType: normalizedInvoiceType,
      partNumber,
    });

    return { buffer, filename, contentType: XLSX_CONTENT_TYPE };
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'downloadFinalResultsFromBlob',
        detail: { runId, batchNumber, targetDatabase, invoiceType: normalizedInvoiceType, error: error.message },
      },
    }));

    return { status: 500, error: 'Failed to download results from blob storage.', details: error.message };
  }
}

// ---------------------------------------------------------------------------
// Run metadata (persists user-supplied values like processedOn across the
// async gap between job submission and Excel generation).
// ---------------------------------------------------------------------------

function buildMetaBlobName({ runId, batchNumber, targetDatabase }) {
  return `${targetDatabase}/${runId}/${batchNumber}-meta.json`;
}

/**
 * Persist run-level metadata (e.g. processedOn) to a small JSON blob so it
 * can be retrieved later when Excel generation starts.
 *
 * @param {object} params
 * @param {string|number} params.runId
 * @param {string|number} params.batchNumber
 * @param {string} params.targetDatabase
 * @param {string} [params.processedOn]
 */
export async function saveRunMetadata({ runId, batchNumber, targetDatabase, processedOn }) {
  const blobName = buildMetaBlobName({ runId, batchNumber, targetDatabase });
  const payload = JSON.stringify({ processedOn });
  const client = await getBlockBlobClient(CONTAINER_NAME, blobName);
  await client.upload(payload, Buffer.byteLength(payload), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
}

/**
 * Read run-level metadata previously stored by {@link saveRunMetadata}.
 *
 * @param {object} params
 * @param {string|number} params.runId
 * @param {string|number} params.batchNumber
 * @param {string} params.targetDatabase
 * @returns {Promise<{ processedOn?: string }>}
 */
export async function getRunMetadata({ runId, batchNumber, targetDatabase }) {
  const blobName = buildMetaBlobName({ runId, batchNumber, targetDatabase });
  try {
    const client = await getBlockBlobClient(CONTAINER_NAME, blobName);
    const downloadResponse = await client.download(0);
    const chunks = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch (error) {
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getRunMetadata',
        detail: { runId, batchNumber, targetDatabase, error: error.message },
      },
    }));
    return {};
  }
}
