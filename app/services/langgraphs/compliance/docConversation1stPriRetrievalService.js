const DEFAULT_CHUNK_INDEX_NAME = 'compliance-chunks-v1';
const DEFAULT_REQUIREMENT_INDEX_NAME = 'compliance-requirements-v1';
const DEFAULT_TOP = 20;
const DEFAULT_RRF_K = 60;

function logRetrievalEvent(name, detail = {}) {
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

function buildTraceId(value, fallback = null) {
  const normalized = normalizeString(value);
  return normalized || fallback;
}

function getSearchScore(result) {
  if (typeof result?.score === 'number') return result.score;
  if (typeof result?.document?.['@search.score'] === 'number') return result.document['@search.score'];
  return 0;
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

async function collectSearchResults(searchResponse, {
  top = DEFAULT_TOP,
  resultType = 'unknown',
} = {}) {
  const out = [];
  for await (const result of searchResponse.results) {
    out.push({
      ...result,
      resultType,
      score: getSearchScore(result),
    });
    if (out.length >= top) break;
  }
  return out;
}

function buildConversationFilter(conversationId = '') {
  const id = normalizeString(conversationId);
  if (!id) return '';
  return `conversation_id eq '${id.replace(/'/g, "''")}'`;
}

function uniqueBounded(values = [], maxItems = 50) {
  const out = [];
  const seen = new Set();

  for (const raw of values) {
    const value = normalizeString(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= maxItems) break;
  }

  return out;
}

function summarizeResults(results = [], { maxIds = 50 } = {}) {
  const docs = (Array.isArray(results) ? results : []).map((item) => item?.document || {});

  return {
    resultCount: docs.length,
    resultIds: uniqueBounded(docs.map((doc) => doc?.id), maxIds),
    resultConversationIds: uniqueBounded(docs.map((doc) => doc?.conversation_id), maxIds),
    resultDocIds: uniqueBounded(docs.map((doc) => doc?.doc_id), maxIds),
    resultFileNames: uniqueBounded(docs.map((doc) => doc?.file_name), maxIds),
    resultSections: uniqueBounded(docs.map((doc) => doc?.section_number), maxIds),
    resultRequirementKeys: uniqueBounded(docs.map((doc) => doc?.requirement_key), maxIds),
    resultSourceChunkIds: uniqueBounded(docs.map((doc) => doc?.source_chunk_id), maxIds),
  };
}

function buildChunkSearchOptions(query = {}, embedding = null) {
  const searchText = normalizeString(query?.searchText, '*');
  const top = normalizePositiveInt(query?.top, DEFAULT_TOP);
  const options = {
    filter: normalizeString(query?.filter),
    top,
    select: query?.selectFields || [
      'id',
      'conversation_id',
      'doc_id',
      'file_name',
      'heading',
      'section_number',
      'content',
      'page_start',
      'page_end',
      'char_start',
      'char_end',
      'level',
      'parent_chunk_id',
    ],
  };

  if (Array.isArray(embedding) && embedding.length > 0) {
    options.embedding = embedding;
    options.vectorFields = ['content_vector'];
  }

  return { searchText, options, top };
}

function buildRequirementSearchOptions(query = {}, embedding = null) {
  const searchText = normalizeString(query?.searchText, '*');
  const top = normalizePositiveInt(query?.top, DEFAULT_TOP);
  const options = {
    filter: normalizeString(query?.filter),
    top,
    select: query?.selectFields || [
      'id',
      'requirement_key',
      'conversation_id',
      'doc_id',
      'file_name',
      'heading',
      'section_number',
      'category',
      'modality',
      'requirement_text',
      'condition_text',
      'exception_text',
      'normalized_actor',
      'normalized_action',
      'normalized_object',
      'deadline_value',
      'deadline_unit',
      'obligation_strength',
      'page_start',
      'page_end',
      'char_start',
      'char_end',
      'source_chunk_id',
    ],
  };

  if (Array.isArray(embedding) && embedding.length > 0) {
    options.embedding = embedding;
    options.vectorFields = ['requirement_vector'];
  }

  return { searchText, options, top };
}

async function maybeCreateEmbedding(queryText = '', deps = {}, options = {}) {
  if (typeof deps?.embedQuery !== 'function') return null;
  const text = normalizeString(queryText);
  if (!text || text === '*') return null;
  return deps.embedQuery({ text, model: options?.embeddingModel || '' });
}

export async function retrieveChunkArtifacts({
  conversationId = '',
  query = {},
  options = {},
} = {}, deps = {}) {
  const startedAt = Date.now();
  const logger = typeof deps?.logEvent === 'function' ? deps.logEvent : logRetrievalEvent;
  const indexName = normalizeString(options?.chunkIndexName || deps?.chunkIndexName, DEFAULT_CHUNK_INDEX_NAME);
  const client = resolveSearchClient(indexName, deps);
  const traceId = buildTraceId(options?.traceId);

  const filter = normalizeString(query?.filter) || buildConversationFilter(conversationId);
  const embedding = await maybeCreateEmbedding(query?.searchText || '*', deps, options);
  const built = buildChunkSearchOptions({ ...query, filter }, embedding);

  logger('firstPriChunkRetrievalStarted', {
    traceId,
    indexName,
    conversationId: normalizeString(conversationId) || null,
    request: {
      searchText: built.searchText,
      filter,
      top: built.top,
      selectFields: Array.isArray(built?.options?.select) ? built.options.select : [],
      vectorFields: Array.isArray(built?.options?.vectorFields) ? built.options.vectorFields : [],
      usedVector: Array.isArray(embedding) && embedding.length > 0,
      embeddingDimension: Array.isArray(embedding) ? embedding.length : 0,
    },
  });

  const response = await client.search(built.searchText, built.options);
  const results = await collectSearchResults(response, { top: built.top, resultType: 'chunk' });

  const resultSummary = summarizeResults(results, {
    maxIds: normalizePositiveInt(options?.maxLoggedResultIds, 50),
  });
  const durationMs = Date.now() - startedAt;

  logger('firstPriChunkRetrievalCompleted', {
    traceId,
    indexName,
    conversationId: normalizeString(conversationId) || null,
    request: {
      searchText: built.searchText,
      filter,
      top: built.top,
      selectFields: Array.isArray(built?.options?.select) ? built.options.select : [],
      vectorFields: Array.isArray(built?.options?.vectorFields) ? built.options.vectorFields : [],
      usedVector: Array.isArray(embedding) && embedding.length > 0,
      embeddingDimension: Array.isArray(embedding) ? embedding.length : 0,
    },
    response: {
      ...resultSummary,
      durationMs,
    },
  });

  return {
    indexName,
    results,
    diagnostics: {
      traceId,
      request: {
        searchText: built.searchText,
        filter,
        top: built.top,
        selectFields: Array.isArray(built?.options?.select) ? built.options.select : [],
        vectorFields: Array.isArray(built?.options?.vectorFields) ? built.options.vectorFields : [],
        usedVector: Array.isArray(embedding) && embedding.length > 0,
        embeddingDimension: Array.isArray(embedding) ? embedding.length : 0,
      },
      response: {
        ...resultSummary,
        durationMs,
      },
    },
  };
}

export async function retrieveRequirementArtifacts({
  conversationId = '',
  query = {},
  options = {},
} = {}, deps = {}) {
  const startedAt = Date.now();
  const logger = typeof deps?.logEvent === 'function' ? deps.logEvent : logRetrievalEvent;
  const indexName = normalizeString(options?.requirementIndexName || deps?.requirementIndexName, DEFAULT_REQUIREMENT_INDEX_NAME);
  const client = resolveSearchClient(indexName, deps);
  const traceId = buildTraceId(options?.traceId);

  const filter = normalizeString(query?.filter) || buildConversationFilter(conversationId);
  const embedding = await maybeCreateEmbedding(query?.searchText || '*', deps, options);
  const built = buildRequirementSearchOptions({ ...query, filter }, embedding);

  logger('firstPriRequirementRetrievalStarted', {
    traceId,
    indexName,
    conversationId: normalizeString(conversationId) || null,
    request: {
      searchText: built.searchText,
      filter,
      top: built.top,
      selectFields: Array.isArray(built?.options?.select) ? built.options.select : [],
      vectorFields: Array.isArray(built?.options?.vectorFields) ? built.options.vectorFields : [],
      usedVector: Array.isArray(embedding) && embedding.length > 0,
      embeddingDimension: Array.isArray(embedding) ? embedding.length : 0,
    },
  });

  const response = await client.search(built.searchText, built.options);
  const results = await collectSearchResults(response, { top: built.top, resultType: 'requirement' });

  const resultSummary = summarizeResults(results, {
    maxIds: normalizePositiveInt(options?.maxLoggedResultIds, 50),
  });
  const durationMs = Date.now() - startedAt;

  logger('firstPriRequirementRetrievalCompleted', {
    traceId,
    indexName,
    conversationId: normalizeString(conversationId) || null,
    request: {
      searchText: built.searchText,
      filter,
      top: built.top,
      selectFields: Array.isArray(built?.options?.select) ? built.options.select : [],
      vectorFields: Array.isArray(built?.options?.vectorFields) ? built.options.vectorFields : [],
      usedVector: Array.isArray(embedding) && embedding.length > 0,
      embeddingDimension: Array.isArray(embedding) ? embedding.length : 0,
    },
    response: {
      ...resultSummary,
      durationMs,
    },
  });

  return {
    indexName,
    results,
    diagnostics: {
      traceId,
      request: {
        searchText: built.searchText,
        filter,
        top: built.top,
        selectFields: Array.isArray(built?.options?.select) ? built.options.select : [],
        vectorFields: Array.isArray(built?.options?.vectorFields) ? built.options.vectorFields : [],
        usedVector: Array.isArray(embedding) && embedding.length > 0,
        embeddingDimension: Array.isArray(embedding) ? embedding.length : 0,
      },
      response: {
        ...resultSummary,
        durationMs,
      },
    },
  };
}

function buildFusionKey(item) {
  const doc = item?.document || {};
  const id = normalizeString(doc?.id);
  if (id) return id;

  return [
    normalizeString(doc?.requirement_key),
    normalizeString(doc?.source_chunk_id),
    normalizeString(doc?.section_number),
    normalizeString(doc?.file_name),
    normalizeString(doc?.heading),
    normalizeString(doc?.page_start),
    normalizeString(doc?.char_start),
  ].join('|');
}

function rrfScore(rank, k = DEFAULT_RRF_K) {
  return 1 / (k + rank);
}

export function fuseHybridRetrievalResults({
  requirementResults = [],
  chunkResults = [],
  options = {},
} = {}) {
  const k = normalizePositiveInt(options?.rrfK, DEFAULT_RRF_K);
  const requirementWeight = Number.isFinite(Number(options?.requirementWeight)) ? Number(options.requirementWeight) : 1.2;
  const chunkWeight = Number.isFinite(Number(options?.chunkWeight)) ? Number(options.chunkWeight) : 1.0;

  const fusion = new Map();

  const applyList = (items, weight, sourceLabel) => {
    (Array.isArray(items) ? items : []).forEach((item, idx) => {
      const rank = idx + 1;
      const key = buildFusionKey(item);
      if (!key) return;

      const existing = fusion.get(key) || {
        key,
        item,
        fusedScore: 0,
        componentScores: [],
      };

      const component = rrfScore(rank, k) * weight;
      existing.fusedScore += component;
      existing.componentScores.push({
        source: sourceLabel,
        rank,
        weight,
        score: component,
      });

      // Prefer requirement artifact representation when duplicate key occurs.
      if (sourceLabel === 'requirement') {
        existing.item = item;
      }

      fusion.set(key, existing);
    });
  };

  applyList(requirementResults, requirementWeight, 'requirement');
  applyList(chunkResults, chunkWeight, 'chunk');

  return Array.from(fusion.values())
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .map((entry) => ({
      ...entry.item,
      fusedScore: Number(entry.fusedScore.toFixed(6)),
      fusion: entry.componentScores,
    }));
}

function choosePage(document = {}) {
  const start = Number(document?.page_start);
  const end = Number(document?.page_end);
  if (Number.isFinite(start) && start > 0) return start;
  if (Number.isFinite(end) && end > 0) return end;
  return null;
}

export function reconstructCitation(document = {}, {
  includeOffsets = false,
  includeSection = true,
} = {}) {
  const fileName = normalizeString(document?.file_name, 'Unknown File');
  const page = choosePage(document);
  const sectionNumber = normalizeString(document?.section_number);
  const charStart = Number(document?.char_start);
  const charEnd = Number(document?.char_end);

  const pageLabel = Number.isFinite(page) && page > 0 ? page : 'n/a';
  const sectionLabel = includeSection && sectionNumber ? ` §${sectionNumber}` : '';

  let citation = `[${fileName}:${pageLabel}${sectionLabel}]`;
  if (includeOffsets && Number.isFinite(charStart) && Number.isFinite(charEnd)) {
    citation += ` (chars ${charStart}-${charEnd})`;
  }

  return citation;
}

export function reconstructCitationsFromResults(results = [], options = {}) {
  return (Array.isArray(results) ? results : []).map((result) => {
    const document = result?.document || {};
    return {
      id: normalizeString(document?.id),
      citation: reconstructCitation(document, options),
      file_name: normalizeString(document?.file_name),
      page_start: Number(document?.page_start || 0) || null,
      section_number: normalizeString(document?.section_number),
    };
  });
}
