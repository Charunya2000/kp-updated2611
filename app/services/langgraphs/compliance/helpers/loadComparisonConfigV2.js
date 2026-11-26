import { readFile } from 'fs/promises';
import path from 'path';

const DEFAULT_CONFIG_DIR = path.resolve(process.cwd(), 'app/services/langgraphs/compliance/config');

const DEFAULT_COMPARISON_CONFIG_V2 = {
  mode: {
    comprehensiveKeywords: [
      'whole document',
      'entire document',
      'comprehensive comparison',
      'full comparison',
      'compare documents',
      'all differences',
      'complete comparison',
      'overall differences',
      'structural differences',
      'content differences',
    ],
  },
  retrieval: {
    searchFields: ['content', 'title', 'smart_file_name'],
    selectFields: ['id', 'smartnote_id', 'smart_file_name', 'title', 'content', 'page', 'createdAt'],
    topicMode: {
      keywordTop: 70,
      semanticTop: 70,
      maxVariants: 4,
      maxCandidatesAfterMerge: 220,
      evidencePerDocument: 16,
      evidenceSnippetMaxLength: 1600,
      listRescueEnabled: true,
      listRescueTop: 1200,
      listRescueMaxAdditions: 300,
      listRescueMinRoleCandidates: 2,
      listMinRoleEvidenceInFinal: 8,
      topicExpansionEnabled: true,
      topicExpansionMaxQueries: 4,
      topicExpansionQueriesForPositions: [
        'administrative positions',
        'key administrative positions',
        'key personnel positions',
        'positions must be reported',
      ],
      listDeterministicScanEnabled: true,
      listDeterministicScanEvidencePerDocument: 60,
    },
    comprehensiveMode: {
      maxSectionsPerDocument: 220,
      chunkFetchTop: 1200,
      minTitleLength: 2,
      minContentLength: 20,
    },
  },
  ranking: {
    scoreWeight: 1,
    exactSectionBoost: 3.5,
    titleTermBoost: 1.2,
    contentTermBoost: 0.4,
    exactPromptBoost: 2,
    listRoleSignalBoost: 6,
    listHeadingBoost: 4,
    listStructureBoost: 2,
    listOffTopicPenalty: 8,
    variantBoost: {
      exact: 0.8,
      normalized: 0.5,
      sectionOnly: 0.7,
      quotedClause: 0.3,
    },
  },
  alignment: {
    similarityThreshold: 0.55,
    autoMatchThreshold: 0.86,
    llmAdjudicationThreshold: 0.72,
    secondaryMatchThreshold: 0.88,
    maxTargetCandidatesPerSource: 4,
    fallbackSearch: {
      enabled: true,
      onlyWhenNoPrimaryCandidate: true,
      maxVariants: 2,
      keywordTop: 18,
      semanticTop: 18,
      maxCandidatesAfterMerge: 32,
      maxTargetCandidatesPerSource: 3,
      autoMatchThreshold: 0.9,
      llmAdjudicationThreshold: 0.6,
      maxSourceOnlyTopicsToProbe: 20,
    },
  },
  completion: {
    preferredModels: ['openai-5.1', 'gpt-4o'],
    temperature: 0.2,
    maxTokens: 1400,
    maxShortTokens: 800,
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
    heartbeat: {
      intervalMs: 8000,
      stages: [
        'Reviewing source and target document structure...',
        'Retrieving policy evidence for comparison...',
        'Aligning similar requirements and themes...',
        'Assessing key differences and overlaps...',
        'Preparing business-ready comparison summary...',
      ],
    },
    artifact: {
      containerName: 'compliance-ai',
      pathPrefix: 'document-comparisons',
      filePattern: 'comparison-v2-{timestamp}.xlsx',
    },
    display: {
      topicEvidenceLimit: 10,
      analysisPreviewLimit: 20,
      markdownListLimit: 30,
      topicListDeltaMaxItems: 20,
    },
  },
};

const FILES = {
  mode: 'comparison-mode-v2.json',
  retrieval: 'comparison-retrieval-v2.json',
  ranking: 'comparison-ranking-v2.json',
  alignment: 'comparison-alignment-v2.json',
  completion: 'comparison-completion-v2.json',
  runtime: 'comparison-runtime-v2.json',
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

function parseStringArray(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
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

const COMPARISON_ENV_STYLE_OVERRIDES = {
  COMPLIANCE_COMPARISON_MAX_SECTIONS_PER_DOCUMENT: {
    path: ['retrieval', 'comprehensiveMode', 'maxSectionsPerDocument'],
    options: { min: 1, integer: true },
  },
  COMPLIANCE_COMPARISON_SIMILARITY_THRESHOLD: {
    path: ['alignment', 'similarityThreshold'],
    options: { min: 0, max: 1 },
  },
  COMPLIANCE_COMPARISON_AUTO_MATCH_THRESHOLD: {
    path: ['alignment', 'autoMatchThreshold'],
    options: { min: 0, max: 1 },
  },
  COMPLIANCE_COMPARISON_LLM_ADJUDICATION_THRESHOLD: {
    path: ['alignment', 'llmAdjudicationThreshold'],
    options: { min: 0, max: 1 },
  },
  COMPLIANCE_COMPARISON_SECONDARY_MATCH_THRESHOLD: {
    path: ['alignment', 'secondaryMatchThreshold'],
    options: { min: 0, max: 1 },
  },
  COMPLIANCE_COMPARISON_MARKDOWN_LIST_LIMIT: {
    path: ['runtime', 'display', 'markdownListLimit'],
    options: { min: 1, integer: true },
  },
};

function setDeepValue(target, pathKeys, value) {
  if (!isObject(target) || !Array.isArray(pathKeys) || pathKeys.length === 0) {
    return;
  }

  let cursor = target;
  for (let i = 0; i < pathKeys.length - 1; i++) {
    const key = pathKeys[i];
    if (!isObject(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  cursor[pathKeys[pathKeys.length - 1]] = value;
}

function applyMappedOverrides(config, overrides, schema) {
  const next = JSON.parse(JSON.stringify(config));
  const applied = {};

  for (const [key, definition] of Object.entries(schema)) {
    const fallback = definition.path.reduce((acc, segment) => acc?.[segment], next);
    const parsed = parseNumber(overrides?.[key], fallback, definition.options || {});
    setDeepValue(next, definition.path, parsed);
    applied[key] = overrides?.[key] !== undefined;
  }

  return { config: next, applied };
}

function extractComparisonEnvStyleOverrides(parsed = {}) {
  const out = {};
  const candidates = [
    parsed,
    parsed?.comparisonEnvOverrides,
    parsed?.complianceComparisonEnvOverrides,
    parsed?.overrides,
  ].filter(isObject);

  for (const candidate of candidates) {
    for (const key of Object.keys(COMPARISON_ENV_STYLE_OVERRIDES)) {
      if (candidate[key] !== undefined) {
        out[key] = candidate[key];
      }
    }
  }

  return out;
}

function applyEnvOverrides(config, env) {
  return applyMappedOverrides(config, env, COMPARISON_ENV_STYLE_OVERRIDES);
}

function applyGeisingerEnvStyleOverrides(config, overrides) {
  return applyMappedOverrides(config, overrides, COMPARISON_ENV_STYLE_OVERRIDES);
}

function normalizeConfig(rawConfig) {
  const merged = deepMerge(DEFAULT_COMPARISON_CONFIG_V2, rawConfig || {});

  const normalized = JSON.parse(JSON.stringify(DEFAULT_COMPARISON_CONFIG_V2));

  normalized.mode.comprehensiveKeywords = parseStringArray(
    merged?.mode?.comprehensiveKeywords,
    DEFAULT_COMPARISON_CONFIG_V2.mode.comprehensiveKeywords
  );

  normalized.retrieval.searchFields = parseStringArray(
    merged?.retrieval?.searchFields,
    DEFAULT_COMPARISON_CONFIG_V2.retrieval.searchFields
  );
  normalized.retrieval.selectFields = parseStringArray(
    merged?.retrieval?.selectFields,
    DEFAULT_COMPARISON_CONFIG_V2.retrieval.selectFields
  );

  normalized.retrieval.topicMode.keywordTop = parseNumber(merged?.retrieval?.topicMode?.keywordTop, normalized.retrieval.topicMode.keywordTop, { min: 1, integer: true });
  normalized.retrieval.topicMode.semanticTop = parseNumber(merged?.retrieval?.topicMode?.semanticTop, normalized.retrieval.topicMode.semanticTop, { min: 1, integer: true });
  normalized.retrieval.topicMode.maxVariants = parseNumber(merged?.retrieval?.topicMode?.maxVariants, normalized.retrieval.topicMode.maxVariants, { min: 1, integer: true });
  normalized.retrieval.topicMode.maxCandidatesAfterMerge = parseNumber(merged?.retrieval?.topicMode?.maxCandidatesAfterMerge, normalized.retrieval.topicMode.maxCandidatesAfterMerge, { min: 1, integer: true });
  normalized.retrieval.topicMode.evidencePerDocument = parseNumber(merged?.retrieval?.topicMode?.evidencePerDocument, normalized.retrieval.topicMode.evidencePerDocument, { min: 1, integer: true });
  normalized.retrieval.topicMode.evidenceSnippetMaxLength = parseNumber(merged?.retrieval?.topicMode?.evidenceSnippetMaxLength, normalized.retrieval.topicMode.evidenceSnippetMaxLength, { min: 300, integer: true });
  normalized.retrieval.topicMode.listRescueEnabled = parseBoolean(merged?.retrieval?.topicMode?.listRescueEnabled, normalized.retrieval.topicMode.listRescueEnabled);
  normalized.retrieval.topicMode.listRescueTop = parseNumber(merged?.retrieval?.topicMode?.listRescueTop, normalized.retrieval.topicMode.listRescueTop, { min: 1, integer: true });
  normalized.retrieval.topicMode.listRescueMaxAdditions = parseNumber(merged?.retrieval?.topicMode?.listRescueMaxAdditions, normalized.retrieval.topicMode.listRescueMaxAdditions, { min: 1, integer: true });
  normalized.retrieval.topicMode.listRescueMinRoleCandidates = parseNumber(merged?.retrieval?.topicMode?.listRescueMinRoleCandidates, normalized.retrieval.topicMode.listRescueMinRoleCandidates, { min: 1, integer: true });
  normalized.retrieval.topicMode.listMinRoleEvidenceInFinal = parseNumber(merged?.retrieval?.topicMode?.listMinRoleEvidenceInFinal, normalized.retrieval.topicMode.listMinRoleEvidenceInFinal, { min: 1, integer: true });
  normalized.retrieval.topicMode.topicExpansionEnabled = parseBoolean(merged?.retrieval?.topicMode?.topicExpansionEnabled, normalized.retrieval.topicMode.topicExpansionEnabled);
  normalized.retrieval.topicMode.topicExpansionMaxQueries = parseNumber(merged?.retrieval?.topicMode?.topicExpansionMaxQueries, normalized.retrieval.topicMode.topicExpansionMaxQueries, { min: 1, integer: true });
  normalized.retrieval.topicMode.topicExpansionQueriesForPositions = parseStringArray(
    merged?.retrieval?.topicMode?.topicExpansionQueriesForPositions,
    normalized.retrieval.topicMode.topicExpansionQueriesForPositions
  );
  normalized.retrieval.topicMode.listDeterministicScanEnabled = parseBoolean(
    merged?.retrieval?.topicMode?.listDeterministicScanEnabled,
    normalized.retrieval.topicMode.listDeterministicScanEnabled
  );
  normalized.retrieval.topicMode.listDeterministicScanEvidencePerDocument = parseNumber(
    merged?.retrieval?.topicMode?.listDeterministicScanEvidencePerDocument,
    normalized.retrieval.topicMode.listDeterministicScanEvidencePerDocument,
    { min: 1, integer: true }
  );
  normalized.retrieval.comprehensiveMode.maxSectionsPerDocument = parseNumber(merged?.retrieval?.comprehensiveMode?.maxSectionsPerDocument, normalized.retrieval.comprehensiveMode.maxSectionsPerDocument, { min: 1, integer: true });
  normalized.retrieval.comprehensiveMode.chunkFetchTop = parseNumber(merged?.retrieval?.comprehensiveMode?.chunkFetchTop, normalized.retrieval.comprehensiveMode.chunkFetchTop, { min: 1, integer: true });
  normalized.retrieval.comprehensiveMode.minTitleLength = parseNumber(merged?.retrieval?.comprehensiveMode?.minTitleLength, normalized.retrieval.comprehensiveMode.minTitleLength, { min: 0, integer: true });
  normalized.retrieval.comprehensiveMode.minContentLength = parseNumber(merged?.retrieval?.comprehensiveMode?.minContentLength, normalized.retrieval.comprehensiveMode.minContentLength, { min: 0, integer: true });

  normalized.ranking.scoreWeight = parseNumber(merged?.ranking?.scoreWeight, normalized.ranking.scoreWeight);
  normalized.ranking.exactSectionBoost = parseNumber(merged?.ranking?.exactSectionBoost, normalized.ranking.exactSectionBoost);
  normalized.ranking.titleTermBoost = parseNumber(merged?.ranking?.titleTermBoost, normalized.ranking.titleTermBoost);
  normalized.ranking.contentTermBoost = parseNumber(merged?.ranking?.contentTermBoost, normalized.ranking.contentTermBoost);
  normalized.ranking.exactPromptBoost = parseNumber(merged?.ranking?.exactPromptBoost, normalized.ranking.exactPromptBoost);
  normalized.ranking.listRoleSignalBoost = parseNumber(merged?.ranking?.listRoleSignalBoost, normalized.ranking.listRoleSignalBoost);
  normalized.ranking.listHeadingBoost = parseNumber(merged?.ranking?.listHeadingBoost, normalized.ranking.listHeadingBoost);
  normalized.ranking.listStructureBoost = parseNumber(merged?.ranking?.listStructureBoost, normalized.ranking.listStructureBoost);
  normalized.ranking.listOffTopicPenalty = parseNumber(merged?.ranking?.listOffTopicPenalty, normalized.ranking.listOffTopicPenalty);
  normalized.ranking.variantBoost.exact = parseNumber(merged?.ranking?.variantBoost?.exact, normalized.ranking.variantBoost.exact);
  normalized.ranking.variantBoost.normalized = parseNumber(merged?.ranking?.variantBoost?.normalized, normalized.ranking.variantBoost.normalized);
  normalized.ranking.variantBoost.sectionOnly = parseNumber(merged?.ranking?.variantBoost?.sectionOnly, normalized.ranking.variantBoost.sectionOnly);
  normalized.ranking.variantBoost.quotedClause = parseNumber(merged?.ranking?.variantBoost?.quotedClause, normalized.ranking.variantBoost.quotedClause);

  normalized.alignment.similarityThreshold = parseNumber(merged?.alignment?.similarityThreshold, normalized.alignment.similarityThreshold, { min: 0, max: 1 });
  normalized.alignment.autoMatchThreshold = parseNumber(merged?.alignment?.autoMatchThreshold, normalized.alignment.autoMatchThreshold, { min: 0, max: 1 });
  normalized.alignment.llmAdjudicationThreshold = parseNumber(merged?.alignment?.llmAdjudicationThreshold, normalized.alignment.llmAdjudicationThreshold, { min: 0, max: 1 });
  normalized.alignment.secondaryMatchThreshold = parseNumber(merged?.alignment?.secondaryMatchThreshold, normalized.alignment.secondaryMatchThreshold, { min: 0, max: 1 });
  normalized.alignment.maxTargetCandidatesPerSource = parseNumber(merged?.alignment?.maxTargetCandidatesPerSource, normalized.alignment.maxTargetCandidatesPerSource, { min: 1, integer: true });

  normalized.alignment.fallbackSearch.enabled = parseBoolean(merged?.alignment?.fallbackSearch?.enabled, normalized.alignment.fallbackSearch.enabled);
  normalized.alignment.fallbackSearch.onlyWhenNoPrimaryCandidate = parseBoolean(merged?.alignment?.fallbackSearch?.onlyWhenNoPrimaryCandidate, normalized.alignment.fallbackSearch.onlyWhenNoPrimaryCandidate);
  normalized.alignment.fallbackSearch.maxVariants = parseNumber(merged?.alignment?.fallbackSearch?.maxVariants, normalized.alignment.fallbackSearch.maxVariants, { min: 1, integer: true });
  normalized.alignment.fallbackSearch.keywordTop = parseNumber(merged?.alignment?.fallbackSearch?.keywordTop, normalized.alignment.fallbackSearch.keywordTop, { min: 1, integer: true });
  normalized.alignment.fallbackSearch.semanticTop = parseNumber(merged?.alignment?.fallbackSearch?.semanticTop, normalized.alignment.fallbackSearch.semanticTop, { min: 1, integer: true });
  normalized.alignment.fallbackSearch.maxCandidatesAfterMerge = parseNumber(merged?.alignment?.fallbackSearch?.maxCandidatesAfterMerge, normalized.alignment.fallbackSearch.maxCandidatesAfterMerge, { min: 1, integer: true });
  normalized.alignment.fallbackSearch.maxTargetCandidatesPerSource = parseNumber(merged?.alignment?.fallbackSearch?.maxTargetCandidatesPerSource, normalized.alignment.fallbackSearch.maxTargetCandidatesPerSource, { min: 1, integer: true });
  normalized.alignment.fallbackSearch.autoMatchThreshold = parseNumber(merged?.alignment?.fallbackSearch?.autoMatchThreshold, normalized.alignment.fallbackSearch.autoMatchThreshold, { min: 0, max: 1 });
  normalized.alignment.fallbackSearch.llmAdjudicationThreshold = parseNumber(merged?.alignment?.fallbackSearch?.llmAdjudicationThreshold, normalized.alignment.fallbackSearch.llmAdjudicationThreshold, { min: 0, max: 1 });
  normalized.alignment.fallbackSearch.maxSourceOnlyTopicsToProbe = parseNumber(merged?.alignment?.fallbackSearch?.maxSourceOnlyTopicsToProbe, normalized.alignment.fallbackSearch.maxSourceOnlyTopicsToProbe, { min: 1, integer: true });

  normalized.completion.preferredModels = parseStringArray(merged?.completion?.preferredModels, normalized.completion.preferredModels);
  normalized.completion.temperature = parseNumber(merged?.completion?.temperature, normalized.completion.temperature);
  normalized.completion.maxTokens = parseNumber(merged?.completion?.maxTokens, normalized.completion.maxTokens, { min: 1, integer: true });
  normalized.completion.maxShortTokens = parseNumber(merged?.completion?.maxShortTokens, normalized.completion.maxShortTokens, { min: 1, integer: true });

  normalized.runtime.search.indexName = String(merged?.runtime?.search?.indexName || normalized.runtime.search.indexName).trim() || normalized.runtime.search.indexName;
  normalized.runtime.data.collectionName = String(merged?.runtime?.data?.collectionName || normalized.runtime.data.collectionName).trim() || normalized.runtime.data.collectionName;
  normalized.runtime.embedding.model = String(merged?.runtime?.embedding?.model || normalized.runtime.embedding.model).trim() || normalized.runtime.embedding.model;
  normalized.runtime.embedding.deployment = String(merged?.runtime?.embedding?.deployment || normalized.runtime.embedding.deployment).trim() || normalized.runtime.embedding.deployment;
  normalized.runtime.embedding.apiVersion = String(merged?.runtime?.embedding?.apiVersion || normalized.runtime.embedding.apiVersion).trim() || normalized.runtime.embedding.apiVersion;

  normalized.runtime.heartbeat.intervalMs = parseNumber(merged?.runtime?.heartbeat?.intervalMs, normalized.runtime.heartbeat.intervalMs, { min: 1000, integer: true });
  normalized.runtime.heartbeat.stages = parseStringArray(merged?.runtime?.heartbeat?.stages, normalized.runtime.heartbeat.stages);

  normalized.runtime.artifact.containerName = String(merged?.runtime?.artifact?.containerName || normalized.runtime.artifact.containerName).trim() || normalized.runtime.artifact.containerName;
  normalized.runtime.artifact.pathPrefix = String(merged?.runtime?.artifact?.pathPrefix || normalized.runtime.artifact.pathPrefix).trim() || normalized.runtime.artifact.pathPrefix;
  normalized.runtime.artifact.filePattern = String(merged?.runtime?.artifact?.filePattern || normalized.runtime.artifact.filePattern).trim() || normalized.runtime.artifact.filePattern;

  normalized.runtime.display.topicEvidenceLimit = parseNumber(merged?.runtime?.display?.topicEvidenceLimit, normalized.runtime.display.topicEvidenceLimit, { min: 1, integer: true });
  normalized.runtime.display.analysisPreviewLimit = parseNumber(merged?.runtime?.display?.analysisPreviewLimit, normalized.runtime.display.analysisPreviewLimit, { min: 1, integer: true });
  normalized.runtime.display.markdownListLimit = parseNumber(merged?.runtime?.display?.markdownListLimit, normalized.runtime.display.markdownListLimit, { min: 1, integer: true });
  normalized.runtime.display.topicListDeltaMaxItems = parseNumber(merged?.runtime?.display?.topicListDeltaMaxItems, normalized.runtime.display.topicListDeltaMaxItems, { min: 1, integer: true });

  return normalized;
}

function mapLegacyShapes(fileParts) {
  const next = { ...fileParts };

  if (isObject(next.alignment) && isObject(next.alignment.alignment)) {
    next.alignment = next.alignment.alignment;
  }

  if (isObject(fileParts.alignment) && isObject(fileParts.alignment.completion) && !isObject(next.completion)) {
    next.completion = fileParts.alignment.completion;
  }

  if (isObject(next.retrieval) && typeof next.retrieval.searchIndex === 'string') {
    next.runtime = deepMerge(next.runtime || {}, {
      search: {
        indexName: next.retrieval.searchIndex,
      },
    });
  }

  return next;
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

export function parseJsonConfigText(rawText) {
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

export function parseGeisingerConfigText(rawText) {
  return parseJsonConfigText(rawText);
}

function normalizeLookupKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.json$/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function detectFragmentKeyFromDocument(doc = {}, parsed = {}) {
  const titleKey = normalizeLookupKey(doc?.title || '');
  const purposeKey = normalizeLookupKey(doc?.purpose || '');

  const aliasMap = {
    comparisonmodev2: 'mode',
    comparisonmode: 'mode',
    modeconfig: 'mode',
    comparisonretrievalv2: 'retrieval',
    comparisonretrieval: 'retrieval',
    retrievalconfig: 'retrieval',
    comparisonrankingv2: 'ranking',
    comparisonranking: 'ranking',
    rankingconfig: 'ranking',
    comparisonalignmentv2: 'alignment',
    comparisonalignment: 'alignment',
    alignconfig: 'alignment',
    comparisoncompletionv2: 'completion',
    comparisoncompletion: 'completion',
    chatcompletionconfig: 'completion',
    comparisonruntimev2: 'runtime',
    comparisonruntime: 'runtime',
    runtimeconfig: 'runtime',
  };

  if (aliasMap[titleKey]) return aliasMap[titleKey];
  if (aliasMap[purposeKey]) return aliasMap[purposeKey];

  const parsedKeys = Object.keys(parsed || {});
  if (parsedKeys.length === 1) {
    const onlyKey = parsedKeys[0];
    if (FILES[onlyKey]) return onlyKey;
  }

  if (isObject(parsed?.mode)) return 'mode';
  if (isObject(parsed?.retrieval)) return 'retrieval';
  if (isObject(parsed?.ranking)) return 'ranking';
  if (isObject(parsed?.alignment)) return 'alignment';
  if (isObject(parsed?.completion)) return 'completion';
  if (isObject(parsed?.runtime)) return 'runtime';

  return null;
}

export function parseGeisingerComparisonConfigDocuments(documents = []) {
  const overlayParts = {};
  const envStyleOverrides = {};
  const applied = [];
  const parseErrors = [];

  for (const doc of Array.isArray(documents) ? documents : []) {
    const rawText = String(doc?.documentText || '').trim();
    if (!rawText) continue;

    try {
      const parsed = parseGeisingerConfigText(rawText);
      if (!isObject(parsed)) {
        parseErrors.push({
          id: doc?.id || '',
          title: doc?.title || '',
          reason: 'Parsed config is not a JSON object.',
        });
        continue;
      }

      const fragmentKey = detectFragmentKeyFromDocument(doc, parsed);

      if (fragmentKey && FILES[fragmentKey]) {
        const normalizedValue = isObject(parsed?.[fragmentKey]) ? parsed[fragmentKey] : parsed;
        overlayParts[fragmentKey] = deepMerge(overlayParts[fragmentKey] || {}, normalizedValue);
        applied.push({
          id: doc?.id || '',
          title: doc?.title || '',
          fragmentKey,
          source: 'fragment',
        });
        continue;
      }

      // Full-config style payloads can overlay multiple fragments in one document.
      for (const key of Object.keys(FILES)) {
        if (!isObject(parsed?.[key])) continue;
        overlayParts[key] = deepMerge(overlayParts[key] || {}, parsed[key]);
        applied.push({
          id: doc?.id || '',
          title: doc?.title || '',
          fragmentKey: key,
          source: 'full-config',
        });
      }

      const envStyleFromDoc = extractComparisonEnvStyleOverrides(parsed);
      const envStyleKeys = Object.keys(envStyleFromDoc);
      if (envStyleKeys.length > 0) {
        Object.assign(envStyleOverrides, envStyleFromDoc);
        applied.push({
          id: doc?.id || '',
          title: doc?.title || '',
          fragmentKey: 'env-style-overrides',
          source: 'env-style',
          keys: envStyleKeys,
        });
      }
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
    envStyleOverrides,
    metadata: {
      documentCount: Array.isArray(documents) ? documents.length : 0,
      applied,
      parseErrors,
    },
  };
}

export async function loadComparisonConfigV2(options = {}) {
  const baseDir = options.baseDir ? path.resolve(String(options.baseDir)) : DEFAULT_CONFIG_DIR;
  const env = options.env || process.env;
  const geisingerConfigDocuments = Array.isArray(options.geisingerConfigDocuments)
    ? options.geisingerConfigDocuments
    : [];

  const fileParts = {};
  const fileSources = {};

  for (const [key, fileName] of Object.entries(FILES)) {
    const filePath = path.resolve(baseDir, fileName);
    const parsed = await readJsonFileSafe(filePath);
    if (parsed !== undefined) {
      fileParts[key] = parsed;
      fileSources[key] = filePath;
    }
  }

  const geisingerOverlay = parseGeisingerComparisonConfigDocuments(geisingerConfigDocuments);
  const mergedParts = deepMerge(fileParts, geisingerOverlay.overlayParts || {});

  const normalizedParts = mapLegacyShapes(mergedParts);
  const normalizedConfig = normalizeConfig(normalizedParts);
  const geisingerEnvStyle = applyGeisingerEnvStyleOverrides(normalizedConfig, geisingerOverlay.envStyleOverrides || {});

  const legacyEnvOverridesEnabled = String(env.COMPLIANCE_COMPARISON_ENABLE_LEGACY_ENV_OVERRIDES || '').toLowerCase() === 'true';
  const envOverrides = legacyEnvOverridesEnabled
    ? applyEnvOverrides(geisingerEnvStyle.config, env)
    : { config: geisingerEnvStyle.config, applied: {} };

  return {
    config: envOverrides.config,
    metadata: {
      baseDir,
      fileSources,
      geisingerOverlay: geisingerOverlay.metadata,
      geisingerEnvStyleOverridesApplied: geisingerEnvStyle.applied,
      legacyEnvOverridesEnabled,
      envOverridesApplied: {
        maxSectionsPerDocument: !!envOverrides.applied?.COMPLIANCE_COMPARISON_MAX_SECTIONS_PER_DOCUMENT,
        similarityThreshold: !!envOverrides.applied?.COMPLIANCE_COMPARISON_SIMILARITY_THRESHOLD,
        autoMatchThreshold: !!envOverrides.applied?.COMPLIANCE_COMPARISON_AUTO_MATCH_THRESHOLD,
        llmAdjudicationThreshold: !!envOverrides.applied?.COMPLIANCE_COMPARISON_LLM_ADJUDICATION_THRESHOLD,
        secondaryMatchThreshold: !!envOverrides.applied?.COMPLIANCE_COMPARISON_SECONDARY_MATCH_THRESHOLD,
        markdownListLimit: !!envOverrides.applied?.COMPLIANCE_COMPARISON_MARKDOWN_LIST_LIMIT,
      },
    },
  };
}

export { DEFAULT_COMPARISON_CONFIG_V2 };
