import readline from 'readline';
import { EJSON } from 'bson';
import { createAppJob, updateAppJob } from '@/app/services/backgroundJobService';
import { downloadBlobReadableStream } from '@/app/services/blobStorageService';
import { connectToDatabase } from '@/db/connection';
import { jobStatus } from '@/utils/constants';

export const MONGO_DATA_LOAD_JOB_TYPE = 'MongoDataLoad';

const BATCH_SIZE = 25;
const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_RETRIES = 15;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isBsonlBlob(blobName) {
  return /\.bsonl$/i.test(blobName || '');
}

function assertBsonlBlob(blobName) {
  if (!isBsonlBlob(blobName)) {
    throw new Error('Mongo data load requires a .bsonl blob file.');
  }
}

function isRateLimitError(error) {
  const status = error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.cause?.statusCode;
  const code = error?.code;
  const message = error?.message ?? '';
  const hasRateLimitError = error?.writeErrors?.some((we) => we.code === 16500);

  return (
    status === 429 ||
    code === 429 ||
    code === 16500 ||
    /429|Too\s*Many\s*Requests|Request rate is large|rate limit/i.test(message) ||
    hasRateLimitError
  );
}

function getHeaderValue(headers, headerName) {
  if (!headers) {
    return null;
  }

  if (typeof headers.get === 'function') {
    return headers.get(headerName) ?? headers.get(headerName.toLowerCase());
  }

  const direct = headers[headerName] ?? headers[headerName.toLowerCase()];
  if (direct != null) {
    return direct;
  }

  if (Array.isArray(headers)) {
    const entry = headers.find(([name]) => String(name).toLowerCase() === headerName.toLowerCase());
    return entry?.[1] ?? null;
  }

  return null;
}

function parseRetryAfterMs(error) {
  // writeErrors is an array where some elements have errmsg like "Error=16500, RetryAfterMs=1, Details='Insert error."
  const retryErrors = error?.writeErrors?.filter((we) => we.code === 16500) ?? [];
  if (retryErrors.length > 0) {
    // find the retry error with the largest RetryAfterMs value
    const retryAfterMsValues = retryErrors.map((we) => {
      const match = /RetryAfterMs=(\d+)/.exec(we.errmsg);
      return match ? parseInt(match[1]) : 1000;
    }).filter((ms) => ms != null);

    if (retryAfterMsValues.length > 0) {
      return Math.max(...retryAfterMsValues);
    }
  }

  return 5000; // default retry after 5 seconds if not specified
}

function getDocumentIdentifier(document, index) {
  if (document?._id != null && document._id !== '') {
    return String(document._id);
  }

  if (document?.id != null && document.id !== '') {
    return String(document.id);
  }

  return `row-${index + 1}`;
}

function isDuplicateKeyError(writeError) {
  if (!writeError) {
    return false;
  }

  // Check for E11000 error code or message pattern
  const code = writeError?.code;
  const message = writeError?.errmsg ?? writeError?.message ?? '';

  return code === 11000 || /E11000|duplicate key/i.test(message);
}

function getErrorMessage(error) {
  return error?.message || 'Unknown error';
}

function createEmptyReport() {
  return {
    insertedCount: 0,
    skippedCount: 0,
    skippedDocumentIds: [],
    errors: [],
  };
}

function getWriteErrors(error) {
  if (Array.isArray(error?.writeErrors)) {
    return error.writeErrors;
  }

  if (error?.writeErrors && typeof error.writeErrors.values === 'function') {
    return Array.from(error.writeErrors.values());
  }

  return [];
}

function getInsertedCountFromResult(result) {
  if (typeof result?.insertedCount === 'number') {
    return result.insertedCount;
  }

  if (result?.insertedIds && typeof result.insertedIds === 'object') {
    return Object.keys(result.insertedIds).length;
  }

  return 0;
}

function getInsertedCountFromError(error) {
  if (typeof error?.insertedCount === 'number') {
    return error.insertedCount;
  }

  if (typeof error?.result?.insertedCount === 'number') {
    return error.result.insertedCount;
  }

  if (typeof error?.result?.nInserted === 'number') {
    return error.result.nInserted;
  }

  return 0;
}

async function* streamBlobBsonLines(containerName, blobName) {
  assertBsonlBlob(blobName);

  const readableStream = await downloadBlobReadableStream(containerName, blobName);
  const lineReader = readline.createInterface({
    input: readableStream,
    crlfDelay: Infinity,
  });

  let itemIndex = 0;

  try {
    for await (const line of lineReader) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        continue;
      }

      itemIndex += 1;

      try {
        const parsed = JSON.parse(trimmedLine);
        const value = EJSON.deserialize(parsed);
        yield {
          index: itemIndex,
          value,
        };
      } catch (error) {
        throw new Error(`Invalid BSONL value at line ${itemIndex}: ${error.message}`);
      }
    }
  } finally {
    lineReader.close();
  }
}

async function insertBatchWithRetry(collection, batch, documentIds, jobContext) {
  let retryAfterConsumed = false;
  let backoffDelay = INITIAL_BACKOFF_MS;
  let backoffAttempt = 0;

  while (true) {
    try {
      const insertResult = await collection.insertMany(batch, { ordered: false });
      return {
        insertedCount: getInsertedCountFromResult(insertResult),
        writeErrors: [],
      };
    } catch (error) {
      if (isRateLimitError(error)) {
        const retryAfterMs = retryAfterConsumed ? 5000 : parseRetryAfterMs(error);
        if (retryAfterMs != null) {
          retryAfterConsumed = true;
          console.warn(JSON.stringify({
            kpmsg: {
              id: 'AI_PORTAL_NOTEBOOK',
              name: 'mongoDataLoadRetryAfter',
              detail: { ...jobContext, retryAfterMs, documentIds },
            }
          }));
          await sleep(retryAfterMs);
          continue;
        }

        backoffAttempt += 1;
        if (backoffAttempt > MAX_BACKOFF_RETRIES) {
          throw error;
        }

        console.warn(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'mongoDataLoadBackoff',
            detail: { ...jobContext, backoffAttempt, delayMs: backoffDelay, documentIds },
          }
        }));

        await sleep(backoffDelay);
        backoffDelay *= 2;
        continue;
      }

      const writeErrors = getWriteErrors(error);
      if (writeErrors.length > 0) {
        return {
          insertedCount: getInsertedCountFromError(error),
          writeErrors,
        };
      }

      throw error;
    }
  }
}

export async function checkMongoCollectionExists({ dbName, collectionName }) {
  const db = await connectToDatabase(dbName);

  try {
    const collections = await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray();
    if (!collections.some((c) => c.name === collectionName)) {
      return { exists: false, documentCount: 0 };
    }

    const documentCount = await db.collection(collectionName).countDocuments({}, { limit: 1 });
    return { exists: true, documentCount };
  } catch {
    return { exists: false, documentCount: 0 };
  }
}

const INVALID_DB_NAME_CHARS = /[\/\\. "$*<>:|?]/;

export function validateMongoNames({ dbName, collectionName }) {
  if (typeof dbName !== 'string' || !dbName.trim()) {
    return 'dbName is required.';
  }
  if (typeof collectionName !== 'string' || !collectionName.trim()) {
    return 'collectionName is required.';
  }
  if (dbName.length > 64 || INVALID_DB_NAME_CHARS.test(dbName) || dbName.includes('\0')) {
    return 'Invalid database name. It must be 64 characters or fewer and cannot contain spaces or any of: / \\ . " $ * < > : | ?';
  }
  if (collectionName.includes('$') || collectionName.includes('\0') || collectionName.startsWith('system.')) {
    return 'Invalid collection name. It cannot contain "$" or start with "system.".';
  }
  return null;
}

export async function createMongoCollection({ dbName, collectionName }) {
  const db = await connectToDatabase(dbName);

  try {
    await db.createCollection(collectionName);
    return { created: true };
  } catch (error) {
    if (error?.codeName === 'NamespaceExists' || error?.code === 48) {
      return { created: false };
    }
    throw error;
  }
}

export async function createMongoDataLoadJob({ containerName, blobName, dbName, collectionName, total }) {
  assertBsonlBlob(blobName);

  return createAppJob(MONGO_DATA_LOAD_JOB_TYPE, {
    containerName,
    blobName,
    dbName,
    collectionName,
    status: jobStatus.PROCESSING,
    current: 0,
    total,
    report: createEmptyReport(),
  });
}

export async function uploadBsonlToMongoCollection({ jobId, containerName, blobName, dbName, collectionName, overwrite }) {
  assertBsonlBlob(blobName);

  const db = await connectToDatabase(dbName);

  // Ensure the collection exists by attempting to create it
  // (MongoDB will auto-create on first write, but we want to be explicit)
  try {
    await db.createCollection(collectionName);
    await db.collection(collectionName).createIndex({ "$**": 1 })
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'mongoCollectionCreated',
        detail: {
          jobId,
          dbName,
          collectionName,
        },
      }
    }));
  } catch (error) {
    // Collection already exists or other error - log but continue
    if (error?.codeName !== 'NamespaceExists') {
      console.warn(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'mongoCollectionCreateWarning',
          detail: {
            jobId,
            dbName,
            collectionName,
            error: error?.message || 'Unknown error',
          },
        }
      }));
    }
  }

  const collection = db.collection(collectionName);
  const report = createEmptyReport();

  await updateAppJob(jobId, {
    status: jobStatus.INDEXING,
    current: 0,
    total: 0,
    report,
  });

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'mongoDataLoadStart',
      detail: {
        jobId,
        containerName,
        blobName,
        dbName,
        collectionName,
      },
    }
  }));

  let processedCount = 0;
  const pendingBatch = [];
  const pendingIds = [];

  const updateProgress = async () => {
    await updateAppJob(jobId, {
      status: jobStatus.INDEXING,
      current: processedCount,
      total: processedCount,
      report,
    });
  };

  const flushBatch = async () => {
    if (pendingBatch.length === 0) {
      return;
    }

    const batch = pendingBatch.splice(0, pendingBatch.length);
    const batchIds = pendingIds.splice(0, pendingIds.length);

    if (overwrite) {
      // Use bulkWrite with replaceOne + upsert to overwrite existing documents
      const operations = batch.map((doc) => {
        const { _id, ...replacement } = doc;
        return {
          replaceOne: {
            filter: { _id },
            replacement,
            upsert: true,
          },
        };
      });

      try {
        const bulkResult = await collection.bulkWrite(operations, { ordered: false });
        report.insertedCount += (bulkResult.upsertedCount ?? 0) + (bulkResult.modifiedCount ?? 0);
      } catch (error) {
        if (isRateLimitError(error)) {
          const retryAfterMs = parseRetryAfterMs(error);
          await sleep(retryAfterMs);
          // Retry once after rate limit
          try {
            const bulkResult = await collection.bulkWrite(operations, { ordered: false });
            report.insertedCount += (bulkResult.upsertedCount ?? 0) + (bulkResult.modifiedCount ?? 0);
          } catch (retryError) {
            report.errors.push(`Batch upsert failed for documents ${batchIds.join(', ')}: ${getErrorMessage(retryError)}`);
            throw Object.assign(retryError, { report, processedCount, total: processedCount });
          }
        } else {
          report.errors.push(`Batch upsert failed for documents ${batchIds.join(', ')}: ${getErrorMessage(error)}`);
          throw Object.assign(error, { report, processedCount, total: processedCount });
        }
      }

      await updateProgress();
      return;
    }

    let batchResult;
    try {
      batchResult = await insertBatchWithRetry(collection, batch, batchIds, {
        jobId,
        dbName,
        collectionName,
      });
    } catch (error) {
      report.errors.push(`Batch insert failed for documents ${batchIds.join(', ')}: ${getErrorMessage(error)}`);
      throw Object.assign(error, {
        report,
        processedCount,
        total: processedCount,
      });
    }

    report.insertedCount += batchResult.insertedCount;

    if (batchResult.writeErrors.length > 0) {
      for (const writeError of batchResult.writeErrors) {
        const indexInBatch = Number.isInteger(writeError?.index) ? writeError.index : -1;
        const failedDocumentId = indexInBatch >= 0 && indexInBatch < batchIds.length
          ? batchIds[indexInBatch]
          : 'unknown';

        if (isDuplicateKeyError(writeError)) {
          report.skippedCount += 1;
          report.skippedDocumentIds.push(failedDocumentId);
        } else {
          report.skippedCount += 1;
          report.skippedDocumentIds.push(failedDocumentId);
          report.errors.push(`Failed to insert ${failedDocumentId}: ${writeError?.errmsg || writeError?.message || 'Unknown insert error'}`);
        }
      }
    }

    await updateProgress();

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'mongoDataLoadBatchComplete',
        detail: {
          jobId,
          dbName,
          collectionName,
          current: processedCount,
          insertedCount: report.insertedCount,
          skippedCount: report.skippedCount,
        },
      }
    }));
  };

  try {
    for await (const entry of streamBlobBsonLines(containerName, blobName)) {
      processedCount += 1;

      if (!isPlainObject(entry.value)) {
        const documentId = getDocumentIdentifier(entry.value, entry.index - 1);
        report.skippedCount += 1;
        report.skippedDocumentIds.push(documentId);
        report.errors.push(`Skipped ${documentId}: line ${entry.index} is not a JSON object.`);

        if (processedCount % BATCH_SIZE === 0) {
          await updateProgress();
        }

        continue;
      }

      const documentId = getDocumentIdentifier(entry.value, entry.index - 1);

      pendingBatch.push(entry.value);
      pendingIds.push(documentId);

      if (pendingBatch.length === BATCH_SIZE) {
        await flushBatch();
      }
    }

    await flushBatch();
  } catch (error) {
    throw Object.assign(error, {
      report,
      processedCount,
      total: processedCount,
    });
  }

  await updateAppJob(jobId, {
    status: jobStatus.COMPLETE,
    current: processedCount,
    total: processedCount,
    report,
  });

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'mongoDataLoadComplete',
      detail: {
        jobId,
        dbName,
        collectionName,
        total: processedCount,
        insertedCount: report.insertedCount,
        skippedCount: report.skippedCount,
        errorCount: report.errors.length,
      },
    }
  }));

  return report;
}
