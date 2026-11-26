import path from 'node:path';
import fs from 'node:fs/promises';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { AgentSkillBucket, AgentSkillBucketOrder } from '@/app/types/agentSkills';

const DEFAULT_LIMIT_PER_BUCKET = 3;
const MOCK_DATA_PATH = path.join(process.cwd(), 'infoSourceData', 'agentSkillMocks.json');
const ASSET_INDEX = 'infosource_assets';
const PAGE_INDEX = 'infosource_pages_2';
const AGENT_SKILLS_SEMANTIC_CONFIG = process.env.INFOSEARCH_AGENT_SKILLS_SEMANTIC_CONFIG || null;
const AGENT_SKILLS_MIN_SCORE = parsePositiveFloat(process.env.INFOSEARCH_AGENT_SKILLS_MIN_SCORE, 0.2);
const AGENT_SKILLS_TOP_MULTIPLIER = parsePositiveInt(process.env.INFOSEARCH_AGENT_SKILLS_TOP_MULTIPLIER, 8);
const AGENT_SKILLS_MIN_TOP = parsePositiveInt(process.env.INFOSEARCH_AGENT_SKILLS_MIN_TOP, 16);
const AGENT_SKILLS_MAX_DOCUMENTS = parsePositiveInt(process.env.INFOSEARCH_AGENT_SKILLS_MAX_DOCUMENTS, 40);
const AGENT_SKILLS_MIN_DOCS_AFTER_FILTER = parsePositiveInt(process.env.INFOSEARCH_AGENT_SKILLS_MIN_DOCS_AFTER_FILTER, 8);
const AGENT_SKILLS_SEMANTIC_MODE = normalizeSemanticMode(process.env.INFOSEARCH_AGENT_SKILLS_SEMANTIC_MODE || 'auto');
const AGENT_SKILLS_MARKET_BOOST = parsePositiveFloat(process.env.INFOSEARCH_AGENT_SKILLS_MARKET_BOOST, 0.08);
const AGENT_SKILLS_REGION_BOOST = parsePositiveFloat(process.env.INFOSEARCH_AGENT_SKILLS_REGION_BOOST, 0.1);
const AGENT_SKILLS_QUERY_TERM_BOOST = parsePositiveFloat(process.env.INFOSEARCH_AGENT_SKILLS_QUERY_TERM_BOOST, 0.02);

const ASSET_SELECT_FIELDS = [
  'id',
  'document_title',
  'document_path',
  'owner',
  'last_reviewed',
  'keywords',
  'market',
  'region',
  'category',
  'section_title'
];

const PAGE_SELECT_FIELDS = [
  'id',
  'title',
  'path',
  'owner',
  'last_reviewed',
  'market',
  'section_title'
];

const AGENT_SKILL_BUCKET_CONFIG = [
  {
    id: AgentSkillBucket.APPROACH,
    label: 'Approach',
    description: 'Advise on preparation, effective presentation, and key selling points.'
  },
  {
    id: AgentSkillBucket.IMPRESS,
    label: 'Impress',
    description: 'KP differentiators, primary proof points, and closing statements.'
  },
  {
    id: AgentSkillBucket.FOLLOW_UP,
    label: 'Follow-up',
    description: 'Follow-up stems, top points to reiterate, and specific asks.'
  },
  {
    id: AgentSkillBucket.FINETUNE,
    label: 'Finetune',
    description: 'Pitfalls to avoid plus Q&A preparation.'
  }
];

let cachedMockDocuments = null;
let cachedSearchConfig = null;
const searchClients = {};

/**
 * Primary entry point for downstream consumers (API routes, background jobs, etc.).
 * Until Azure AI Search wiring is complete we always fall back to mock data so the
 * UI surface can be built in parallel with the Linux batch.
 */
export async function getAgentSkills(payload = {}) {
  const options = normalizeAgentSkillRequest(payload);
  const startedAt = Date.now();
  const { documents, dataSource } = await resolveAgentSkillDocuments(options);
  const buckets = bucketizeDocuments(documents, options.limitPerBucket);
  const roleResponse = buildRoleResponse(options, buckets);

  logAgentSkillsEvent('AgentSkills.resolveComplete', {
    mode: options.mode,
    dataSource,
    queryLength: options.query?.length || 0,
    market: options.market,
    region: options.region,
    memoryContextCount: options.memoryContext.length,
    limitPerBucket: options.limitPerBucket,
    documentCount: documents.length,
    elapsedMs: Date.now() - startedAt
  });

  return {
    options,
    buckets,
    roleResponse,
    diagnostics: {
      totalDocuments: documents.length,
      dataSource,
      appliedFilters: options.filters,
    }
  };
}

function buildRoleResponse(options, buckets) {
  const flattenedInsights = flattenInsights(buckets);
  const citationLedger = buildCitationLedger(flattenedInsights);
  const role = (options.userRole || 'Seller').toLowerCase();

  if (role === 'marketer') {
    return buildMarketerResponse(flattenedInsights, citationLedger, options);
  }

  return buildSellerResponse(flattenedInsights, citationLedger, options);
}

function flattenInsights(buckets = []) {
  return buckets.flatMap((bucket) => {
    const insights = Array.isArray(bucket.insights) ? bucket.insights : [];
    return insights.map((insight) => ({ ...insight, bucketId: bucket.id, bucketLabel: bucket.label }));
  });
}

function buildCitationLedger(insights = []) {
  const signatures = new Map();
  const citations = [];
  const footnotesByInsightId = {};

  insights.forEach((insight) => {
    const citation = insight.citation || {};
    const signature = createCitationSignature(citation);

    if (!signatures.has(signature)) {
      const footnote = citations.length + 1;
      signatures.set(signature, footnote);
      citations.push({
        footnote,
        sourceTitle: citation.sourceTitle || 'Source unavailable',
        url: citation.url || null,
        region: citation.region || insight.metadata?.region || 'N/A',
        documentOwner: citation.documentOwner || insight.metadata?.owner || 'N/A',
        lastUpdated: citation.lastUpdated || 'N/A'
      });
    }

    footnotesByInsightId[insight.id] = signatures.get(signature);
  });

  return {
    citations,
    footnotesByInsightId
  };
}

function buildSellerResponse(insights, citationLedger, options) {
  const topInsights = insights.slice(0, 3);
  const memoryLines = formatMemoryContextLines(options.memoryContext);
  const cfoReadyBullets = topInsights.length > 0
    ? topInsights.map((insight) => {
      const footnote = citationLedger.footnotesByInsightId[insight.id];
      return `${insight.summary} [${footnote}]`;
    })
    : ['Information not available in the current plan documents.'];

  const closingQuestion = topInsights.length > 0
    ? `Which of these themes should we prioritize first for your ${options.market || options.region || 'target'} renewal strategy?`
    : 'Which business outcome should we prioritize once additional plan documentation is available?';

  const markdown = [
    ...(memoryLines.length > 0 ? ['### Memory Context', ...memoryLines, ''] : []),
    '### CFO-Ready Points',
    ...cfoReadyBullets.map((bullet) => `- ${bullet}`),
    '',
    '### Closing Question',
    `${closingQuestion}`,
    '',
    '### Integration Trigger',
    '```json',
    JSON.stringify({
      action: 'generate_battlecard_slide',
      state: options.region || options.market || 'Unknown',
      theme: 'Network_Density'
    }),
    '```',
    '',
    renderCitationSection(citationLedger.citations)
  ].join('\n');

  return {
    role: 'Seller',
    memoryContext: options.memoryContext,
    cfoReadyBullets,
    closingQuestion,
    integrationTrigger: {
      action: 'generate_battlecard_slide',
      state: options.region || options.market || 'Unknown',
      theme: 'Network_Density'
    },
    citations: citationLedger.citations,
    markdown
  };
}

function buildMarketerResponse(insights, citationLedger, options) {
  const topInsights = insights.slice(0, 3);
  const memoryLines = formatMemoryContextLines(options.memoryContext);
  const marketGapAnalysis = topInsights.length > 0
    ? topInsights.map((insight) => {
      const footnote = citationLedger.footnotesByInsightId[insight.id];
      return `${insight.summary} [${footnote}]`;
    })
    : ['Information not available in the current plan documents.'];

  const messagingPivot = topInsights.length > 0
    ? `Shift campaign emphasis toward ${options.market || options.industry || 'priority segment'} buyer pain points backed by indexed InfoSource proof.`
    : 'Hold messaging changes until additional indexed plan content is available.';

  const markdown = [
    ...(memoryLines.length > 0 ? ['### Memory Context', ...memoryLines, ''] : []),
    '### Market Gap Analysis',
    ...marketGapAnalysis.map((line) => `- ${line}`),
    '',
    '### Messaging Pivot',
    `${messagingPivot}`,
    '',
    '### Integration Trigger',
    '```json',
    JSON.stringify({
      action: 'create_audience_segment',
      criteria: `at_risk_members_${(options.region || options.market || 'Unknown').replace(/\s+/g, '_')}`
    }),
    '```',
    '',
    renderCitationSection(citationLedger.citations)
  ].join('\n');

  return {
    role: 'Marketer',
    memoryContext: options.memoryContext,
    marketGapAnalysis,
    messagingPivot,
    integrationTrigger: {
      action: 'create_audience_segment',
      criteria: `at_risk_members_${(options.region || options.market || 'Unknown').replace(/\s+/g, '_')}`
    },
    citations: citationLedger.citations,
    markdown
  };
}

function renderCitationSection(citations = []) {
  if (!citations.length) {
    return '### Citations\n- Information not available in the current plan documents.';
  }

  const lines = ['### Citations'];
  citations.forEach((citation) => {
    const sourceText = citation.url
      ? `[${citation.sourceTitle}](${citation.url})`
      : citation.sourceTitle;
    lines.push(`- [${citation.footnote}] Source: ${sourceText}; Region: ${citation.region}; Document Owner: ${citation.documentOwner}; Last Updated/Reviewed: ${citation.lastUpdated}`);
  });
  return lines.join('\n');
}

function createCitationSignature(citation = {}) {
  return [
    citation.sourceTitle || '',
    citation.url || '',
    citation.region || '',
    citation.documentOwner || '',
    citation.lastUpdated || ''
  ].map((value) => String(value).trim().toLowerCase()).join('::');
}

export function normalizeAgentSkillRequest(payload = {}) {
  const market = payload.market?.trim?.() || payload.filters?.market || null;
  const region = payload.region?.trim?.() || market;

  const limitPerBucket = Number.isInteger(payload.limitPerBucket) && payload.limitPerBucket > 0
    ? payload.limitPerBucket
    : DEFAULT_LIMIT_PER_BUCKET;

  const requestedMode = typeof payload.mode === 'string' ? payload.mode.toLowerCase() : 'auto';
  const mode = ['live', 'mock'].includes(requestedMode) ? requestedMode : 'auto';
  const retrieval = normalizeRetrievalConfig(payload.retrieval, limitPerBucket);

  return {
    teamName: payload.teamName?.trim() || null,
    assistantName: payload.assistantName?.trim() || null,
    smartNoteId: payload.smartNoteId?.trim() || null,
    query: payload.query?.trim() || '',
    userRole: payload.userRole?.trim() || 'Seller',
    region: region || null,
    market,
    industry: payload.industry?.trim() || null,
    memoryContext: normalizeMemoryContext(payload.memoryContext),
    limitPerBucket,
    mode,
    retrieval,
    filters: {
      region: payload.filters?.region || region || null,
      market,
      category: payload.filters?.category || null,
    },
  };
}

async function resolveAgentSkillDocuments(options) {
  if (Array.isArray(options.documents)) {
    logAgentSkillsEvent('AgentSkills.resolveInlineDocuments', {
      mode: options.mode,
      documentCount: options.documents.length
    });
    return { documents: options.documents, dataSource: 'inline' };
  }

  if (options.mode === 'mock') {
    logAgentSkillsEvent('AgentSkills.resolveMockMode', {
      mode: options.mode,
      market: options.market,
      region: options.region
    });
    return { documents: await loadMockAgentSkillDocuments(), dataSource: 'mock' };
  }

  try {
    const liveDocuments = await loadLiveAgentSkillDocuments(options);
    if (liveDocuments.length > 0) {
      logAgentSkillsEvent('AgentSkills.resolveLiveSuccess', {
        mode: options.mode,
        market: options.market,
        region: options.region,
        documentCount: liveDocuments.length
      });
      return { documents: liveDocuments, dataSource: 'live' };
    }

    const hasScopedFilters = Boolean(
      options.market
      || options.region
      || options.filters?.market
      || options.filters?.region
    );

    if (hasScopedFilters) {
      logAgentSkillsEvent('AgentSkills.resolveLiveRetryUnfiltered', {
        mode: options.mode,
        market: options.market,
        region: options.region
      });

      const unfilteredOptions = {
        ...options,
        market: null,
        region: null,
        filters: {
          ...(options.filters || {}),
          market: null,
          region: null
        }
      };

      const unfilteredLiveDocuments = await loadLiveAgentSkillDocuments(unfilteredOptions);
      if (unfilteredLiveDocuments.length > 0) {
        logAgentSkillsEvent('AgentSkills.resolveLiveUnfilteredSuccess', {
          mode: options.mode,
          originalMarket: options.market,
          originalRegion: options.region,
          documentCount: unfilteredLiveDocuments.length
        });
        return { documents: unfilteredLiveDocuments, dataSource: 'live-unfiltered' };
      }
    }

    if (options.mode === 'live') {
      logAgentSkillsEvent('AgentSkills.resolveLiveEmpty', {
        mode: options.mode,
        market: options.market,
        region: options.region
      });
      return { documents: [], dataSource: 'live-empty' };
    }
  } catch (error) {
    if (options.mode === 'live') {
      logAgentSkillsEvent('AgentSkills.resolveLiveError', {
        mode: options.mode,
        market: options.market,
        region: options.region,
        error: error.message
      });
      throw error;
    }
    console.error('[agentSkillsService] Live search failed, falling back to mock:', error.message);
    logAgentSkillsEvent('AgentSkills.resolveLiveFallback', {
      mode: options.mode,
      market: options.market,
      region: options.region,
      error: error.message
    });
  }

  logAgentSkillsEvent('AgentSkills.resolveMockFallback', {
    mode: options.mode,
    market: options.market,
    region: options.region
  });
  return { documents: await loadMockAgentSkillDocuments(), dataSource: 'mock-fallback' };
}

async function loadLiveAgentSkillDocuments(options) {
  const filterConfig = normalizeFilterConfig(options);
  const retrieval = options.retrieval || normalizeRetrievalConfig(undefined, options.limitPerBucket);
  const top = Math.max(options.limitPerBucket * retrieval.topMultiplier, retrieval.minTop);
  const memoryQueryExpansion = buildMemoryQueryExpansion(options.memoryContext);
  const queryText = [options.query || '', memoryQueryExpansion].filter(Boolean).join(' ').trim() || '*';
  const assetFilter = buildAssetFilter(filterConfig);
  const pageFilter = buildPageFilter(filterConfig);

  logAgentSkillsEvent('AgentSkills.liveQuery', {
    mode: options.mode,
    market: filterConfig.market,
    region: filterConfig.region,
    assetFilter: assetFilter || null,
    pageFilter: pageFilter || null,
    queryLength: queryText.length,
    top,
    semanticMode: retrieval.semanticMode
  });

  const [assetDocs, pageDocs] = await Promise.all([
    queryIndexDocuments({
      indexName: ASSET_INDEX,
      queryText,
      select: ASSET_SELECT_FIELDS,
      filter: assetFilter,
      top,
      options,
      retrieval
    }),
    queryIndexDocuments({
      indexName: PAGE_INDEX,
      queryText,
      select: PAGE_SELECT_FIELDS,
      filter: pageFilter,
      top,
      options,
      retrieval
    })
  ]);

  const rescoredDocs = [...assetDocs, ...pageDocs]
    .map((doc) => ({
      ...doc,
      score: calculateTunedScore(doc, options, retrieval),
      rawScore: doc.score ?? 0
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const filteredDocs = rescoredDocs.filter((doc) => (doc.score ?? 0) >= retrieval.minScore);
  const shouldBackfill = filteredDocs.length < retrieval.minDocsAfterFilter;
  const allDocs = (shouldBackfill ? rescoredDocs : filteredDocs).slice(0, retrieval.maxDocuments);

  logAgentSkillsEvent('AgentSkills.liveScoreFilter', {
    minScore: retrieval.minScore,
    top,
    topMultiplier: retrieval.topMultiplier,
    minTop: retrieval.minTop,
    maxDocuments: retrieval.maxDocuments,
    minDocsAfterFilter: retrieval.minDocsAfterFilter,
    semanticMode: retrieval.semanticMode,
    usedBackfill: shouldBackfill,
    beforeCount: assetDocs.length + pageDocs.length,
    afterFilterCount: filteredDocs.length,
    afterCount: allDocs.length
  });

  return allDocs;
}

function formatMemoryContextLines(memoryContext = []) {
  if (!Array.isArray(memoryContext) || memoryContext.length === 0) {
    return [];
  }

  return memoryContext.slice(0, 5).map((item) => {
    const type = item.memoryType || 'fact';
    return `- ${item.key}: ${item.value} (${type})`;
  });
}

function buildMemoryQueryExpansion(memoryContext = []) {
  if (!Array.isArray(memoryContext) || memoryContext.length === 0) {
    return '';
  }

  const terms = memoryContext
    .slice(0, 4)
    .flatMap((item) => [item.key, item.value])
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);

  return terms.join(' ');
}

function normalizeMemoryContext(memoryContext) {
  if (!Array.isArray(memoryContext)) {
    return [];
  }

  return memoryContext
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      id: item.id || null,
      key: String(item.key || '').trim(),
      value: String(item.value || '').trim(),
      memoryType: String(item.memoryType || 'fact').toLowerCase(),
      scope: String(item.scope || 'smartnote').toLowerCase(),
      confidence: typeof item.confidence === 'number' ? item.confidence : null,
      sensitivity: item.sensitivity || 'medium'
    }))
    .filter((item) => item.key && item.value);
}

function normalizeFilterConfig(options) {
  const rawMarket = options.filters?.market || options.market || options.region || '';
  const rawRegion = options.filters?.region || options.region || options.market || '';

  const market = normalizeFilterValue(rawMarket);
  const region = normalizeFilterValue(rawRegion);

  return { market, region };
}

function normalizeFilterValue(value = '') {
  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  if (['all', 'any', 'national', 'nationwide', 'global'].includes(normalized.toLowerCase())) {
    return null;
  }

  return normalized;
}

async function queryIndexDocuments({ indexName, queryText, select, filter, top, options, retrieval }) {
  const client = getSearchClient(indexName);
  const results = await executeSearchQuery(client, {
    indexName,
    queryText,
    select,
    top,
    filter,
    semanticMode: retrieval?.semanticMode || AGENT_SKILLS_SEMANTIC_MODE
  });

  const normalized = [];
  for await (const result of results.results) {
    const doc = result.document || {};
    const mapped = mapSearchDocument(indexName, doc, result.score, options);
    if (mapped) {
      normalized.push(mapped);
    }
  }

  return normalized;
}

async function executeSearchQuery(client, { indexName, queryText, select, top, filter, semanticMode }) {
  const effectiveSemanticMode = normalizeSemanticMode(semanticMode || AGENT_SKILLS_SEMANTIC_MODE);

  const shouldAttemptSemantic = effectiveSemanticMode !== 'off'
    && Boolean(AGENT_SKILLS_SEMANTIC_CONFIG)
    && queryText
    && queryText !== '*';

  if (shouldAttemptSemantic) {
    try {
      logAgentSkillsEvent('AgentSkills.semanticSearchAttempt', {
        indexName,
        semanticConfiguration: AGENT_SKILLS_SEMANTIC_CONFIG,
        semanticMode: effectiveSemanticMode
      });
      return await client.search(queryText, {
        includeTotalCount: false,
        select,
        top,
        filter,
        queryType: 'semantic',
        semanticSearchOptions: {
          configurationName: AGENT_SKILLS_SEMANTIC_CONFIG
        }
      });
    } catch (error) {
      logAgentSkillsEvent('AgentSkills.semanticSearchFallback', {
        indexName,
        semanticConfiguration: AGENT_SKILLS_SEMANTIC_CONFIG,
        semanticMode: effectiveSemanticMode,
        error: error.message
      });

      if (effectiveSemanticMode === 'always') {
        throw error;
      }
    }
  }

  return client.search(queryText, {
    includeTotalCount: false,
    select,
    top,
    filter
  });
}

function mapSearchDocument(indexName, doc, score, options) {
  if (indexName === ASSET_INDEX) {
    const sourceTitle = doc.document_title || doc.section_title || 'InfoSource asset';
    const sourcePath = doc.document_path || null;
    const summaryText = [doc.section_title, doc.document_title, ...(doc.keywords || [])]
      .filter(Boolean)
      .join(' — ');

    return {
      id: `${ASSET_INDEX}:${doc.id || sourceTitle}`,
      skillBucket: inferSkillBucket(summaryText, options.query),
      summary: summaryText || sourceTitle,
      quote: doc.section_title || null,
      sourceTitle,
      url: buildInfoSourceLink(sourcePath),
      market: doc.market || null,
      region: doc.region || doc.market || null,
      documentOwner: doc.owner || null,
      lastUpdated: doc.last_reviewed || null,
      keywords: Array.isArray(doc.keywords) ? doc.keywords : [],
      score
    };
  }

  const pageTitle = doc.title || doc.section_title || 'InfoSource page';
  const pageSummary = [doc.section_title, doc.title].filter(Boolean).join(' — ');

  return {
    id: `${PAGE_INDEX}:${doc.id || pageTitle}`,
    skillBucket: inferSkillBucket(pageSummary, options.query),
    summary: pageSummary || pageTitle,
    quote: doc.section_title || null,
    sourceTitle: pageTitle,
    url: buildInfoSourceLink(doc.path || null),
    market: doc.market || null,
    region: doc.market || null,
    documentOwner: doc.owner || null,
    lastUpdated: doc.last_reviewed || null,
    keywords: [],
    score
  };
}

function buildAssetFilter({ market, region }) {
  const clauses = [];

  if (market) {
    clauses.push(`market eq '${escapeODataString(market)}'`);
  }

  if (region && region !== market) {
    clauses.push(`region eq '${escapeODataString(region)}'`);
  }

  return clauses.length ? clauses.join(' and ') : undefined;
}

function buildPageFilter({ market, region }) {
  const effectiveMarket = market || region;
  if (!effectiveMarket) {
    return undefined;
  }

  return `market eq '${escapeODataString(effectiveMarket)}'`;
}

function inferSkillBucket(content = '', query = '') {
  const combined = `${content} ${query}`.toLowerCase();

  if (/(follow[- ]?up|next step|owner|recap|motion)/.test(combined)) {
    return AgentSkillBucket.FOLLOW_UP;
  }

  if (/(avoid|risk|objection|q&a|governance|finetune)/.test(combined)) {
    return AgentSkillBucket.FINETUNE;
  }

  if (/(differentiator|proof|benchmark|impress|closing|outcome)/.test(combined)) {
    return AgentSkillBucket.IMPRESS;
  }

  return AgentSkillBucket.APPROACH;
}

function calculateTunedScore(doc = {}, options = {}, retrieval = {}) {
  const rawScore = Number(doc.score) || 0;
  let tunedScore = rawScore;

  const requestedMarket = normalizeFilterValue(options.market || options.filters?.market || null);
  const requestedRegion = normalizeFilterValue(options.region || options.filters?.region || null);
  const docMarket = normalizeFilterValue(doc.market || null);
  const docRegion = normalizeFilterValue(doc.region || doc.market || null);

  if (requestedMarket && docMarket && requestedMarket.toLowerCase() === docMarket.toLowerCase()) {
    tunedScore += retrieval.marketBoost;
  }

  if (requestedRegion && docRegion && requestedRegion.toLowerCase() === docRegion.toLowerCase()) {
    tunedScore += retrieval.regionBoost;
  }

  const queryTerms = tokenizeQuery(options.query);
  if (queryTerms.length > 0) {
    const docText = [doc.summary, doc.quote, doc.sourceTitle, ...(doc.keywords || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const termHits = queryTerms.filter((term) => docText.includes(term)).length;
    if (termHits > 0) {
      tunedScore += termHits * retrieval.queryTermBoost;
    }
  }

  return Number(tunedScore.toFixed(6));
}

function tokenizeQuery(query = '') {
  return String(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .slice(0, 24);
}

function buildInfoSourceLink(rawPath) {
  if (!rawPath) {
    return null;
  }

  if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
    return rawPath;
  }

  if (rawPath.startsWith('/')) {
    return `https://infosource.kp.org${rawPath}`;
  }

  return `https://infosource.kp.org/${rawPath}`;
}

function normalizeRetrievalConfig(retrieval = {}, limitPerBucket = DEFAULT_LIMIT_PER_BUCKET) {
  const dynamicMinimum = Math.max(limitPerBucket * 2, 6);

  return {
    minScore: parsePositiveFloat(retrieval?.minScore, AGENT_SKILLS_MIN_SCORE),
    topMultiplier: parsePositiveInt(retrieval?.topMultiplier, AGENT_SKILLS_TOP_MULTIPLIER),
    minTop: parsePositiveInt(retrieval?.minTop, AGENT_SKILLS_MIN_TOP),
    maxDocuments: parsePositiveInt(retrieval?.maxDocuments, AGENT_SKILLS_MAX_DOCUMENTS),
    minDocsAfterFilter: parsePositiveInt(retrieval?.minDocsAfterFilter, Math.max(AGENT_SKILLS_MIN_DOCS_AFTER_FILTER, dynamicMinimum)),
    semanticMode: normalizeSemanticMode(retrieval?.semanticMode || AGENT_SKILLS_SEMANTIC_MODE),
    marketBoost: parsePositiveFloat(retrieval?.marketBoost, AGENT_SKILLS_MARKET_BOOST),
    regionBoost: parsePositiveFloat(retrieval?.regionBoost, AGENT_SKILLS_REGION_BOOST),
    queryTermBoost: parsePositiveFloat(retrieval?.queryTermBoost, AGENT_SKILLS_QUERY_TERM_BOOST)
  };
}

function normalizeSemanticMode(mode = 'auto') {
  const normalized = String(mode).trim().toLowerCase();
  if (['off', 'auto', 'always'].includes(normalized)) {
    return normalized;
  }
  return 'auto';
}

function parsePositiveFloat(value, fallbackValue) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallbackValue;
  }
  return parsed;
}

function parsePositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
}

function escapeODataString(value = '') {
  return String(value).replace(/'/g, "''");
}

function getSearchConfig() {
  if (cachedSearchConfig) {
    return cachedSearchConfig;
  }

  const envName = process.env.envName || 'dev';
  const endpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`];
  const key = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.new.t3.api.key`]
    || process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`];

  if (!endpoint || !key) {
    throw new Error('Azure AI Search config missing for InfoSource new.t3 endpoint/key');
  }

  cachedSearchConfig = { endpoint, key };
  return cachedSearchConfig;
}

function getSearchClient(indexName) {
  if (!searchClients[indexName]) {
    const { endpoint, key } = getSearchConfig();
    searchClients[indexName] = new SearchClient(endpoint, indexName, new AzureKeyCredential(key));
  }

  return searchClients[indexName];
}

function logAgentSkillsEvent(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail
    }
  }));
}

async function loadMockAgentSkillDocuments() {
  if (cachedMockDocuments) {
    return cachedMockDocuments;
  }

  try {
    const raw = await fs.readFile(MOCK_DATA_PATH, 'utf-8');
    cachedMockDocuments = JSON.parse(raw);
    return cachedMockDocuments;
  } catch (error) {
    console.error(`[agentSkillsService] Unable to read mock data at ${MOCK_DATA_PATH}:`, error);
    cachedMockDocuments = [];
    return cachedMockDocuments;
  }
}

function bucketizeDocuments(documents = [], limitPerBucket = DEFAULT_LIMIT_PER_BUCKET) {
  const orderedBuckets = AGENT_SKILL_BUCKET_CONFIG.sort((a, b) => (
    AgentSkillBucketOrder.indexOf(a.id) - AgentSkillBucketOrder.indexOf(b.id)
  ));

  return orderedBuckets.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    description: bucket.description,
    insights: documents
      .filter((doc) => doc.skillBucket === bucket.id)
      .slice(0, limitPerBucket)
      .map((doc) => ({
        id: doc.id,
        summary: doc.summary,
        quote: doc.quote || null,
        footnoteId: doc.footnoteId || null,
        citation: buildCitation(doc),
        metadata: {
          keywords: doc.keywords || [],
          market: doc.market || null,
          region: doc.region || doc.market || null,
          owner: doc.documentOwner || doc.owner || null,
          score: doc.score ?? null,
        }
      }))
  }));
}

function buildCitation(doc = {}) {
  const citation = doc.citation || {};
  return {
    sourceTitle: citation.sourceTitle || doc.sourceTitle || doc.source?.title || 'Source unavailable',
    url: citation.url || doc.url || doc.source?.url || null,
    region: citation.region || doc.region || doc.market || 'N/A',
    documentOwner: citation.documentOwner || doc.documentOwner || doc.owner || 'N/A',
    lastUpdated: citation.lastUpdated || doc.lastUpdated || doc.lastReviewed || null,
  };
}
