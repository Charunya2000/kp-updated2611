import {
  validateChunkSearchDoc,
  validateRequirementSearchDoc,
} from './docConversation1stPriIndexMapper.js';

const DEFAULT_CHUNK_INDEX_NAME = 'compliance-chunks-v1';
const DEFAULT_REQUIREMENT_INDEX_NAME = 'compliance-requirements-v1';
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BATCH_DELAY_MS = 100;
const DEFAULT_RETRY_BASE_DELAY_MS = 200;
const DEFAULT_RETRY_MAX_DELAY_MS = 4000;

function logWriterEvent(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    }
  }));
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function sleep(ms) {
  const delay = normalizePositiveInt(ms, 0);
  if (delay <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function isTransientError(error) {
  const status = Number(error?.statusCode || error?.status || 0);
  return status === 408 || status === 409 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function runWithRetry(action, {
  maxRetries,
  retryBaseDelayMs,
  retryMaxDelayMs,
  retryJitter,
}) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await action();
      return { result, retryCount: attempt };
    } catch (error) {
      if (!isTransientError(error) || attempt >= maxRetries) {
        throw error;
      }

      const exponential = retryBaseDelayMs * Math.pow(2, attempt);
      const jitter = retryJitter ? Math.floor(Math.random() * retryBaseDelayMs) : 0;
      const waitMs = Math.min(retryMaxDelayMs, exponential + jitter);
      await sleep(waitMs);
      attempt += 1;
    }
  }
}

function chunkArray(items = [], batchSize = DEFAULT_BATCH_SIZE) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const out = [];
  for (let i = 0; i < items.length; i += batchSize) {
    out.push(items.slice(i, i + batchSize));
  }
  return out;
}

function getInvalidDocuments(documents = [], validator) {
  return toArray(documents)
    .map((doc) => ({ doc, check: validator(doc) }))
    .filter((item) => !item.check.valid)
    .map((item) => ({
      id: item?.doc?.id || null,
      missing: item?.check?.missing || [],
    }));
}

async function uploadWithRetry({
  client,
  documents,
  maxRetries,
  retryBaseDelayMs,
  retryMaxDelayMs,
  retryJitter,
  retryBatchFloor = 10,
}) {
  try {
    const attempt = await runWithRetry(
      async () => client.uploadDocuments(documents),
      { maxRetries, retryBaseDelayMs, retryMaxDelayMs, retryJitter }
    );
    return {
      uploadedCount: documents.length,
      retryCount: attempt.retryCount,
    };
  } catch (error) {
    const is413 = Number(error?.statusCode) === 413;
    if (!is413 || maxRetries <= 0 || documents.length <= retryBatchFloor) {
      throw error;
    }

    const smallerBatchSize = Math.max(retryBatchFloor, Math.floor(documents.length / 2));
    const subBatches = chunkArray(documents, smallerBatchSize);

    let uploadedCount = 0;
    let retryCount = 0;
    for (const subBatch of subBatches) {
      const result = await uploadWithRetry({
        client,
        documents: subBatch,
        maxRetries: maxRetries - 1,
        retryBaseDelayMs,
        retryMaxDelayMs,
        retryJitter,
        retryBatchFloor,
      });
      uploadedCount += result.uploadedCount;
      retryCount += (result.retryCount + 1);
    }

    return {
      uploadedCount,
      retryCount,
    };
  }
}

async function writeDocumentsInBatches({
  client,
  documents,
  indexName,
  artifactLabel,
  batchSize,
  maxRetries,
  batchDelayMs,
  retryBaseDelayMs,
  retryMaxDelayMs,
  retryJitter,
}) {
  const normalizedDocs = toArray(documents);
  if (normalizedDocs.length === 0) {
    return {
      indexName,
      artifactLabel,
      documentCount: 0,
      uploadedCount: 0,
      batchCount: 0,
      retryCount: 0,
    };
  }

  const batches = chunkArray(normalizedDocs, batchSize);
  let uploadedCount = 0;
  let retryCount = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const result = await uploadWithRetry({
      client,
      documents: batch,
      maxRetries,
      retryBaseDelayMs,
      retryMaxDelayMs,
      retryJitter,
    });

    uploadedCount += result.uploadedCount;
    retryCount += result.retryCount;

    if (i < batches.length - 1) {
      await sleep(batchDelayMs);
    }
  }

  return {
    indexName,
    artifactLabel,
    documentCount: normalizedDocs.length,
    uploadedCount,
    batchCount: batches.length,
    retryCount,
  };
}

function resolveUpdateClient(indexName, deps = {}) {
  if (typeof deps?.getUpdateClient === 'function') {
    return deps.getUpdateClient(indexName);
  }

  if (indexName === deps?.chunkIndexName && deps?.chunkUpdateClient) {
    return deps.chunkUpdateClient;
  }

  if (indexName === deps?.requirementIndexName && deps?.requirementUpdateClient) {
    return deps.requirementUpdateClient;
  }

  throw new Error(`No update client available for index '${indexName}'. Provide deps.getUpdateClient(indexName).`);
}

function normalizeWriterConfig(options = {}, deps = {}) {
  return {
    chunkIndexName: String(options?.chunkIndexName || deps?.chunkIndexName || DEFAULT_CHUNK_INDEX_NAME).trim(),
    requirementIndexName: String(options?.requirementIndexName || deps?.requirementIndexName || DEFAULT_REQUIREMENT_INDEX_NAME).trim(),
    batchSize: normalizePositiveInt(options?.batchSize, DEFAULT_BATCH_SIZE),
    maxRetries: normalizePositiveInt(options?.maxRetries, DEFAULT_MAX_RETRIES),
    batchDelayMs: normalizePositiveInt(options?.batchDelayMs, DEFAULT_BATCH_DELAY_MS),
    retryBaseDelayMs: normalizePositiveInt(options?.retryBaseDelayMs, DEFAULT_RETRY_BASE_DELAY_MS),
    retryMaxDelayMs: normalizePositiveInt(options?.retryMaxDelayMs, DEFAULT_RETRY_MAX_DELAY_MS),
    retryJitter: options?.retryJitter !== false,
    strictValidation: options?.strictValidation !== false,
    emitLogs: options?.emitLogs !== false,
  };
}

export async function writeFirstPrinciplesSearchDocuments({
  chunkDocuments = [],
  requirementDocuments = [],
  conversationId = null,
  options = {},
} = {}, deps = {}) {
  const config = normalizeWriterConfig(options, deps);
  const logger = typeof deps?.logEvent === 'function' ? deps.logEvent : logWriterEvent;

  const invalidChunkDocs = getInvalidDocuments(chunkDocuments, validateChunkSearchDoc);
  const invalidRequirementDocs = getInvalidDocuments(requirementDocuments, validateRequirementSearchDoc);

  if (config.strictValidation && (invalidChunkDocs.length > 0 || invalidRequirementDocs.length > 0)) {
    const error = new Error('Search document validation failed for first-principles artifacts.');
    error.detail = {
      invalidChunkDocs,
      invalidRequirementDocs,
    };
    throw error;
  }

  const chunkClient = resolveUpdateClient(config.chunkIndexName, deps);
  const requirementClient = resolveUpdateClient(config.requirementIndexName, deps);

  if (config.emitLogs) {
    logger('firstPriIndexWriterStarted', {
      conversationId,
      chunkIndexName: config.chunkIndexName,
      requirementIndexName: config.requirementIndexName,
      chunkDocumentCount: toArray(chunkDocuments).length,
      requirementDocumentCount: toArray(requirementDocuments).length,
      invalidChunkDocCount: invalidChunkDocs.length,
      invalidRequirementDocCount: invalidRequirementDocs.length,
      strictValidation: config.strictValidation,
      batchSize: config.batchSize,
      batchDelayMs: config.batchDelayMs,
      maxRetries: config.maxRetries,
      retryBaseDelayMs: config.retryBaseDelayMs,
      retryMaxDelayMs: config.retryMaxDelayMs,
      retryJitter: config.retryJitter,
    });
  }

  const chunkWriteResult = await writeDocumentsInBatches({
    client: chunkClient,
    documents: chunkDocuments,
    indexName: config.chunkIndexName,
    artifactLabel: 'chunk',
    batchSize: config.batchSize,
    maxRetries: config.maxRetries,
    batchDelayMs: config.batchDelayMs,
    retryBaseDelayMs: config.retryBaseDelayMs,
    retryMaxDelayMs: config.retryMaxDelayMs,
    retryJitter: config.retryJitter,
  });

  const requirementWriteResult = await writeDocumentsInBatches({
    client: requirementClient,
    documents: requirementDocuments,
    indexName: config.requirementIndexName,
    artifactLabel: 'requirement',
    batchSize: config.batchSize,
    maxRetries: config.maxRetries,
    batchDelayMs: config.batchDelayMs,
    retryBaseDelayMs: config.retryBaseDelayMs,
    retryMaxDelayMs: config.retryMaxDelayMs,
    retryJitter: config.retryJitter,
  });

  const summary = {
    conversationId,
    chunkWriteResult,
    requirementWriteResult,
    invalidChunkDocs,
    invalidRequirementDocs,
  };

  if (config.emitLogs) {
    logger('firstPriIndexWriterCompleted', {
      conversationId,
      chunkUploadedCount: chunkWriteResult.uploadedCount,
      requirementUploadedCount: requirementWriteResult.uploadedCount,
      chunkBatchCount: chunkWriteResult.batchCount,
      requirementBatchCount: requirementWriteResult.batchCount,
      chunkRetryCount: chunkWriteResult.retryCount,
      requirementRetryCount: requirementWriteResult.retryCount,
      invalidChunkDocCount: invalidChunkDocs.length,
      invalidRequirementDocCount: invalidRequirementDocs.length,
    });
  }

  return summary;
}
