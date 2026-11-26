import { readFile } from 'fs/promises';
import path from 'path';

const DEFAULT_CONFIG_DIR = path.resolve(process.cwd(), 'app/services/langgraphs/compliance/config');

const DEFAULT_CONVERSATION_CONFIG_V2 = {
  retrieval: {
    searchFields: ['content', 'title', 'smart_file_name'],
    selectFields: ['id', 'smartnote_id', 'smart_file_name', 'smart_file_type', 'title', 'content', 'page', 'createdAt'],
    strategy: {
      keywordTop: 60,
      semanticTop: 60,
      maxVariants: 4,
      maxLobBatches: 8,
      maxConversationIdsPerBatch: 120,
      maxCandidatesAfterMerge: 220,
      selectedDocEvidenceCount: 16,
      allLobEvidenceCount: 28,
      perDocumentCapAllLob: 4,
      evidenceSnippetMaxLength: 420,
    },
  },
  ranking: {
    scoreWeight: 1,
    exactSectionBoost: 3.5,
    titleTermBoost: 1.2,
    contentTermBoost: 0.4,
    exactPromptBoost: 2,
    queryVariantBoost: {
      exact: 0.8,
      normalized: 0.5,
      sectionOnly: 0.7,
      quotedClause: 0.3,
    },
  },
  answer: {
    model: 'gpt-4o',
    temperature: 0.2,
    maxTokens: 1200,
    systemPrompt: 'You are a healthcare compliance analyst. Answer only from provided evidence snippets. If evidence is insufficient, say so explicitly and list what is missing. Always cite evidence as [file:page].',
  },
  format: {
    responseTemplate: '## Document Overview\n\n**Document:** ${documentDisplay}\n\n---\n\n**Your Question:**  \n_${userPrompt}_\n\n---\n\n**What I found:**\n\n${conversationResponse}',
    includeEvidenceSection: false,
    evidenceSectionTitle: '### Evidence Used',
    maxUsedDocumentsInResponse: 12,
  },
  runtime: {
    search: {
      indexName: 'geisinger-002',
    },
    data: {
      collectionName: 'user_collection',
    },
    embedding: {
      model: 'text-embedding-ada-002',
      deployment: 'gpt-4o-aisvc',
      apiVersion: '2023-05-15',
    },
    preparationVersion: {
      envVar: 'GEISINGER_PREPARATION_VERSION',
      defaultValue: '1',
    },
    progress: {
      initialMessage: 'Running conversation retrieval and analysis...',
    },
    debug: {
      searchLogging: {
        enabled: false,
        maxResults: 8,
      },
    },
  },
};

const FILES = {
  retrieval: 'conversation-retrieval-v2.json',
  ranking: 'conversation-ranking-v2.json',
  runtime: 'conversation-runtime-v2.json',
  answer: 'conversation-answer-v2.md',
  format: 'conversation-format-v2.md',
};

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (!isObject(base)) return override;
  if (!isObject(override)) return override === undefined ? base : override;

  const result = { ...base };
  const keys = new Set([...Object.keys(base), ...Object.keys(override)]);

  for (const key of keys) {
    const baseValue = base[key];
    const overrideValue = override[key];

    if (overrideValue === undefined) {
      result[key] = baseValue;
      continue;
    }

    if (Array.isArray(baseValue) || Array.isArray(overrideValue)) {
      result[key] = Array.isArray(overrideValue) ? overrideValue : baseValue;
      continue;
    }

    result[key] = deepMerge(baseValue, overrideValue);
  }

  return result;
}

function parseNumber(value, fallback, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY, integer = false } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min || parsed > max) return fallback;
  return integer ? Math.floor(parsed) : parsed;
}

function parseString(value, fallback) {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function parseStringArray(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value.map((item) => String(item || '').trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function normalizeConfig(rawConfig) {
  const merged = deepMerge(DEFAULT_CONVERSATION_CONFIG_V2, rawConfig || {});
  const normalized = JSON.parse(JSON.stringify(DEFAULT_CONVERSATION_CONFIG_V2));

  normalized.retrieval.searchFields = parseStringArray(merged?.retrieval?.searchFields, normalized.retrieval.searchFields);
  normalized.retrieval.selectFields = parseStringArray(merged?.retrieval?.selectFields, normalized.retrieval.selectFields);

  normalized.retrieval.strategy.keywordTop = parseNumber(merged?.retrieval?.strategy?.keywordTop, normalized.retrieval.strategy.keywordTop, { min: 1, integer: true });
  normalized.retrieval.strategy.semanticTop = parseNumber(merged?.retrieval?.strategy?.semanticTop, normalized.retrieval.strategy.semanticTop, { min: 1, integer: true });
  normalized.retrieval.strategy.maxVariants = parseNumber(merged?.retrieval?.strategy?.maxVariants, normalized.retrieval.strategy.maxVariants, { min: 1, integer: true });
  normalized.retrieval.strategy.maxLobBatches = parseNumber(merged?.retrieval?.strategy?.maxLobBatches, normalized.retrieval.strategy.maxLobBatches, { min: 1, integer: true });
  normalized.retrieval.strategy.maxConversationIdsPerBatch = parseNumber(merged?.retrieval?.strategy?.maxConversationIdsPerBatch, normalized.retrieval.strategy.maxConversationIdsPerBatch, { min: 1, integer: true });
  normalized.retrieval.strategy.maxCandidatesAfterMerge = parseNumber(merged?.retrieval?.strategy?.maxCandidatesAfterMerge, normalized.retrieval.strategy.maxCandidatesAfterMerge, { min: 1, integer: true });
  normalized.retrieval.strategy.selectedDocEvidenceCount = parseNumber(merged?.retrieval?.strategy?.selectedDocEvidenceCount, normalized.retrieval.strategy.selectedDocEvidenceCount, { min: 1, integer: true });
  normalized.retrieval.strategy.allLobEvidenceCount = parseNumber(merged?.retrieval?.strategy?.allLobEvidenceCount, normalized.retrieval.strategy.allLobEvidenceCount, { min: 1, integer: true });
  normalized.retrieval.strategy.perDocumentCapAllLob = parseNumber(merged?.retrieval?.strategy?.perDocumentCapAllLob, normalized.retrieval.strategy.perDocumentCapAllLob, { min: 1, integer: true });
  normalized.retrieval.strategy.evidenceSnippetMaxLength = parseNumber(
    merged?.retrieval?.strategy?.evidenceSnippetMaxLength,
    normalized.retrieval.strategy.evidenceSnippetMaxLength,
    { min: 120, max: 8000, integer: true }
  );

  normalized.ranking.scoreWeight = parseNumber(merged?.ranking?.scoreWeight, normalized.ranking.scoreWeight);
  normalized.ranking.exactSectionBoost = parseNumber(merged?.ranking?.exactSectionBoost, normalized.ranking.exactSectionBoost);
  normalized.ranking.titleTermBoost = parseNumber(merged?.ranking?.titleTermBoost, normalized.ranking.titleTermBoost);
  normalized.ranking.contentTermBoost = parseNumber(merged?.ranking?.contentTermBoost, normalized.ranking.contentTermBoost);
  normalized.ranking.exactPromptBoost = parseNumber(merged?.ranking?.exactPromptBoost, normalized.ranking.exactPromptBoost);
  normalized.ranking.queryVariantBoost.exact = parseNumber(merged?.ranking?.queryVariantBoost?.exact, normalized.ranking.queryVariantBoost.exact);
  normalized.ranking.queryVariantBoost.normalized = parseNumber(merged?.ranking?.queryVariantBoost?.normalized, normalized.ranking.queryVariantBoost.normalized);
  normalized.ranking.queryVariantBoost.sectionOnly = parseNumber(merged?.ranking?.queryVariantBoost?.sectionOnly, normalized.ranking.queryVariantBoost.sectionOnly);
  normalized.ranking.queryVariantBoost.quotedClause = parseNumber(merged?.ranking?.queryVariantBoost?.quotedClause, normalized.ranking.queryVariantBoost.quotedClause);

  normalized.answer.model = parseString(merged?.answer?.model, normalized.answer.model);
  normalized.answer.temperature = parseNumber(merged?.answer?.temperature, normalized.answer.temperature);
  normalized.answer.maxTokens = parseNumber(merged?.answer?.maxTokens, normalized.answer.maxTokens, { min: 1, integer: true });
  normalized.answer.systemPrompt = parseString(merged?.answer?.systemPrompt, normalized.answer.systemPrompt);

  normalized.format.responseTemplate = parseString(merged?.format?.responseTemplate, normalized.format.responseTemplate);
  normalized.format.includeEvidenceSection = parseBoolean(merged?.format?.includeEvidenceSection, normalized.format.includeEvidenceSection);
  normalized.format.evidenceSectionTitle = parseString(merged?.format?.evidenceSectionTitle, normalized.format.evidenceSectionTitle);
  normalized.format.maxUsedDocumentsInResponse = parseNumber(merged?.format?.maxUsedDocumentsInResponse, normalized.format.maxUsedDocumentsInResponse, { min: 1, integer: true });

  normalized.runtime.search.indexName = parseString(merged?.runtime?.search?.indexName, normalized.runtime.search.indexName);
  normalized.runtime.data.collectionName = parseString(merged?.runtime?.data?.collectionName, normalized.runtime.data.collectionName);
  normalized.runtime.embedding.model = parseString(merged?.runtime?.embedding?.model, normalized.runtime.embedding.model);
  normalized.runtime.embedding.deployment = parseString(merged?.runtime?.embedding?.deployment, normalized.runtime.embedding.deployment);
  normalized.runtime.embedding.apiVersion = parseString(merged?.runtime?.embedding?.apiVersion, normalized.runtime.embedding.apiVersion);
  normalized.runtime.preparationVersion.envVar = parseString(merged?.runtime?.preparationVersion?.envVar, normalized.runtime.preparationVersion.envVar);
  normalized.runtime.preparationVersion.defaultValue = parseString(merged?.runtime?.preparationVersion?.defaultValue, normalized.runtime.preparationVersion.defaultValue);
  normalized.runtime.progress.initialMessage = parseString(merged?.runtime?.progress?.initialMessage, normalized.runtime.progress.initialMessage);
  normalized.runtime.debug.searchLogging.enabled = parseBoolean(
    merged?.runtime?.debug?.searchLogging?.enabled,
    normalized.runtime.debug.searchLogging.enabled
  );
  normalized.runtime.debug.searchLogging.maxResults = parseNumber(
    merged?.runtime?.debug?.searchLogging?.maxResults,
    normalized.runtime.debug.searchLogging.maxResults,
    { min: 1, max: 50, integer: true }
  );

  return normalized;
}

async function readJsonFileSafe(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function readTextFileSafe(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

function parseMarkdownAnswerConfig(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return {};

  const systemPromptMatch = text.match(/System prompt:\s*([\s\S]*?)\n\s*Generation settings:/i);
  const modelMatch = text.match(/-\s*model:\s*([^\n]+)/i);
  const temperatureMatch = text.match(/-\s*temperature:\s*([^\n]+)/i);
  const maxTokensMatch = text.match(/-\s*max_completion_tokens:\s*([^\n]+)/i);

  return {
    model: String(modelMatch?.[1] || '').trim() || undefined,
    temperature: temperatureMatch?.[1] !== undefined ? Number(temperatureMatch[1]) : undefined,
    maxTokens: maxTokensMatch?.[1] !== undefined ? Number(maxTokensMatch[1]) : undefined,
    systemPrompt: String(systemPromptMatch?.[1] || '').replace(/\n{2,}/g, ' ').replace(/\s+/g, ' ').trim() || undefined,
  };
}

function parseMarkdownFormatConfig(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return {};

  const templateMatch = text.match(/```md\s*([\s\S]*?)\s*```/i);
  const includeEvidence = /Evidence snippets are not shown by default/i.test(text) ? false : undefined;

  return {
    responseTemplate: String(templateMatch?.[1] || '').trim() || undefined,
    includeEvidenceSection: includeEvidence,
  };
}

function parseJsonConfigText(rawText) {
  const text = String(rawText || '').trim();
  if (!text) {
    throw new Error('Configuration text is empty.');
  }

  let jsonText = text;
  const fencedMatch = text.match(/^```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```$/);
  if (fencedMatch) {
    jsonText = String(fencedMatch[1] || '').trim();
  }

  return JSON.parse(jsonText);
}

function normalizeLookupKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.(json|md)$/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function detectFragmentKeyFromDocument(doc = {}) {
  const titleKey = normalizeLookupKey(doc?.title || '');
  const purposeKey = normalizeLookupKey(doc?.purpose || '');

  const aliasMap = {
    conversationretrievalv2: 'retrieval',
    conversationretrieval: 'retrieval',
    searchconfig: 'retrieval',
    conversationrankingv2: 'ranking',
    conversationranking: 'ranking',
    conversationruntimev2: 'runtime',
    conversationruntime: 'runtime',
    conversationanswerv2: 'answer',
    conversationanswer: 'answer',
    conversationformatv2: 'format',
    conversationformat: 'format',
    chatcompletionconfig: 'answer',
    formatconfig: 'format',
  };

  if (aliasMap[titleKey]) return aliasMap[titleKey];
  if (aliasMap[purposeKey]) return aliasMap[purposeKey];

  return null;
}

function normalizeFragmentValue(fragmentKey, rawText, parsedObject) {
  if (fragmentKey === 'answer') {
    if (isObject(parsedObject)) return parsedObject;
    return parseMarkdownAnswerConfig(rawText);
  }

  if (fragmentKey === 'format') {
    if (isObject(parsedObject)) return parsedObject;
    return parseMarkdownFormatConfig(rawText);
  }

  return isObject(parsedObject) ? parsedObject : {};
}

export function parseGeisingerConversationConfigDocuments(documents = []) {
  const overlayParts = {};
  const applied = [];
  const parseErrors = [];

  for (const doc of Array.isArray(documents) ? documents : []) {
    const rawText = String(doc?.documentText || '').trim();
    if (!rawText) continue;

    try {
      const fragmentKey = detectFragmentKeyFromDocument(doc);
      if (!fragmentKey || !FILES[fragmentKey]) continue;

      let parsedObject = null;
      if (fragmentKey !== 'answer' && fragmentKey !== 'format') {
        parsedObject = parseJsonConfigText(rawText);
      } else {
        try {
          parsedObject = parseJsonConfigText(rawText);
        } catch (_) {
          parsedObject = null;
        }
      }

      const normalizedValue = normalizeFragmentValue(fragmentKey, rawText, parsedObject);
      overlayParts[fragmentKey] = deepMerge(overlayParts[fragmentKey] || {}, normalizedValue);
      applied.push({
        id: doc?.id || '',
        title: doc?.title || '',
        fragmentKey,
      });
    } catch (error) {
      parseErrors.push({
        id: doc?.id || '',
        title: doc?.title || '',
        reason: error?.message || String(error),
      });
    }
  }

  return {
    overlayParts,
    metadata: {
      documentCount: Array.isArray(documents) ? documents.length : 0,
      applied,
      parseErrors,
    },
  };
}

export async function loadConversationConfigV2(options = {}) {
  const baseDir = options.baseDir ? path.resolve(String(options.baseDir)) : DEFAULT_CONFIG_DIR;
  const geisingerConfigDocuments = Array.isArray(options.geisingerConfigDocuments)
    ? options.geisingerConfigDocuments
    : [];

  const fileParts = {};
  const fileSources = {};

  for (const [key, fileName] of Object.entries(FILES)) {
    const filePath = path.resolve(baseDir, fileName);
    if (fileName.endsWith('.json')) {
      const parsed = await readJsonFileSafe(filePath);
      if (parsed !== undefined) {
        fileParts[key] = parsed;
        fileSources[key] = filePath;
      }
      continue;
    }

    const text = await readTextFileSafe(filePath);
    if (text !== undefined) {
      fileSources[key] = filePath;
      if (key === 'answer') fileParts.answer = parseMarkdownAnswerConfig(text);
      if (key === 'format') fileParts.format = parseMarkdownFormatConfig(text);
    }
  }

  const geisingerOverlay = parseGeisingerConversationConfigDocuments(geisingerConfigDocuments);
  const mergedParts = deepMerge(fileParts, geisingerOverlay.overlayParts || {});
  const config = normalizeConfig(mergedParts);

  return {
    config,
    metadata: {
      baseDir,
      fileSources,
      geisingerOverlay: geisingerOverlay.metadata,
    },
  };
}

export { DEFAULT_CONVERSATION_CONFIG_V2 };
