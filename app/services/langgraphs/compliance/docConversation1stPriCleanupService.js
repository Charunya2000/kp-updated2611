const DEFAULT_CHUNK_INDEX_NAME = 'compliance-chunks-v1';
const DEFAULT_REQUIREMENT_INDEX_NAME = 'compliance-requirements-v1';
const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_DELETE_BATCH_SIZE = 500;
const DEFAULT_DELETE_BATCH_DELAY_MS = 50;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 200;
const DEFAULT_RETRY_MAX_DELAY_MS = 4000;

function logCleanupEvent(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    }
  }));
}

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function escapeODataString(value) {
  return String(value || '').replace(/'/g, "''");
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

function chunkArray(items = [], chunkSize = DEFAULT_DELETE_BATCH_SIZE) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const out = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize));
  }
  return out;
}

function resolveSearchClient(indexName, deps = {}) {
  if (typeof deps?.getSearchClient === 'function') {
    return deps.getSearchClient(indexName);
  }

  if (indexName === deps?.chunkIndexName && deps?.chunkSearchClient) {
    return deps.chunkSearchClient;
  }

  if (indexName === deps?.requirementIndexName && deps?.requirementSearchClient) {
    return deps.requirementSearchClient;
  }

  throw new Error(`No search client available for index '${indexName}'. Provide deps.getSearchClient(indexName).`);
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

async function fetchIdsForConversation({
  searchClient,
  conversationId,
  pageSize,
  maxScan,
  maxRetries,
  retryBaseDelayMs,
  retryMaxDelayMs,
  retryJitter,
}) {
  const ids = [];
  let skip = 0;
  let retryCount = 0;

  while (ids.length < maxScan) {
    const attempt = await runWithRetry(
      async () => searchClient.search('*', {
        filter: `conversation_id eq '${conversationId.replace(/'/g, "''")}'`,
        select: ['id'],
        top: pageSize,
        skip,
      }),
      { maxRetries, retryBaseDelayMs, retryMaxDelayMs, retryJitter }
    );

    const response = attempt.result;
    retryCount += attempt.retryCount;

    const pageIds = [];
    for await (const result of response.results) {
      const id = normalizeString(result?.document?.id);
      if (id) pageIds.push(id);
    }

    if (pageIds.length === 0) break;

    ids.push(...pageIds);
    skip += pageSize;

    if (pageIds.length < pageSize) break;
  }

  return {
    ids: Array.from(new Set(ids)).slice(0, maxScan),
    retryCount,
  };
}

async function fetchIdsForFilter({
  searchClient,
  filter,
  pageSize,
  maxScan,
  maxRetries,
  retryBaseDelayMs,
  retryMaxDelayMs,
  retryJitter,
}) {
  const ids = [];
  let skip = 0;
  let retryCount = 0;

  while (ids.length < maxScan) {
    const attempt = await runWithRetry(
      async () => searchClient.search('*', {
        filter,
        select: ['id'],
        top: pageSize,
        skip,
      }),
      { maxRetries, retryBaseDelayMs, retryMaxDelayMs, retryJitter }
    );

    const response = attempt.result;
    retryCount += attempt.retryCount;

    const pageIds = [];
    for await (const result of response.results) {
      const id = normalizeString(result?.document?.id);
      if (id) pageIds.push(id);
    }

    if (pageIds.length === 0) break;

    ids.push(...pageIds);
    skip += pageSize;

    if (pageIds.length < pageSize) break;
  }

  return {
    ids: Array.from(new Set(ids)).slice(0, maxScan),
    retryCount,
  };
}

function buildDocumentScopeFilter({ fileName, lob, excludeConversationId } = {}) {
  const normalizedFileName = normalizeString(fileName);
  if (!normalizedFileName) {
    throw new Error('fileName is required.');
  }

  const conditions = [
    `file_name eq '${escapeODataString(normalizedFileName)}'`,
  ];

  const normalizedLob = normalizeString(lob);
  if (normalizedLob) {
    conditions.push(`lob eq '${escapeODataString(normalizedLob)}'`);
  }

  const normalizedExcludeConversationId = normalizeString(excludeConversationId);
  if (normalizedExcludeConversationId) {
    conditions.push(`conversation_id ne '${escapeODataString(normalizedExcludeConversationId)}'`);
  }

  return {
    filter: conditions.join(' and '),
    fileName: normalizedFileName,
    lob: normalizedLob || null,
    excludeConversationId: normalizedExcludeConversationId || null,
  };
}

async function deleteIdsInBatches({
  updateClient,
  ids,
  batchSize,
  batchDelayMs,
  maxRetries,
  retryBaseDelayMs,
  retryMaxDelayMs,
  retryJitter,
}) {
  const batches = chunkArray(ids, batchSize);
  let deletedCount = 0;
  let retryCount = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const docs = batches[i].map((id) => ({ id }));
    const attempt = await runWithRetry(
      async () => updateClient.deleteDocuments(docs),
      { maxRetries, retryBaseDelayMs, retryMaxDelayMs, retryJitter }
    );
    retryCount += attempt.retryCount;
    deletedCount += docs.length;

    if (i < batches.length - 1) {
      await sleep(batchDelayMs);
    }
  }

  return {
    deletedCount,
    batchCount: batches.length,
    retryCount,
  };
}

function normalizeCleanupConfig(options = {}, deps = {}) {
  return {
    chunkIndexName: normalizeString(options?.chunkIndexName || deps?.chunkIndexName, DEFAULT_CHUNK_INDEX_NAME),
    requirementIndexName: normalizeString(options?.requirementIndexName || deps?.requirementIndexName, DEFAULT_REQUIREMENT_INDEX_NAME),
    pageSize: normalizePositiveInt(options?.pageSize, DEFAULT_PAGE_SIZE),
    maxScan: normalizePositiveInt(options?.maxScan, 50000),
    deleteBatchSize: normalizePositiveInt(options?.deleteBatchSize, DEFAULT_DELETE_BATCH_SIZE),
    deleteBatchDelayMs: normalizePositiveInt(options?.deleteBatchDelayMs, DEFAULT_DELETE_BATCH_DELAY_MS),
    maxRetries: normalizePositiveInt(options?.maxRetries, DEFAULT_MAX_RETRIES),
    retryBaseDelayMs: normalizePositiveInt(options?.retryBaseDelayMs, DEFAULT_RETRY_BASE_DELAY_MS),
    retryMaxDelayMs: normalizePositiveInt(options?.retryMaxDelayMs, DEFAULT_RETRY_MAX_DELAY_MS),
    retryJitter: options?.retryJitter !== false,
  };
}

export async function listFirstPrinciplesArtifactsByConversationId({
  conversationId,
  options = {},
} = {}, deps = {}) {
  const config = normalizeCleanupConfig(options, deps);
  const normalizedConversationId = normalizeString(conversationId);
  if (!normalizedConversationId) {
    throw new Error('conversationId is required.');
  }

  const chunkIndexName = config.chunkIndexName;
  const requirementIndexName = config.requirementIndexName;

  const chunkSearchClient = resolveSearchClient(chunkIndexName, deps);
  const requirementSearchClient = resolveSearchClient(requirementIndexName, deps);

  const [chunkSearchResult, requirementSearchResult] = await Promise.all([
    fetchIdsForConversation({
      searchClient: chunkSearchClient,
      conversationId: normalizedConversationId,
      pageSize: config.pageSize,
      maxScan: config.maxScan,
      maxRetries: config.maxRetries,
      retryBaseDelayMs: config.retryBaseDelayMs,
      retryMaxDelayMs: config.retryMaxDelayMs,
      retryJitter: config.retryJitter,
    }),
    fetchIdsForConversation({
      searchClient: requirementSearchClient,
      conversationId: normalizedConversationId,
      pageSize: config.pageSize,
      maxScan: config.maxScan,
      maxRetries: config.maxRetries,
      retryBaseDelayMs: config.retryBaseDelayMs,
      retryMaxDelayMs: config.retryMaxDelayMs,
      retryJitter: config.retryJitter,
    }),
  ]);

  return {
    conversationId: normalizedConversationId,
    chunkIndexName,
    requirementIndexName,
    chunkIds: chunkSearchResult.ids,
    requirementIds: requirementSearchResult.ids,
    chunkSearchRetryCount: chunkSearchResult.retryCount,
    requirementSearchRetryCount: requirementSearchResult.retryCount,
  };
}

export async function deleteFirstPrinciplesArtifactsByConversationId({
  conversationId,
  options = {},
} = {}, deps = {}) {
  const logger = typeof deps?.logEvent === 'function' ? deps.logEvent : logCleanupEvent;
  const startedAt = Date.now();
  const config = normalizeCleanupConfig(options, deps);

  const normalizedConversationId = normalizeString(conversationId);
  if (!normalizedConversationId) {
    throw new Error('conversationId is required.');
  }

  const dryRun = options?.dryRun === true;

  const listing = await listFirstPrinciplesArtifactsByConversationId({
    conversationId: normalizedConversationId,
    options,
  }, deps);

  logger('firstPriCleanupListed', {
    conversationId: normalizedConversationId,
    chunkIndexName: listing.chunkIndexName,
    requirementIndexName: listing.requirementIndexName,
    chunkCount: listing.chunkIds.length,
    requirementCount: listing.requirementIds.length,
    chunkSearchRetryCount: listing.chunkSearchRetryCount,
    requirementSearchRetryCount: listing.requirementSearchRetryCount,
    dryRun,
    deleteBatchSize: config.deleteBatchSize,
    deleteBatchDelayMs: config.deleteBatchDelayMs,
    maxRetries: config.maxRetries,
    retryBaseDelayMs: config.retryBaseDelayMs,
    retryMaxDelayMs: config.retryMaxDelayMs,
    retryJitter: config.retryJitter,
  });

  if (dryRun) {
    return {
      conversationId: normalizedConversationId,
      dryRun: true,
      chunkIndexName: listing.chunkIndexName,
      requirementIndexName: listing.requirementIndexName,
      chunkFoundCount: listing.chunkIds.length,
      requirementFoundCount: listing.requirementIds.length,
      deletedChunkCount: 0,
      deletedRequirementCount: 0,
      durationMs: Date.now() - startedAt,
      sampleChunkIds: listing.chunkIds.slice(0, 10),
      sampleRequirementIds: listing.requirementIds.slice(0, 10),
    };
  }

  const chunkUpdateClient = resolveUpdateClient(listing.chunkIndexName, deps);
  const requirementUpdateClient = resolveUpdateClient(listing.requirementIndexName, deps);

  const chunkDeleteResult = await deleteIdsInBatches({
    updateClient: chunkUpdateClient,
    ids: listing.chunkIds,
    batchSize: config.deleteBatchSize,
    batchDelayMs: config.deleteBatchDelayMs,
    maxRetries: config.maxRetries,
    retryBaseDelayMs: config.retryBaseDelayMs,
    retryMaxDelayMs: config.retryMaxDelayMs,
    retryJitter: config.retryJitter,
  });

  const requirementDeleteResult = await deleteIdsInBatches({
    updateClient: requirementUpdateClient,
    ids: listing.requirementIds,
    batchSize: config.deleteBatchSize,
    batchDelayMs: config.deleteBatchDelayMs,
    maxRetries: config.maxRetries,
    retryBaseDelayMs: config.retryBaseDelayMs,
    retryMaxDelayMs: config.retryMaxDelayMs,
    retryJitter: config.retryJitter,
  });

  const summary = {
    conversationId: normalizedConversationId,
    dryRun: false,
    chunkIndexName: listing.chunkIndexName,
    requirementIndexName: listing.requirementIndexName,
    chunkFoundCount: listing.chunkIds.length,
    requirementFoundCount: listing.requirementIds.length,
    deletedChunkCount: chunkDeleteResult.deletedCount,
    deletedRequirementCount: requirementDeleteResult.deletedCount,
    chunkDeleteBatchCount: chunkDeleteResult.batchCount,
    requirementDeleteBatchCount: requirementDeleteResult.batchCount,
    chunkDeleteRetryCount: chunkDeleteResult.retryCount,
    requirementDeleteRetryCount: requirementDeleteResult.retryCount,
    chunkSearchRetryCount: listing.chunkSearchRetryCount,
    requirementSearchRetryCount: listing.requirementSearchRetryCount,
    durationMs: Date.now() - startedAt,
  };

  logger('firstPriCleanupCompleted', summary);

  return summary;
}

export async function listFirstPrinciplesArtifactsByDocument({
  fileName,
  lob,
  excludeConversationId,
  options = {},
} = {}, deps = {}) {
  const config = normalizeCleanupConfig(options, deps);
  const chunkIndexName = config.chunkIndexName;
  const requirementIndexName = config.requirementIndexName;

  const chunkSearchClient = resolveSearchClient(chunkIndexName, deps);
  const requirementSearchClient = resolveSearchClient(requirementIndexName, deps);

  const scope = buildDocumentScopeFilter({ fileName, lob, excludeConversationId });

  const [chunkSearchResult, requirementSearchResult] = await Promise.all([
    fetchIdsForFilter({
      searchClient: chunkSearchClient,
      filter: scope.filter,
      pageSize: config.pageSize,
      maxScan: config.maxScan,
      maxRetries: config.maxRetries,
      retryBaseDelayMs: config.retryBaseDelayMs,
      retryMaxDelayMs: config.retryMaxDelayMs,
      retryJitter: config.retryJitter,
    }),
    fetchIdsForFilter({
      searchClient: requirementSearchClient,
      filter: scope.filter,
      pageSize: config.pageSize,
      maxScan: config.maxScan,
      maxRetries: config.maxRetries,
      retryBaseDelayMs: config.retryBaseDelayMs,
      retryMaxDelayMs: config.retryMaxDelayMs,
      retryJitter: config.retryJitter,
    }),
  ]);

  return {
    fileName: scope.fileName,
    lob: scope.lob,
    excludeConversationId: scope.excludeConversationId,
    filter: scope.filter,
    chunkIndexName,
    requirementIndexName,
    chunkIds: chunkSearchResult.ids,
    requirementIds: requirementSearchResult.ids,
    chunkSearchRetryCount: chunkSearchResult.retryCount,
    requirementSearchRetryCount: requirementSearchResult.retryCount,
  };
}

export async function deleteFirstPrinciplesArtifactsByDocument({
  fileName,
  lob,
  excludeConversationId,
  options = {},
} = {}, deps = {}) {
  const logger = typeof deps?.logEvent === 'function' ? deps.logEvent : logCleanupEvent;
  const startedAt = Date.now();
  const config = normalizeCleanupConfig(options, deps);
  const dryRun = options?.dryRun === true;

  const listing = await listFirstPrinciplesArtifactsByDocument({
    fileName,
    lob,
    excludeConversationId,
    options,
  }, deps);

  logger('firstPriCleanupByDocumentListed', {
    fileName: listing.fileName,
    lob: listing.lob,
    excludeConversationId: listing.excludeConversationId,
    filter: listing.filter,
    chunkIndexName: listing.chunkIndexName,
    requirementIndexName: listing.requirementIndexName,
    chunkCount: listing.chunkIds.length,
    requirementCount: listing.requirementIds.length,
    chunkSearchRetryCount: listing.chunkSearchRetryCount,
    requirementSearchRetryCount: listing.requirementSearchRetryCount,
    dryRun,
    deleteBatchSize: config.deleteBatchSize,
    deleteBatchDelayMs: config.deleteBatchDelayMs,
    maxRetries: config.maxRetries,
    retryBaseDelayMs: config.retryBaseDelayMs,
    retryMaxDelayMs: config.retryMaxDelayMs,
    retryJitter: config.retryJitter,
  });

  if (dryRun) {
    return {
      fileName: listing.fileName,
      lob: listing.lob,
      excludeConversationId: listing.excludeConversationId,
      dryRun: true,
      chunkIndexName: listing.chunkIndexName,
      requirementIndexName: listing.requirementIndexName,
      chunkFoundCount: listing.chunkIds.length,
      requirementFoundCount: listing.requirementIds.length,
      deletedChunkCount: 0,
      deletedRequirementCount: 0,
      durationMs: Date.now() - startedAt,
      sampleChunkIds: listing.chunkIds.slice(0, 10),
      sampleRequirementIds: listing.requirementIds.slice(0, 10),
    };
  }

  const chunkUpdateClient = resolveUpdateClient(listing.chunkIndexName, deps);
  const requirementUpdateClient = resolveUpdateClient(listing.requirementIndexName, deps);

  const chunkDeleteResult = await deleteIdsInBatches({
    updateClient: chunkUpdateClient,
    ids: listing.chunkIds,
    batchSize: config.deleteBatchSize,
    batchDelayMs: config.deleteBatchDelayMs,
    maxRetries: config.maxRetries,
    retryBaseDelayMs: config.retryBaseDelayMs,
    retryMaxDelayMs: config.retryMaxDelayMs,
    retryJitter: config.retryJitter,
  });

  const requirementDeleteResult = await deleteIdsInBatches({
    updateClient: requirementUpdateClient,
    ids: listing.requirementIds,
    batchSize: config.deleteBatchSize,
    batchDelayMs: config.deleteBatchDelayMs,
    maxRetries: config.maxRetries,
    retryBaseDelayMs: config.retryBaseDelayMs,
    retryMaxDelayMs: config.retryMaxDelayMs,
    retryJitter: config.retryJitter,
  });

  const summary = {
    fileName: listing.fileName,
    lob: listing.lob,
    excludeConversationId: listing.excludeConversationId,
    dryRun: false,
    chunkIndexName: listing.chunkIndexName,
    requirementIndexName: listing.requirementIndexName,
    chunkFoundCount: listing.chunkIds.length,
    requirementFoundCount: listing.requirementIds.length,
    deletedChunkCount: chunkDeleteResult.deletedCount,
    deletedRequirementCount: requirementDeleteResult.deletedCount,
    chunkDeleteBatchCount: chunkDeleteResult.batchCount,
    requirementDeleteBatchCount: requirementDeleteResult.batchCount,
    chunkDeleteRetryCount: chunkDeleteResult.retryCount,
    requirementDeleteRetryCount: requirementDeleteResult.retryCount,
    chunkSearchRetryCount: listing.chunkSearchRetryCount,
    requirementSearchRetryCount: listing.requirementSearchRetryCount,
    durationMs: Date.now() - startedAt,
  };

  logger('firstPriCleanupByDocumentCompleted', summary);

  return summary;
}
