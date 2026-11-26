import { Annotation, StateGraph, START, END } from '../langgraph-light.js';
import { AzureOpenAI } from 'openai';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { connectToDatabase } from '@/db/connection';
import { getCompletionsClient } from '@/app/services/chatCompletionService3.js';
import { updateChatInteractionProgress, createProgressMarkdown } from './helpers/progressTracking';
import { loadConversationConfigV2, DEFAULT_CONVERSATION_CONFIG_V2 } from './helpers/loadConversationConfigV2.js';
import { selectGeisingerConfigContextDocuments } from '@/app/services/geisingerConfigService';

const DEFAULT_SEARCH_INDEX_NAME = 'geisinger-002';
const DEFAULT_GEISINGER_COLLECTION = 'user_collection';
const HARD_CODED_CONVERSATION_CONFIG = DEFAULT_CONVERSATION_CONFIG_V2;

function logConversationEvent(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg_name: name,
    kpmsg_id: 'AI_PORTAL_NOTEBOOK',
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    }
  }));
}

async function fetchConversationConfigDocumentsV2() {
  const collectionNames = ['Document Conversation'];
  const all = [];
  const seen = new Set();
  let invalidDocumentCount = 0;

  for (const collectionName of collectionNames) {
    try {
      const { data } = await selectGeisingerConfigContextDocuments({
        type: 'GeisingerConfig',
        collectionName,
      });

      for (const doc of Array.isArray(data) ? data : []) {
        const documentText = String(doc?.documentText || '').trim();
        if (!documentText) {
          invalidDocumentCount += 1;
          continue;
        }

        const key = String(doc?.id || `${collectionName}:${doc?.title || ''}`).trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        all.push({ ...doc, documentText });
      }
    } catch (error) {
      logConversationEvent('conversationV2GeisingerConfigFetchFailed', {
        collectionName,
        error: error?.message || String(error),
      });
    }
  }

  if (invalidDocumentCount > 0) {
    logConversationEvent('conversationV2GeisingerConfigInvalidDocumentsSkipped', {
      invalidDocumentCount,
    });
  }

  return all;
}

function normalizePreparationVersion(value) {
  if (value === null || value === undefined) return null;
  const version = String(value).trim();
  return version || null;
}

function toNumericVersion(value) {
  const normalized = normalizePreparationVersion(value);
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function getCurrentPreparationVersion(config = {}) {
  const envVarName = String(config?.runtime?.preparationVersion?.envVar || 'GEISINGER_PREPARATION_VERSION').trim() || 'GEISINGER_PREPARATION_VERSION';
  const defaultValue = String(config?.runtime?.preparationVersion?.defaultValue || '1').trim() || '1';
  return String(process.env[envVarName] || defaultValue).trim() || '1';
}

function isAtOrAbovePreparationVersion(value, minimumPreparationVersion) {
  const normalized = normalizePreparationVersion(value);
  const minVersion = normalizePreparationVersion(minimumPreparationVersion) || '1';

  // Backward compatibility: older records may not have preparationVersion.
  if (!normalized) {
    return minVersion === '1';
  }

  const docNumeric = toNumericVersion(normalized);
  const minNumeric = toNumericVersion(minVersion);
  if (docNumeric !== null && minNumeric !== null) {
    return docNumeric >= minNumeric;
  }

  // Non-numeric versions fallback to exact compare.
  return normalized === minVersion;
}

function normalizeInferredLob(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.toLowerCase() === 'aca') return 'Marketplace';
  return raw;
}

function getInferredLobAliases(value) {
  const normalized = normalizeInferredLob(value);
  if (!normalized) return [];
  if (normalized.toLowerCase() === 'marketplace') {
    return ['Marketplace', 'ACA'];
  }
  return [normalized];
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSearchText(text) {
  let searchText = String(text || '').trim();
  if (!searchText) return '*';

  searchText = searchText
    .replace(/\b(CFR)(?=\d{1,3}(?:\.\d{1,3}){1,3})/gi, '$1 ')
    .replace(/(\d{1,3}(?:\.\d{1,3}){1,3})(?=[A-Za-z])(?!\.)/g, '$1 ')
    .replace(/(\d{1,3}(?:\.\d{1,3}){1,3})(?=\()/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

  return searchText || '*';
}

function extractSectionNumber(text) {
  const source = String(text || '');
  const match = source.match(/(?<!\d)(\d{1,3}(?:\.\d{1,3}){1,3})(?!\d)/);
  return match ? match[1] : '';
}

function buildQueryVariants(prompt, maxVariants) {
  const normalized = normalizeSearchText(prompt);
  const sectionNumber = extractSectionNumber(normalized);
  const variants = [
    { label: 'exact', query: normalized, queryType: 'simple', searchMode: 'any' },
  ];

  if (normalized !== String(prompt || '').trim()) {
    variants.push({ label: 'normalized', query: normalized, queryType: 'simple', searchMode: 'any' });
  }

  if (sectionNumber) {
    variants.push({ label: 'sectionOnly', query: sectionNumber, queryType: 'simple', searchMode: 'any' });
    variants.push({ label: 'sectionPhrase', query: `"${sectionNumber}"`, queryType: 'full', searchMode: 'all' });

    const tokenizedSection = sectionNumber.replace(/\./g, ' ').trim();
    if (tokenizedSection && tokenizedSection !== sectionNumber) {
      variants.push({ label: 'sectionOnly', query: tokenizedSection, queryType: 'simple', searchMode: 'any' });
    }
  }

  const quoted = normalized.match(/"([^"]{3,})"/)?.[1];
  if (quoted) {
    variants.push({ label: 'quotedClause', query: `"${quoted}"`, queryType: 'full', searchMode: 'all' });
  }

  const deduped = [];
  const seen = new Set();
  for (const variant of variants) {
    const key = `${variant.label}::${variant.query.toLowerCase()}`;
    if (!seen.has(key)) {
      deduped.push(variant);
      seen.add(key);
    }
    if (deduped.length >= maxVariants) break;
  }

  return deduped;
}

function buildCurrentPreparationVersionMongoFilter(currentPreparationVersion) {
  void currentPreparationVersion;
  // Version thresholding is handled in-memory for compatibility with Mongo/Cosmos dialect differences.
  return {};
}

function buildSearchInFilter(fieldName, values) {
  if (!Array.isArray(values) || values.length === 0) return '';
  const escaped = values
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .map((v) => v.replace(/'/g, "''"));

  if (escaped.length === 0) return '';
  return `search.in(${fieldName}, '${escaped.join(',')}', ',')`;
}

function chunkArray(items, chunkSize) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const out = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize));
  }
  return out;
}

function getSearchScore(result) {
  if (typeof result?.score === 'number') return result.score;
  if (typeof result?.document?.['@search.score'] === 'number') return result.document['@search.score'];
  return 0;
}

function normalizeConversationStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function computeCandidateScore(candidate, userPrompt, config) {
  const ranking = config.ranking;
  const prompt = String(userPrompt || '');
  const promptLower = prompt.toLowerCase();
  const title = String(candidate?.doc?.title || '').toLowerCase();
  const content = String(candidate?.doc?.content || '').toLowerCase();
  const section = extractSectionNumber(promptLower);

  const promptTerms = tokenize(promptLower);
  const titleHits = promptTerms.filter((term) => title.includes(term)).length;
  const contentHits = promptTerms.filter((term) => content.includes(term)).length;

  let score = Number(candidate.rawScore || 0) * ranking.scoreWeight;
  score += titleHits * ranking.titleTermBoost;
  score += contentHits * ranking.contentTermBoost;

  if (promptLower && content.includes(promptLower)) {
    score += ranking.exactPromptBoost;
  }

  if (section && (title.includes(section) || content.includes(section))) {
    score += ranking.exactSectionBoost;
  }

  score += ranking.queryVariantBoost[candidate.queryVariant] || 0;
  return score;
}

function buildSnippet(text, maxLength = 420) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trim()}...`;
}

function normalizeProbeTerm(term) {
  return String(term || '')
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .trim();
}

function extractQuotedPhrases(prompt = '') {
  const phrases = [];
  const source = String(prompt || '');
  const regex = /"([^\"]{3,})"/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const phrase = String(match[1] || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (phrase) phrases.push(phrase);
  }

  return Array.from(new Set(phrases));
}

function buildPromptPhraseProbes(userPrompt = '', promptTerms = []) {
  const quoted = extractQuotedPhrases(userPrompt);
  const normalizedTerms = Array.from(new Set(
    (Array.isArray(promptTerms) ? promptTerms : [])
      .map((term) => normalizeProbeTerm(term))
      .filter((term) => term.length >= 3)
  ));

  const ngrams = [];
  const maxN = Math.min(4, normalizedTerms.length);
  for (let n = maxN; n >= 2; n -= 1) {
    for (let i = 0; i <= normalizedTerms.length - n; i += 1) {
      const phrase = normalizedTerms.slice(i, i + n).join(' ').trim();
      if (phrase.length >= 8) {
        ngrams.push(phrase);
      }
    }
  }

  return {
    quoted,
    ngrams: Array.from(new Set(ngrams)),
    terms: normalizedTerms,
  };
}

function scoreWindowForProbes(windowTextLower = '', probes = []) {
  let score = 0;
  for (const probe of probes) {
    if (!probe?.text) continue;
    if (windowTextLower.includes(probe.text)) {
      score += Number(probe.weight || 0);
    }
  }
  return score;
}

function buildFocusedSnippet(text, {
  maxLength = 420,
  sectionNumber = '',
  userPrompt = '',
  promptTerms = [],
} = {}) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;

  const haystack = clean.toLowerCase();
  const sectionProbe = String(sectionNumber || '').trim().toLowerCase();
  const phraseProbes = buildPromptPhraseProbes(userPrompt, promptTerms);

  const probes = [
    ...(sectionProbe ? [{ text: sectionProbe, weight: 600 }] : []),
    ...phraseProbes.quoted.map((text) => ({ text, weight: 520 })),
    ...phraseProbes.ngrams.map((text) => ({ text, weight: 360 + Math.min(text.length, 40) })),
    ...phraseProbes.terms.map((text) => ({ text, weight: 120 + Math.min(text.length, 16) })),
  ];

  let bestMatch = null;
  for (const probe of probes) {
    const index = haystack.indexOf(probe.text);
    if (index < 0) continue;

    const windowStart = Math.max(0, index - Math.floor(maxLength * 0.35));
    const windowEnd = Math.min(clean.length, windowStart + maxLength);
    const windowTextLower = haystack.slice(windowStart, windowEnd);
    const windowScore = probe.weight + scoreWindowForProbes(windowTextLower, probes);

    if (!bestMatch || windowScore > bestMatch.score) {
      bestMatch = {
        index,
        score: windowScore,
      };
    }
  }

  if (!bestMatch) {
    return buildSnippet(clean, maxLength);
  }

  // Keep some context before the match, but bias toward showing content after it.
  let start = Math.max(0, bestMatch.index - Math.floor(maxLength * 0.35));
  let end = Math.min(clean.length, start + maxLength);
  if ((end - start) < maxLength) {
    start = Math.max(0, end - maxLength);
  }

  const prefix = start > 0 ? '...' : '';
  const suffix = end < clean.length ? '...' : '';
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

function isSearchDiagnosticsEnabled(config = {}) {
  void config;
  // Temporary debug override: always emit retrieval diagnostics until issue is resolved.
  return true;
}

function getSearchDiagnosticsMaxResults(config = {}) {
  const configured = Number(config?.runtime?.debug?.searchLogging?.maxResults);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(Math.floor(configured), 50);
  }
  return 8;
}

function getPromptSignalTerms(userPrompt = '') {
  const terms = tokenize(userPrompt)
    .map((term) => normalizeProbeTerm(term))
    .filter((term) => !/^\d+(?:\.\d+)*$/.test(term))
    .filter((term) => term.length >= 4);
  return Array.from(new Set(terms)).slice(0, 12);
}

function summarizeDebugResult(result, { sectionNumber = '', promptTerms = [] } = {}) {
  const doc = result?.document || {};
  const title = String(doc?.title || '').trim();
  const fileName = String(doc?.smart_file_name || '').trim();
  const content = String(doc?.content || '');
  const contentLower = content.toLowerCase();
  const titleLower = title.toLowerCase();
  const sectionLower = String(sectionNumber || '').toLowerCase();

  const matchingTerms = promptTerms.filter((term) => (
    titleLower.includes(term) || contentLower.includes(term)
  ));

  return {
    id: String(doc?.id || '').trim() || null,
    smartnote_id: String(doc?.smartnote_id || '').trim() || null,
    fileName: fileName || null,
    title: title || null,
    page: Number.isFinite(Number(doc?.page)) ? Number(doc.page) : null,
    score: Number(getSearchScore(result) || 0).toFixed(4),
    hasSectionNumber: !!(sectionLower && (titleLower.includes(sectionLower) || contentLower.includes(sectionLower))),
    matchingTerms,
    snippet: buildSnippet(content, 180) || null,
  };
}

function selectEvidence(rankedCandidates, mode, config) {
  const strategy = config.retrieval.strategy;
  if (mode === 'selected-document') {
    return rankedCandidates.slice(0, strategy.selectedDocEvidenceCount);
  }

  const perDocCap = strategy.perDocumentCapAllLob;
  const maxEvidence = strategy.allLobEvidenceCount;
  const byDocCount = new Map();
  const selected = [];

  for (const candidate of rankedCandidates) {
    const docId = String(candidate?.doc?.smartnote_id || 'unknown');
    const count = byDocCount.get(docId) || 0;
    if (count >= perDocCap) continue;

    selected.push(candidate);
    byDocCount.set(docId, count + 1);
    if (selected.length >= maxEvidence) break;
  }

  return selected;
}

function buildUsedDocuments(evidence) {
  const map = new Map();

  for (const item of evidence) {
    const doc = item?.doc || {};
    const fileName = String(doc.smart_file_name || doc.title || 'Untitled Document').trim();
    const page = Number(doc.page);
    const key = fileName.toLowerCase();

    if (!map.has(key)) {
      map.set(key, { fileName, pages: new Set() });
    }

    if (Number.isFinite(page) && page > 0) {
      map.get(key).pages.add(page);
    }
  }

  return Array.from(map.values()).map((item) => ({
    fileName: item.fileName,
    pages: Array.from(item.pages).sort((a, b) => a - b),
  }));
}

function buildEvidencePayload(evidence, userPrompt = '', config = {}) {
  const sectionNumber = extractSectionNumber(userPrompt);
  const promptTerms = getPromptSignalTerms(userPrompt);
  const snippetMaxLength = Number(config?.retrieval?.strategy?.evidenceSnippetMaxLength || 420);
  const safeSnippetMaxLength = Number.isFinite(snippetMaxLength)
    ? Math.max(120, Math.min(Math.floor(snippetMaxLength), 8000))
    : 420;

  return evidence.map((item) => {
    const doc = item.doc || {};
    const fileName = String(doc.smart_file_name || 'Unknown File').trim();
    const page = Number(doc.page);
    const pageLabel = Number.isFinite(page) && page > 0 ? page : 'n/a';
    return {
      citation: `[${fileName}:${pageLabel}]`,
      title: doc.title || '',
      fileName,
      page: pageLabel,
      snippet: buildFocusedSnippet(doc.content, {
        maxLength: safeSnippetMaxLength,
        sectionNumber,
        userPrompt,
        promptTerms,
      }),
      smartnote_id: doc.smartnote_id || '',
      score: Number(item.finalScore || 0).toFixed(3),
    };
  });
}

function buildEvidenceMarkdown(evidencePayload, title) {
  if (!Array.isArray(evidencePayload) || evidencePayload.length === 0) {
    return `${title}\n- No evidence snippets were retrieved.`;
  }

  const lines = evidencePayload.map((item, idx) => {
    const sectionTitle = item.title ? ` ${item.title}` : '';
    return `${idx + 1}. ${item.citation}${sectionTitle}\n   - ${item.snippet}`;
  });

  return `${title}\n${lines.join('\n')}`;
}

function applyTemplate(template, values) {
  return String(template || '').replace(/\$\{(\w+)\}/g, (_, key) => {
    const value = values?.[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function buildDocumentDisplayLabel({ fileAName, url, isAllLob }) {
  if (isAllLob || !url) {
    return String(fileAName || 'Selected Document');
  }
  return `[${String(fileAName || 'Selected Document')}](${url})`;
}

function normalizeFileNameKey(value) {
  return String(value || '').trim().toLowerCase();
}

function buildConversationDocumentUrl(geisingerConversation, page) {
  const relativeAUrl = String(geisingerConversation?.relativeAUrl || '').trim();
  if (!relativeAUrl) return '';

  const domain = process.env.USE_VAULT === 'true' ? 'geisinger.sharepoint.com' : 'sp-cloud.kp.org';
  const baseUrl = `https://${domain}${relativeAUrl}`;
  let url = encodeURI(baseUrl);
  url += '?target=_blank';

  const pageNumber = Number(page);
  if (Number.isFinite(pageNumber) && pageNumber > 0) {
    url += `#page=${pageNumber}`;
  }

  return url;
}

function extractFirstCitationPage(text) {
  const source = String(text || '');
  const match = source.match(/\[[^\]\n]*:\s*(\d+)\]/);
  if (!match) return null;

  const pageNumber = Number(match[1]);
  return Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : null;
}

function resolveCitationDocumentUrl({ fileName, geisingerConversation, citationUrlMap }) {
  const key = normalizeFileNameKey(fileName);
  const relativeUrl = key ? citationUrlMap?.get(key) : '';
  if (relativeUrl) {
    return buildConversationDocumentUrl({ relativeAUrl: relativeUrl }, null);
  }
  return buildConversationDocumentUrl(geisingerConversation, null);
}

async function buildCitationUrlMap({ geisingerConversation, evidencePayload, config }) {
  const teamName = String(geisingerConversation?.teamName || '').trim();
  if (!teamName || !Array.isArray(evidencePayload) || evidencePayload.length === 0) {
    return new Map();
  }

  const conversationIds = Array.from(new Set(
    evidencePayload
      .map((item) => String(item?.smartnote_id || '').trim())
      .filter(Boolean)
  ));

  if (conversationIds.length === 0) {
    return new Map();
  }

  const db = await connectToDatabase(`team-${teamName}-db`);
  const collectionName = String(config?.runtime?.data?.collectionName || DEFAULT_GEISINGER_COLLECTION).trim() || DEFAULT_GEISINGER_COLLECTION;
  const docs = await db.collection(collectionName)
    .find({
      type: 'GeisingerConversation',
      id: { $in: conversationIds },
    })
    .project({ id: 1, fileAName: 1, relativeAUrl: 1 })
    .toArray();

  const urlByName = new Map();
  for (const doc of docs || []) {
    const relativeAUrl = String(doc?.relativeAUrl || '').trim();
    const fileAName = String(doc?.fileAName || '').trim();
    const key = normalizeFileNameKey(fileAName);
    if (!key || !relativeAUrl) continue;
    if (!urlByName.has(key)) {
      urlByName.set(key, relativeAUrl);
    }
  }

  return urlByName;
}

function linkifyInlineCitations(text, geisingerConversation, citationUrlMap) {
  const source = String(text || '');
  if (!source) return source;

  return source.replace(/\[([^\]\n]+?):\s*(\d+)\](?!\()/g, (match, fileName, pageText) => {
    const pageNumber = Number(pageText);
    if (!Number.isFinite(pageNumber) || pageNumber <= 0) {
      return match;
    }

    const documentUrl = resolveCitationDocumentUrl({ fileName, geisingerConversation, citationUrlMap });
    const url = documentUrl ? `${documentUrl}#page=${pageNumber}` : '';
    if (!url) {
      return match;
    }

    return `[${String(fileName).trim()}:${pageNumber}](${url})`;
  });
}

const embeddingsClientCache = new Map();
function getEmbeddingsClient(runtimeEmbeddingConfig = {}) {
  const envName = process.env.envName;
  const embeddingsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`];
  const embeddingsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
  const deployment = String(runtimeEmbeddingConfig?.deployment || 'gpt-4o-aisvc').trim() || 'gpt-4o-aisvc';
  const apiVersion = String(runtimeEmbeddingConfig?.apiVersion || '2023-05-15').trim() || '2023-05-15';
  const cacheKey = `${embeddingsEndpoint}::${deployment}::${apiVersion}`;

  if (!embeddingsClientCache.has(cacheKey)) {
    embeddingsClientCache.set(cacheKey, new AzureOpenAI({
      apiVersion,
      endpoint: embeddingsEndpoint,
      apiKey: embeddingsAPIKey,
      deployment,
    }));
  }

  return embeddingsClientCache.get(cacheKey);
}

const searchClientCache = new Map();
function getSearchClient(indexName = DEFAULT_SEARCH_INDEX_NAME) {
  const envName = process.env.envName;
  const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
  const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];
  const normalizedIndexName = String(indexName || DEFAULT_SEARCH_INDEX_NAME).trim() || DEFAULT_SEARCH_INDEX_NAME;
  const cacheKey = `${searchEndpoint}::${normalizedIndexName}`;

  if (!searchClientCache.has(cacheKey)) {
    searchClientCache.set(cacheKey, new SearchClient(
      searchEndpoint,
      normalizedIndexName,
      new AzureKeyCredential(searchAPIKey)
    ));
  }

  return searchClientCache.get(cacheKey);
}

async function vectorizePrompt(embeddingsClientArg, prompt, model) {
  const normalized = normalizeSearchText(prompt);
  const { data: [{ embedding }] } = await embeddingsClientArg.embeddings.create({
    input: normalized,
    model: String(model || 'text-embedding-ada-002').trim() || 'text-embedding-ada-002',
  });
  return embedding;
}

async function resolveConversationScope(geisingerConversation, config) {
  const currentPreparationVersion = getCurrentPreparationVersion(config);
  const selectedConversationId = String(geisingerConversation?.id || '').trim();
  if (selectedConversationId) {
    return {
      mode: 'selected-document',
      conversationIds: [selectedConversationId],
      filterBatches: [[selectedConversationId]],
      normalizedLob: normalizeInferredLob(geisingerConversation?.lob),
      hadNoPreparedDocuments: false,
    };
  }

  const useAllLob = !!geisingerConversation?.allFilesInLob;
  const normalizedLob = normalizeInferredLob(geisingerConversation?.lob);
  const normalizedTeamName = String(geisingerConversation?.teamName || '').trim();

  if (!useAllLob || !normalizedLob || !normalizedTeamName) {
    return {
      mode: 'no-scope',
      conversationIds: [],
      filterBatches: [],
      normalizedLob,
      hadNoPreparedDocuments: true,
    };
  }

  const lobAliases = getInferredLobAliases(normalizedLob);
  const lobPattern = new RegExp(`^(?:${lobAliases.map(escapeRegex).join('|')})$`, 'i');

  const db = await connectToDatabase(`team-${normalizedTeamName}-db`);
  const collectionName = String(config?.runtime?.data?.collectionName || DEFAULT_GEISINGER_COLLECTION).trim() || DEFAULT_GEISINGER_COLLECTION;
  const conversationFilter = {
    type: 'GeisingerConversation',
    lob: lobPattern,
    ...buildCurrentPreparationVersionMongoFilter(currentPreparationVersion),
  };

  const docs = await db.collection(collectionName)
    .find(conversationFilter)
    .project({ id: 1, status: 1, preparationVersion: 1 })
    .toArray();

  const ready = docs
    .filter((doc) => {
      const status = normalizeConversationStatus(doc?.status);
      return (status === 'complete' || status === 'prepared') && isAtOrAbovePreparationVersion(doc?.preparationVersion, currentPreparationVersion);
    })
    .map((doc) => String(doc?.id || '').trim())
    .filter(Boolean);

  const strategy = config.retrieval.strategy;
  const batches = chunkArray(ready, strategy.maxConversationIdsPerBatch).slice(0, strategy.maxLobBatches);

  return {
    mode: 'all-docs-in-lob',
    conversationIds: ready,
    filterBatches: batches,
    normalizedLob,
    hadNoPreparedDocuments: ready.length === 0,
  };
}

async function runSearchPass({
  searchClient,
  searchText,
  queryLabel,
  queryType = 'simple',
  searchMode = 'any',
  filter,
  filterBatch,
  selectFields,
  searchFields,
  promptEmbedding,
  strategy,
  diagnostics,
}) {
  const candidates = [];
  const keywordTopHits = [];
  const semanticTopHits = [];
  const maxResults = diagnostics?.enabled ? diagnostics.maxResults : 0;
  const promptTerms = diagnostics?.promptTerms || [];
  const sectionNumber = diagnostics?.sectionNumber || '';

  const keywordResponse = await searchClient.search(searchText, {
    filter,
    top: strategy.keywordTop,
    select: selectFields,
    searchFields,
    queryType,
    searchMode,
  });

  for await (const result of keywordResponse.results) {
    candidates.push({
      doc: result.document,
      rawScore: getSearchScore(result),
      source: 'keyword',
      queryVariant: queryLabel,
    });

    if (diagnostics?.enabled && keywordTopHits.length < maxResults) {
      keywordTopHits.push(summarizeDebugResult(result, { sectionNumber, promptTerms }));
    }
  }

  const semanticResponse = await searchClient.search(searchText, {
    filter,
    top: strategy.semanticTop,
    select: selectFields,
    searchFields,
    queryType,
    searchMode,
    embedding: promptEmbedding,
    vectorFields: ['content_vector'],
  });

  for await (const result of semanticResponse.results) {
    candidates.push({
      doc: result.document,
      rawScore: getSearchScore(result),
      source: 'semantic',
      queryVariant: queryLabel,
    });

    if (diagnostics?.enabled && semanticTopHits.length < maxResults) {
      semanticTopHits.push(summarizeDebugResult(result, { sectionNumber, promptTerms }));
    }
  }

  if (diagnostics?.enabled) {
    logConversationEvent('complianceConversationGraphV2SearchPassDiagnostics', {
      queryLabel,
      queryText: searchText,
      queryType,
      searchMode,
      filterBatchSize: Array.isArray(filterBatch) ? filterBatch.length : 0,
      filterBatchSample: Array.isArray(filterBatch) ? filterBatch.slice(0, 10) : [],
      keywordHitCount: candidates.filter((item) => item.source === 'keyword').length,
      semanticHitCount: candidates.filter((item) => item.source === 'semantic').length,
      sectionNumber,
      promptTerms,
      keywordTopHits,
      semanticTopHits,
    });
  }

  return candidates;
}

const loadConfigNodeV2 = async (state) => {
  try {
    const geisingerConfigEnabled = String(process.env.COMPLIANCE_CONVERSATION_GEISINGER_CONFIG_ENABLED || 'true').toLowerCase() !== 'false';
    const geisingerConfigDocuments = geisingerConfigEnabled
      ? await fetchConversationConfigDocumentsV2()
      : [];

    const { config, metadata } = await loadConversationConfigV2({ geisingerConfigDocuments });
    const embeddingsClient = getEmbeddingsClient(config?.runtime?.embedding || {});
    const searchClient = getSearchClient(config?.runtime?.search?.indexName || DEFAULT_SEARCH_INDEX_NAME);

    logConversationEvent('conversationV2ConfigResolved', {
      fileConfigCount: Object.keys(metadata?.fileSources || {}).length,
      geisingerDocumentCount: metadata?.geisingerOverlay?.documentCount || 0,
      geisingerAppliedCount: Array.isArray(metadata?.geisingerOverlay?.applied) ? metadata.geisingerOverlay.applied.length : 0,
      geisingerParseErrorCount: Array.isArray(metadata?.geisingerOverlay?.parseErrors) ? metadata.geisingerOverlay.parseErrors.length : 0,
    });

    return {
      ...state,
      configV2: config,
      configMetadataV2: metadata,
      embeddingsClient,
      searchClient,
    };
  } catch (error) {
    logConversationEvent('conversationV2ConfigLoadFailed', {
      error: error?.message || String(error),
    });

    return {
      ...state,
      configV2: HARD_CODED_CONVERSATION_CONFIG,
      configMetadataV2: null,
      embeddingsClient: getEmbeddingsClient(HARD_CODED_CONVERSATION_CONFIG?.runtime?.embedding || {}),
      searchClient: getSearchClient(HARD_CODED_CONVERSATION_CONFIG?.runtime?.search?.indexName || DEFAULT_SEARCH_INDEX_NAME),
    };
  }
};

const normalizeScopeNodeV2 = async (state) => {
  const conversationScope = await resolveConversationScope(state.geisingerConversation, state.configV2);

  logConversationEvent('complianceConversationGraphV2ScopeResolved', {
    mode: conversationScope.mode,
    totalConversationIds: conversationScope.conversationIds.length,
    filterBatchCount: conversationScope.filterBatches.length,
    lob: conversationScope.normalizedLob,
    hadNoPreparedDocuments: conversationScope.hadNoPreparedDocuments,
  });

  return {
    ...state,
    conversationScope,
  };
};

const vectorizePromptNodeV2 = async (state) => {
  const promptEmbedding = await vectorizePrompt(
    state.embeddingsClient,
    state.userPrompt,
    state?.configV2?.runtime?.embedding?.model
  );
  return {
    ...state,
    promptEmbedding,
  };
};

const runSearchNodeV2 = async (state) => {
  const { configV2, userPrompt, conversationScope, promptEmbedding, searchClient } = state;
  const strategy = configV2.retrieval.strategy;
  const searchFields = configV2.retrieval.searchFields;
  const selectFields = configV2.retrieval.selectFields;

  if (!conversationScope || conversationScope.mode === 'no-scope') {
    return {
      ...state,
      rawCandidates: [],
      retrievalDiagnostics: {
        mode: 'no-scope',
        reason: 'No selected document and no usable all-docs-in-lob scope.',
      },
    };
  }

  const queryVariants = buildQueryVariants(userPrompt, strategy.maxVariants);
  const allCandidates = [];
  const diagnosticsEnabled = isSearchDiagnosticsEnabled(configV2);
  const diagnosticsMaxResults = getSearchDiagnosticsMaxResults(configV2);
  const diagnosticsSectionNumber = extractSectionNumber(userPrompt);
  const diagnosticsPromptTerms = getPromptSignalTerms(userPrompt);
  const batches = conversationScope.mode === 'selected-document'
    ? conversationScope.filterBatches
    : conversationScope.filterBatches;

  for (const batch of batches) {
    const filter = buildSearchInFilter('smartnote_id', batch);
    for (const variant of queryVariants) {
      const variantCandidates = await runSearchPass({
        searchClient,
        searchText: variant.query,
        queryLabel: variant.label,
        queryType: variant.queryType || 'simple',
        searchMode: variant.searchMode || 'any',
        filter,
        filterBatch: batch,
        selectFields,
        searchFields,
        promptEmbedding,
        strategy,
        diagnostics: {
          enabled: diagnosticsEnabled,
          maxResults: diagnosticsMaxResults,
          sectionNumber: diagnosticsSectionNumber,
          promptTerms: diagnosticsPromptTerms,
        },
      });
      allCandidates.push(...variantCandidates);
    }
  }

  logConversationEvent('complianceConversationGraphV2RawSearchCompleted', {
    mode: conversationScope.mode,
    queryVariantCount: queryVariants.length,
    batchCount: batches.length,
    candidateCount: allCandidates.length,
  });

  return {
    ...state,
    rawCandidates: allCandidates,
    retrievalDiagnostics: {
      mode: conversationScope.mode,
      queryVariants,
      batchCount: batches.length,
      candidateCount: allCandidates.length,
      diagnosticsEnabled,
    },
  };
};

const rankEvidenceNodeV2 = async (state) => {
  const { rawCandidates, configV2, conversationScope, userPrompt } = state;

  const byId = new Map();
  for (const candidate of rawCandidates || []) {
    const id = String(candidate?.doc?.id || '').trim();
    if (!id) continue;

    const finalScore = computeCandidateScore(candidate, userPrompt, configV2);
    const withScore = { ...candidate, finalScore };

    const existing = byId.get(id);
    if (!existing || withScore.finalScore > existing.finalScore) {
      byId.set(id, withScore);
    }
  }

  const merged = Array.from(byId.values())
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, configV2.retrieval.strategy.maxCandidatesAfterMerge);

  const evidence = selectEvidence(merged, conversationScope?.mode, configV2);
  const usedDocuments = buildUsedDocuments(evidence);
  const evidencePayload = buildEvidencePayload(evidence, userPrompt, configV2);

  if (isSearchDiagnosticsEnabled(configV2)) {
    const sectionNumber = extractSectionNumber(userPrompt);
    const promptTerms = getPromptSignalTerms(userPrompt);
    const maxResults = getSearchDiagnosticsMaxResults(configV2);

    logConversationEvent('complianceConversationGraphV2RankingDiagnostics', {
      mode: conversationScope?.mode || 'unknown',
      sectionNumber,
      promptTerms,
      mergedTopCandidates: merged.slice(0, maxResults).map((candidate) => ({
        id: String(candidate?.doc?.id || '').trim() || null,
        smartnote_id: String(candidate?.doc?.smartnote_id || '').trim() || null,
        fileName: String(candidate?.doc?.smart_file_name || '').trim() || null,
        title: String(candidate?.doc?.title || '').trim() || null,
        page: Number.isFinite(Number(candidate?.doc?.page)) ? Number(candidate.doc.page) : null,
        source: candidate?.source || null,
        queryVariant: candidate?.queryVariant || null,
        rawScore: Number(candidate?.rawScore || 0).toFixed(4),
        finalScore: Number(candidate?.finalScore || 0).toFixed(4),
        hasSectionNumber: !!(sectionNumber && String(candidate?.doc?.content || '').toLowerCase().includes(sectionNumber.toLowerCase())),
        matchingTerms: promptTerms.filter((term) => {
          const title = String(candidate?.doc?.title || '').toLowerCase();
          const content = String(candidate?.doc?.content || '').toLowerCase();
          return title.includes(term) || content.includes(term);
        }),
      })),
      selectedEvidence: evidencePayload.slice(0, maxResults),
    });
  }

  logConversationEvent('complianceConversationGraphV2EvidenceSelected', {
    mode: conversationScope?.mode || 'unknown',
    mergedCandidateCount: merged.length,
    selectedEvidenceCount: evidence.length,
    usedDocumentCount: usedDocuments.length,
  });

  return {
    ...state,
    rankedCandidates: merged,
    evidence,
    evidencePayload,
    usedDocuments,
  };
};

const generateAnswerNodeV2 = async (state) => {
  const { completionsClient, configV2, userPrompt, evidencePayload, geisingerConversation, conversationScope } = state;

  if (!Array.isArray(evidencePayload) || evidencePayload.length === 0) {
    return {
      ...state,
      conversationResponse: 'I could not find enough indexed evidence to answer this question confidently. Try refining the question, selecting a specific document, or confirming that the document has been prepared.',
    };
  }

  const userInstruction = [
    `User question: ${userPrompt}`,
    `Scope mode: ${conversationScope?.mode || 'unknown'}`,
    `LOB: ${conversationScope?.normalizedLob || geisingerConversation?.lob || 'n/a'}`,
    'Evidence JSON:',
    JSON.stringify(evidencePayload, null, 2),
    'Answer requirements:',
    '- Provide a direct answer first.',
    '- Include key supporting points.',
    '- Include citations inline in [file:page] format.',
    '- If requirements are unclear or unsupported, state limitations clearly.',
  ].join('\n\n');

  const completion = await completionsClient.chat.completions.create({
    model: configV2.answer.model,
    temperature: configV2.answer.temperature,
    max_completion_tokens: configV2.answer.maxTokens,
    messages: [
      { role: 'system', content: configV2.answer.systemPrompt },
      { role: 'user', content: userInstruction },
    ],
  });

  const conversationResponse = completion.choices?.[0]?.message?.content || 'No response generated.';

  return {
    ...state,
    conversationResponse,
  };
};

const formatResponseNodeV2 = async (state) => {
  const { configV2, conversationResponse, conversationScope, geisingerConversation, evidencePayload, usedDocuments, userPrompt } = state;
  const isAllLob = conversationScope?.mode === 'all-docs-in-lob';

  const firstCitationPage = extractFirstCitationPage(conversationResponse);
  const topEvidencePage = Array.isArray(evidencePayload) && evidencePayload.length > 0
    ? evidencePayload[0]?.page
    : null;
  const topLinkPage = firstCitationPage || topEvidencePage;

  const url = buildConversationDocumentUrl(geisingerConversation, topLinkPage);
  const citationUrlMap = await buildCitationUrlMap({ geisingerConversation, evidencePayload, config: configV2 });
  const linkedConversationResponse = linkifyInlineCitations(conversationResponse, geisingerConversation, citationUrlMap);
  const fileAName = String(
    geisingerConversation?.fileAName
    || geisingerConversation?.smart_file_name
    || (isAllLob ? `All ${conversationScope?.normalizedLob || geisingerConversation?.lob || 'LOB'} Documents` : 'Selected Document')
  ).trim();

  const formattedBody = applyTemplate(configV2.format.responseTemplate, {
    ...geisingerConversation,
    fileAName: buildDocumentDisplayLabel({ fileAName, url, isAllLob }),
    documentDisplay: buildDocumentDisplayLabel({ fileAName, url, isAllLob }),
    url,
    userPrompt,
    conversationResponse: linkedConversationResponse,
  });

  const usedDocCap = Number(configV2?.format?.maxUsedDocumentsInResponse || 12);
  const usedDocLines = (usedDocuments || []).slice(0, usedDocCap).map((doc) => {
    const pages = Array.isArray(doc.pages) && doc.pages.length > 0 ? ` (pages: ${doc.pages.join(', ')})` : '';
    return `- ${doc.fileName}${pages}`;
  });

  const docsUsedSection = usedDocLines.length > 0
    ? `### Documents Used\n${usedDocLines.join('\n')}`
    : '### Documents Used\n- None';

  const evidenceSection = configV2.format.includeEvidenceSection
    ? buildEvidenceMarkdown(evidencePayload, configV2.format.evidenceSectionTitle)
    : '';

  const formattedResponse = [
    formattedBody,
    isAllLob ? `\n\n${docsUsedSection}` : '',
    evidenceSection ? `\n\n${evidenceSection}` : '',
  ].filter(Boolean).join('');

  return {
    ...state,
    formattedResponse,
    suggestedPrompts: [
      'Can you provide the exact quoted language for this requirement?',
      'What related exceptions or special cases are mentioned?',
      'Which other documents in this LOB discuss this same topic?',
    ],
  };
};

export async function getConversationConfigSnapshotV2() {
  const geisingerConfigEnabled = String(process.env.COMPLIANCE_CONVERSATION_GEISINGER_CONFIG_ENABLED || 'true').toLowerCase() !== 'false';
  const geisingerConfigDocuments = geisingerConfigEnabled
    ? await fetchConversationConfigDocumentsV2()
    : [];

  const { config, metadata } = await loadConversationConfigV2({
    geisingerConfigDocuments,
  });

  return {
    config,
    metadata: {
      ...metadata,
      fileSources: Object.fromEntries(
        Object.entries(metadata?.fileSources || {}).map(([key, value]) => [key, String(value || '').split(/[/\\]/).pop() || ''])
      ),
    },
  };
}

async function complianceConversationGraphV2(nuid, { geisingerConversation, sources, chatInteraction, chatId, chatInteractionId, prompt }) {
  const StateAnnotation = Annotation.Root({
    nuid: Annotation,
    geisingerConversation: Annotation,
    sources: Annotation,
    userPrompt: Annotation,
    configV2: Annotation,
    configMetadataV2: Annotation,
    completionsClient: Annotation,
    embeddingsClient: Annotation,
    searchClient: Annotation,
    promptEmbedding: Annotation,
    conversationScope: Annotation,
    rawCandidates: Annotation,
    rankedCandidates: Annotation,
    evidence: Annotation,
    evidencePayload: Annotation,
    usedDocuments: Annotation,
    retrievalDiagnostics: Annotation,
    conversationResponse: Annotation,
    formattedResponse: Annotation,
    suggestedPrompts: Annotation,
  });

  const graphBuilder = new StateGraph(StateAnnotation)
    .addNode('loadConfigNodeV2', loadConfigNodeV2)
    .addNode('normalizeScopeNodeV2', normalizeScopeNodeV2)
    .addNode('vectorizePromptNodeV2', vectorizePromptNodeV2)
    .addNode('runSearchNodeV2', runSearchNodeV2)
    .addNode('rankEvidenceNodeV2', rankEvidenceNodeV2)
    .addNode('generateAnswerNodeV2', generateAnswerNodeV2)
    .addNode('formatResponseNodeV2', formatResponseNodeV2)
    .addEdge(START, 'loadConfigNodeV2')
    .addEdge('loadConfigNodeV2', 'normalizeScopeNodeV2')
    .addEdge('normalizeScopeNodeV2', 'vectorizePromptNodeV2')
    .addEdge('vectorizePromptNodeV2', 'runSearchNodeV2')
    .addEdge('runSearchNodeV2', 'rankEvidenceNodeV2')
    .addEdge('rankEvidenceNodeV2', 'generateAnswerNodeV2')
    .addEdge('generateAnswerNodeV2', 'formatResponseNodeV2')
    .addEdge('formatResponseNodeV2', END);

  const graph = graphBuilder.compile();

  const completionsClient = await getCompletionsClient();

  const userPrompt = String(prompt || chatInteraction?.prompt || '').trim();

  logConversationEvent('complianceConversationGraphV2Started', {
    hasPrompt: !!userPrompt,
    promptLength: userPrompt.length,
    teamName: String(geisingerConversation?.teamName || '').trim() || null,
    conversationId: String(geisingerConversation?.id || '').trim() || null,
    inferredLob: String(geisingerConversation?.lob || '').trim() || null,
  });

  const initialState = {
    nuid,
    completionsClient,
    geisingerConversation: geisingerConversation || {},
    sources: sources || [],
    userPrompt,
  };

  const teamName = String(geisingerConversation?.teamName || '').trim();
  const normalizedChatId = String(chatId || chatInteraction?.parentId || geisingerConversation?.chatId || '').trim();
  const normalizedChatInteractionId = String(chatInteractionId || chatInteraction?.id || geisingerConversation?.chatInteractionId || '').trim();
  const shouldTrackProgress = !!(teamName && normalizedChatInteractionId);

  if (!shouldTrackProgress) {
    const result = await graph.invoke(initialState);

    logConversationEvent('complianceConversationGraphV2Completed', {
      mode: result?.conversationScope?.mode || 'unknown',
      candidateCount: result?.retrievalDiagnostics?.candidateCount || 0,
      usedDocumentCount: Array.isArray(result?.usedDocuments) ? result.usedDocuments.length : 0,
      progressMode: 'synchronous',
    });

    return {
      responseContent: result.formattedResponse,
      suggestedPrompts: result.suggestedPrompts || [],
      diagnostics: result.retrievalDiagnostics || {},
      usedDocuments: result.usedDocuments || [],
    };
  }

  const initialMessage = String(HARD_CODED_CONVERSATION_CONFIG?.runtime?.progress?.initialMessage || 'Running conversation retrieval and analysis...').trim() || 'Running conversation retrieval and analysis...';
  const initialProgress = createProgressMarkdown(initialMessage, '', 'Conversation');
  await updateChatInteractionProgress(teamName, normalizedChatId, normalizedChatInteractionId, initialProgress);

  (async () => {
    try {
      const result = await graph.invoke(initialState);
      const finalResponse = result?.formattedResponse || 'Conversation processing completed, but no response was generated.';
      await updateChatInteractionProgress(teamName, normalizedChatId, normalizedChatInteractionId, finalResponse);

      logConversationEvent('complianceConversationGraphV2Completed', {
        mode: result?.conversationScope?.mode || 'unknown',
        candidateCount: result?.retrievalDiagnostics?.candidateCount || 0,
        usedDocumentCount: Array.isArray(result?.usedDocuments) ? result.usedDocuments.length : 0,
        progressMode: 'asynchronous',
      });
    } catch (error) {
      const errorProgressBase = createProgressMarkdown('Conversation processing failed.', error?.message || 'Unknown error', 'Conversation');
      const errorProgress = errorProgressBase
        .replace(/\[[^\]\r\n]{1,8}\]\s+Processing:/i, '❌')
        .replace('🤖 AI processing:', '❌')
        .replace('⏳', '❌');
      await updateChatInteractionProgress(teamName, normalizedChatId, normalizedChatInteractionId, errorProgress);

      logConversationEvent('complianceConversationGraphV2Failed', {
        chatInteractionId: normalizedChatInteractionId,
        error: error?.message || String(error),
      });
    }
  })();

  return {
    responseContent: initialProgress,
    suggestedPrompts: [],
    diagnostics: {
      mode: 'async-progress',
      status: 'processing',
    },
    usedDocuments: [],
  };
}

export { complianceConversationGraphV2, HARD_CODED_CONVERSATION_CONFIG };
