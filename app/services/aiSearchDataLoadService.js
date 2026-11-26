import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import readline from 'readline';
import { StringDecoder } from 'string_decoder';
import { getIndexMetadata } from '@/app/services/aiSearchIndexService';
import { downloadBlobReadableStream, downloadBlobText } from '@/app/services/blobStorageService';
import { createAppJob, updateAppJob } from '@/app/services/backgroundJobService';
import { jobStatus } from '@/utils/constants';

export const AI_SEARCH_DATA_LOAD_JOB_TYPE = 'AISearchDataLoad';

const BATCH_SIZE = 100;
const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_RETRIES = 15;
const PARSER_YIELD_EVERY_CHARS = 50_000;

function getSearchClient(indexName) {
  const envName = process.env.envName;
  const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
  const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];

  return new SearchClient(searchEndpoint, indexName, new AzureKeyCredential(searchAPIKey));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function yieldToEventLoop() {
  return new Promise((resolve) => {
    if (typeof setImmediate === 'function') {
      setImmediate(resolve);
      return;
    }

    setTimeout(resolve, 0);
  });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRateLimitError(error) {
  const status = error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.code ?? error?.cause?.statusCode;
  const message = error?.message ?? '';
  return status === 429 || /429|Too\s*Many\s*Requests/i.test(message);
}

function getHeaderValue(headers, headerName) {
  if (!headers) {
    return null;
  }

  if (typeof headers.get === 'function') {
    return headers.get(headerName) ?? headers.get(headerName.toLowerCase());
  }

  const exactMatch = headers[headerName] ?? headers[headerName.toLowerCase()];
  if (exactMatch) {
    return exactMatch;
  }

  if (Array.isArray(headers)) {
    const entry = headers.find(([name]) => String(name).toLowerCase() === headerName.toLowerCase());
    return entry?.[1] ?? null;
  }

  return null;
}

function parseRetryAfterMs(error) {
  const retryAfterHeader =
    getHeaderValue(error?.response?.headers, 'Retry-After') ??
    getHeaderValue(error?.details?.response?.headers, 'Retry-After') ??
    getHeaderValue(error?.cause?.response?.headers, 'Retry-After') ??
    getHeaderValue(error?.headers, 'Retry-After');

  if (!retryAfterHeader) {
    return null;
  }

  const retryAfterValue = Array.isArray(retryAfterHeader) ? retryAfterHeader[0] : retryAfterHeader;
  const asNumber = Number(retryAfterValue);
  if (!Number.isNaN(asNumber)) {
    return Math.max(asNumber, 0) * 1000;
  }

  const asDate = Date.parse(retryAfterValue);
  if (Number.isNaN(asDate)) {
    return null;
  }

  return Math.max(asDate - Date.now(), 0);
}

function getErrorMessage(error) {
  return error?.message || 'Unknown error';
}

function getDocumentIdentifier(document, keyFieldName, index) {
  if (keyFieldName && document?.[keyFieldName] != null && document[keyFieldName] !== '') {
    return String(document[keyFieldName]);
  }

  if (document?.id != null && document.id !== '') {
    return String(document.id);
  }

  return `row-${index + 1}`;
}

function createEmptyReport() {
  return {
    insertedCount: 0,
    skippedCount: 0,
    skippedDocumentIds: [],
    errors: [],
  };
}

function normalizeUploadResults(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
}

function getVectorFieldConstraints(fields) {
  return (fields || [])
    .filter((field) => {
      const isVectorByType = field?.type === 'Collection(Edm.Single)';
      const isVectorByDimensions = typeof field?.vectorSearchDimensions === 'number';
      return isVectorByType || isVectorByDimensions;
    })
    .map((field) => ({
      name: field.name,
      dimensions: typeof field.vectorSearchDimensions === 'number' ? field.vectorSearchDimensions : null,
    }));
}

function validateVectorFields(document, vectorFieldConstraints) {
  const errors = [];

  for (const constraint of vectorFieldConstraints) {
    const value = document?.[constraint.name];
    if (!Array.isArray(value)) {
      errors.push(`missing vector field ${constraint.name}`);
      continue;
    }

    if (value.length === 0) {
      errors.push(`vector field ${constraint.name} is empty`);
      continue;
    }

    if (constraint.dimensions != null && value.length !== constraint.dimensions) {
      errors.push(`vector field ${constraint.name} expected ${constraint.dimensions} dimensions but got ${value.length}`);
      continue;
    }

    const hasInvalidValues = value.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry));
    if (hasInvalidValues) {
      errors.push(`vector field ${constraint.name} contains non-numeric values`);
    }
  }

  return errors;
}

async function* parseTopLevelJsonArrayStream(readableStream) {
  const decoder = new StringDecoder('utf8');
  let buffer = '';
  let arrayStarted = false;
  let arrayEnded = false;
  let expectingValue = true;
  let valueStart = -1;
  let valueType = null;
  let inString = false;
  let escapeNext = false;
  let depth = 0;
  let itemIndex = 0;

  const parseValue = (rawValue, index) => {
    try {
      return JSON.parse(rawValue);
    } catch (error) {
      throw new Error(`Invalid JSON value at array item ${index}: ${error.message}`);
    }
  };

  const emitParsedValue = (rawValue) => {
    itemIndex += 1;
    return {
      index: itemIndex,
      value: parseValue(rawValue, itemIndex),
    };
  };

  const processBuffer = async function* () {
    let cursor = 0;
    let scannedCharsSinceYield = 0;

    while (cursor < buffer.length) {
      const ch = buffer[cursor];
      scannedCharsSinceYield += 1;

      if (scannedCharsSinceYield >= PARSER_YIELD_EVERY_CHARS) {
        scannedCharsSinceYield = 0;
        await yieldToEventLoop();
      }

      if (!arrayStarted) {
        if (/\s/.test(ch)) {
          cursor += 1;
          continue;
        }

        if (ch !== '[') {
          throw new Error('Selected blob must contain a top-level JSON array.');
        }

        arrayStarted = true;
        expectingValue = true;
        cursor += 1;
        continue;
      }

      if (arrayEnded) {
        if (/\s/.test(ch)) {
          cursor += 1;
          continue;
        }

        throw new Error('Selected blob contains trailing content after top-level JSON array.');
      }

      if (valueStart < 0) {
        if (expectingValue) {
          if (/\s/.test(ch)) {
            cursor += 1;
            continue;
          }

          if (ch === ']') {
            arrayEnded = true;
            expectingValue = false;
            cursor += 1;
            continue;
          }

          valueStart = cursor;
          if (ch === '{' || ch === '[') {
            valueType = 'complex';
            depth = 1;
            inString = false;
            escapeNext = false;
          } else if (ch === '"') {
            valueType = 'string';
            inString = true;
            escapeNext = false;
          } else {
            valueType = 'primitive';
          }

          cursor += 1;
          continue;
        }

        if (/\s/.test(ch)) {
          cursor += 1;
          continue;
        }

        if (ch === ',') {
          expectingValue = true;
          cursor += 1;
          continue;
        }

        if (ch === ']') {
          arrayEnded = true;
          cursor += 1;
          continue;
        }

        throw new Error(`Invalid JSON array separator at character ${cursor + 1}.`);
      }

      if (valueType === 'complex') {
        if (inString) {
          if (escapeNext) {
            escapeNext = false;
          } else if (ch === '\\') {
            escapeNext = true;
          } else if (ch === '"') {
            inString = false;
          }

          cursor += 1;
          continue;
        }

        if (ch === '"') {
          inString = true;
          cursor += 1;
          continue;
        }

        if (ch === '{' || ch === '[') {
          depth += 1;
        } else if (ch === '}' || ch === ']') {
          depth -= 1;
        }

        cursor += 1;
        if (depth === 0) {
          const rawValue = buffer.slice(valueStart, cursor);
          valueStart = -1;
          valueType = null;
          expectingValue = false;
          yield emitParsedValue(rawValue);
        }

        continue;
      }

      if (valueType === 'string') {
        if (escapeNext) {
          escapeNext = false;
          cursor += 1;
          continue;
        }

        if (ch === '\\') {
          escapeNext = true;
          cursor += 1;
          continue;
        }

        cursor += 1;
        if (ch === '"') {
          const rawValue = buffer.slice(valueStart, cursor);
          valueStart = -1;
          valueType = null;
          expectingValue = false;
          yield emitParsedValue(rawValue);
        }

        continue;
      }

      if (ch === ',' || ch === ']') {
        const rawValue = buffer.slice(valueStart, cursor).trim();
        if (rawValue.length === 0) {
          throw new Error(`Invalid JSON value at array item ${itemIndex + 1}.`);
        }

        const parsed = emitParsedValue(rawValue);
        valueStart = -1;
        valueType = null;
        expectingValue = false;

        if (ch === ',') {
          expectingValue = true;
        } else {
          arrayEnded = true;
        }

        cursor += 1;
        yield parsed;
        continue;
      }

      cursor += 1;
    }

    if (valueStart >= 0) {
      buffer = buffer.slice(valueStart);
      valueStart = 0;
    } else {
      buffer = '';
    }
  };

  for await (const chunk of readableStream) {
    const textChunk = typeof chunk === 'string' ? chunk : decoder.write(chunk);
    if (!textChunk) {
      continue;
    }

    buffer += textChunk;
    for await (const parsed of processBuffer()) {
      yield parsed;
    }
  }

  const remaining = decoder.end();
  if (remaining) {
    buffer += remaining;
    for await (const parsed of processBuffer()) {
      yield parsed;
    }
  }

  if (!arrayStarted) {
    throw new Error('Selected blob must contain a top-level JSON array.');
  }

  if (valueStart >= 0) {
    throw new Error('Selected blob contains an incomplete JSON value.');
  }

  if (!arrayEnded) {
    throw new Error('Selected blob contains an unterminated top-level JSON array.');
  }
}

async function* streamBlobJsonArray(containerName, blobName) {
  const readableStream = await downloadBlobReadableStream(containerName, blobName);
  yield* parseTopLevelJsonArrayStream(readableStream);
}

async function* streamBlobJsonLines(containerName, blobName) {
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
        yield {
          index: itemIndex,
          value: JSON.parse(trimmedLine),
        };
      } catch (error) {
        throw new Error(`Invalid JSONL value at line ${itemIndex}: ${error.message}`);
      }
    }
  } finally {
    lineReader.close();
  }
}

function shouldUseJsonLinesParser(blobName) {
  return /\.(jsonl|ndjson)$/i.test(blobName || '');
}

function streamBlobJsonDocuments(containerName, blobName) {
  return shouldUseJsonLinesParser(blobName)
    ? streamBlobJsonLines(containerName, blobName)
    : streamBlobJsonArray(containerName, blobName);
}

function validateDocumentForIndex({ document, documentIndex, keyFieldName, allowedFieldNames, vectorFieldConstraints, report }) {
  const documentId = getDocumentIdentifier(document, keyFieldName, documentIndex);

  if (!isPlainObject(document)) {
    report.skippedCount += 1;
    report.skippedDocumentIds.push(documentId);
    report.errors.push(`Skipped ${documentId}: array item at position ${documentIndex + 1} is not an object.`);
    return null;
  }

  if (document[keyFieldName] == null || document[keyFieldName] === '') {
    report.skippedCount += 1;
    report.skippedDocumentIds.push(documentId);
    report.errors.push(`Skipped ${documentId}: missing required key field ${keyFieldName}.`);
    return null;
  }

  const additionalFields = Object.keys(document).filter((fieldName) => !allowedFieldNames.has(fieldName));
  if (additionalFields.length > 0) {
    report.skippedCount += 1;
    report.skippedDocumentIds.push(documentId);
    report.errors.push(`Skipped ${documentId}: additional fields not present in index schema: ${additionalFields.join(', ')}`);
    return null;
  }

  if (vectorFieldConstraints.length > 0) {
    const vectorErrors = validateVectorFields(document, vectorFieldConstraints);
    if (vectorErrors.length > 0) {
      report.errors.push(`Warning ${documentId}: ${vectorErrors.join('; ')}.`);
    }
  }

  return document;
}

export async function checkAiSearchIndexHasDocuments(indexName) {
  const searchClient = getSearchClient(indexName);

  try {
    const results = await searchClient.search('*', {
      top: 1,
      includeTotalCount: true,
    });

    const count = results.count ?? 0;
    return { exists: true, documentCount: count };
  } catch (error) {
    if (error?.statusCode === 404) {
      return { exists: false, documentCount: 0 };
    }
    throw error;
  }
}

export async function loadBlobJsonArray(containerName, blobName) {
  const blobText = await downloadBlobText(containerName, blobName);

  let parsed;
  try {
    parsed = JSON.parse(blobText);
  } catch (error) {
    throw new Error(`Selected blob is not valid JSON: ${error.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Selected blob must contain a top-level JSON array.');
  }

  return parsed;
}

export async function createAiSearchDataLoadJob({ containerName, blobName, indexName, total }) {
  return createAppJob(AI_SEARCH_DATA_LOAD_JOB_TYPE, {
    containerName,
    blobName,
    indexName,
    status: jobStatus.PROCESSING,
    current: 0,
    total,
    report: createEmptyReport(),
  });
}

async function uploadBatchWithRetry(searchClient, indexName, batch, documentIds, action = 'upload') {
  let retryAfterConsumed = false;
  let backoffDelay = INITIAL_BACKOFF_MS;
  let backoffAttempt = 0;

  const invoke = () => {
    switch (action) {
      case 'merge': return searchClient.mergeDocuments(batch);
      case 'mergeOrUpload': return searchClient.mergeOrUploadDocuments(batch);
      default: return searchClient.uploadDocuments(batch);
    }
  };

  while (true) {
    try {
      return await invoke();
    } catch (error) {
      if (!isRateLimitError(error)) {
        throw error;
      }

      const retryAfterMs = retryAfterConsumed ? null : parseRetryAfterMs(error);
      if (retryAfterMs != null) {
        retryAfterConsumed = true;
        console.warn(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'aiSearchDataLoadRetryAfter',
            detail: { indexName, retryAfterMs, documentIds }
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
          name: 'aiSearchDataLoadBackoff',
          detail: { indexName, backoffAttempt, delayMs: backoffDelay, documentIds }
        }
      }));
      await sleep(backoffDelay);
      backoffDelay *= 2;
    }
  }
}

export async function uploadJsonArrayToAiSearchIndex({ jobId, containerName, blobName, indexName, documents, overwrite }) {
  const searchClient = getSearchClient(indexName);
  const metadata = await getIndexMetadata(indexName);

  if (!metadata?.fields?.length) {
    throw new Error(`Index metadata not found for ${indexName}`);
  }

  const allowedFieldNames = new Set(metadata.fields.map((field) => field.name));
  const keyFieldName = metadata.fields.find((field) => field.key)?.name || 'id';
  const vectorFieldConstraints = getVectorFieldConstraints(metadata.fields);
  const report = createEmptyReport();
  const knownTotal = Array.isArray(documents) ? documents.length : null;
  const source = Array.isArray(documents)
    ? documents.map((value, index) => ({ index: index + 1, value }))
    : streamBlobJsonDocuments(containerName, blobName);

  await updateAppJob(jobId, {
    status: jobStatus.INDEXING,
    current: 0,
    total: knownTotal ?? 0,
    report,
  });

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'aiSearchDataLoadStart',
      detail: {
        jobId,
        containerName,
        blobName,
        indexName,
        total: knownTotal ?? null,
      }
    }
  }));

  let processedCount = 0;
  const uploadBatch = [];
  const uploadBatchIds = [];

  const updateProgress = async () => {
    await updateAppJob(jobId, {
      status: jobStatus.INDEXING,
      current: processedCount,
      total: knownTotal ?? processedCount,
      report,
    });
  };

  const flushUploadBatch = async () => {
    if (uploadBatch.length === 0) {
      return;
    }

    const batch = uploadBatch.splice(0, uploadBatch.length);
    const batchIds = uploadBatchIds.splice(0, uploadBatchIds.length);

    try {
      if (overwrite) {
        // mergeOrUpload: creates new documents and overwrites existing ones
        const response = await uploadBatchWithRetry(searchClient, indexName, batch, batchIds, 'mergeOrUpload');
        const results = normalizeUploadResults(response);

        if (results.length > 0) {
          for (const result of results) {
            if (result.succeeded === false || result.status === false) {
              report.errors.push(`Failed to insert ${result.key || 'unknown'}: ${result.errorMessage || 'Unknown indexing error'}`);
            } else {
              report.insertedCount += 1;
            }
          }
        } else {
          report.insertedCount += batch.length;
        }
      } else {
        // Use 'merge' action with only the key field to check existence without modifying data.
        // merge fails with 404 for documents that don't exist, succeeds (no-op) for those that do.
        const probes = batch.map((doc) => ({ [keyFieldName]: doc[keyFieldName] }));
        const mergeResponse = await uploadBatchWithRetry(searchClient, indexName, probes, batchIds, 'merge');
        const mergeResults = normalizeUploadResults(mergeResponse);

        const newDocuments = [];
        const newDocumentIds = [];

        if (mergeResults.length > 0) {
          for (let i = 0; i < mergeResults.length; i++) {
            const result = mergeResults[i];
            if (result.statusCode === 404) {
              // Document doesn't exist — queue it for upload
              newDocuments.push(batch[i]);
              newDocumentIds.push(batchIds[i]);
            } else if (result.succeeded !== false && result.status !== false) {
              // Document exists — skip it
              report.skippedCount += 1;
              report.skippedDocumentIds.push(batchIds[i]);
              report.errors.push(`Skipped ${batchIds[i]}: document already exists in index.`);
            } else {
              report.errors.push(`Failed to check ${result.key || batchIds[i]}: ${result.errorMessage || 'Unknown indexing error'}`);
            }
          }
        } else {
          // No per-document results — assume all are new
          newDocuments.push(...batch);
          newDocumentIds.push(...batchIds);
        }

        // Upload only the documents that don't exist yet
        if (newDocuments.length > 0) {
          const uploadResponse = await uploadBatchWithRetry(searchClient, indexName, newDocuments, newDocumentIds, 'upload');
          const uploadResults = normalizeUploadResults(uploadResponse);

          if (uploadResults.length > 0) {
            for (const result of uploadResults) {
              if (result.succeeded === false || result.status === false) {
                report.errors.push(`Failed to insert ${result.key || 'unknown'}: ${result.errorMessage || 'Unknown indexing error'}`);
              } else {
                report.insertedCount += 1;
              }
            }
          } else {
            report.insertedCount += newDocuments.length;
          }
        }
      }
    } catch (error) {
      report.errors.push(`Batch upload failed for documents ${batchIds.join(', ')}: ${getErrorMessage(error)}`);
      throw Object.assign(error, { report, processedCount, total: knownTotal ?? processedCount });
    }

    await updateProgress();

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'aiSearchDataLoadBatchComplete',
        detail: {
          jobId,
          indexName,
          current: processedCount,
          total: knownTotal ?? processedCount,
          insertedCount: report.insertedCount,
          skippedCount: report.skippedCount,
        }
      }
    }));
  };

  try {
    for await (const entry of source) {
      const document = entry.value;
      const documentIndex = entry.index - 1;

      processedCount += 1;
      const validatedDocument = validateDocumentForIndex({
        document,
        documentIndex,
        keyFieldName,
        allowedFieldNames,
        vectorFieldConstraints,
        report,
      });

      if (!validatedDocument) {
        if (processedCount % BATCH_SIZE === 0) {
          await updateProgress();
        }

        continue;
      }

      uploadBatch.push(validatedDocument);
      uploadBatchIds.push(getDocumentIdentifier(validatedDocument, keyFieldName, documentIndex));

      if (uploadBatch.length === BATCH_SIZE) {
        await flushUploadBatch();
      }
    }

    await flushUploadBatch();
  } catch (error) {
    throw Object.assign(error, { report, processedCount, total: knownTotal ?? processedCount });
  }

  const finalTotal = knownTotal ?? processedCount;
  await updateAppJob(jobId, {
    status: jobStatus.COMPLETE,
    current: finalTotal,
    total: finalTotal,
    report,
  });

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'aiSearchDataLoadComplete',
      detail: {
        jobId,
        indexName,
        insertedCount: report.insertedCount,
        skippedCount: report.skippedCount,
        errorCount: report.errors.length,
        total: finalTotal,
      }
    }
  }));

  return report;
}