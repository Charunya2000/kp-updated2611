import { readFile } from 'fs/promises';
import path from 'path';
let cachedSelectGeisingerConfigContextDocuments;

async function getSelectGeisingerConfigContextDocuments() {
  if (cachedSelectGeisingerConfigContextDocuments) {
    return cachedSelectGeisingerConfigContextDocuments;
  }

  try {
    ({ selectGeisingerConfigContextDocuments: cachedSelectGeisingerConfigContextDocuments } = await import('@/app/services/geisingerConfigService'));
  } catch (error) {
    ({ selectGeisingerConfigContextDocuments: cachedSelectGeisingerConfigContextDocuments } = await import('../../../geisingerConfigService.js'));
  }

  return cachedSelectGeisingerConfigContextDocuments;
}
const DEFAULT_CONFIG_DIR = path.resolve(process.cwd(), 'app/services/langgraphs/compliance/config');
const DEFAULT_CONFIG_FILE = 'first-principles-runtime-v1.json';
const USE_VAULT_ENV = 'USE_VAULT';

const FIRST_PRINCIPLES_KEY_REFS = {
  standard: {
    searchEndpointKeyRef: 'searchEndpoint.new.t3',
    searchQueryKeyRef: 'aisearch.new.t3.api.key',
    searchUploadKeyRef: 'aiupload.new.t3.api.key',
  },
  useVault: {
    searchEndpointKeyRef: 'searchEndpoint',
    searchQueryKeyRef: 'aisearch.api.key',
    searchUploadKeyRef: 'aiupload.api.key',
  },
};

const CONFIG_QUERY = {
  type: 'GeisingerConfig',
  collectionName: 'Document Conversation',
  purpose: 'GeneralConfig',
};

const LEGACY_RUNTIME_CONFIG_TITLE = 'Document Conversation Config For Conversation Prepare';

function looksLikeFirstPrinciplesRuntimeConfigDoc(doc = {}) {
  const title = normalizeString(doc?.title).toLowerCase();
  const id = normalizeString(doc?.id).toLowerCase();
  const textConfig = parseJsonObjectSafe(doc?.documentText) || {};

  const titleMatches = title === LEGACY_RUNTIME_CONFIG_TITLE.toLowerCase()
    || /first-principles-runtime-v\d+-geisinger-import\.json/.test(title);

  const idMatches = /first-principles-runtime-v\d+-geisinger-import/.test(id);

  const hasRuntimeShape = isObject(textConfig?.engines)
    || isObject(textConfig?.firstPrinciples)
    || isObject(textConfig?.firstPrinciplesCompare)
    || isObject(textConfig?.rolloutScope);

  return titleMatches || idMatches || hasRuntimeShape;
}

export const DEFAULT_FIRST_PRINCIPLES_RUNTIME_CONFIG_V1 = {
  engines: {
    prepEngine: 'legacy',
    conversationEngine: 'service3',
    comparisonEngine: 'service3',
  },
  firstPrinciples: {
    searchEndpointKeyRef: FIRST_PRINCIPLES_KEY_REFS.standard.searchEndpointKeyRef,
    searchQueryKeyRef: FIRST_PRINCIPLES_KEY_REFS.standard.searchQueryKeyRef,
    searchUploadKeyRef: FIRST_PRINCIPLES_KEY_REFS.standard.searchUploadKeyRef,
    chunkIndexName: 'compliance-chunks-v1',
    requirementIndexName: 'compliance-requirements-v1',
  },
  rolloutScope: {
    teamAllowlist: [],
    lobAllowlist: [],
  },
  firstPrinciplesCompare: {
    enableNearDedup: true,
    enableGapRescue: true,
  },
};

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizeLob(value) {
  const lob = normalizeString(value);
  if (!lob) return '';
  return lob.toLowerCase() === 'aca' ? 'marketplace' : lob.toLowerCase();
}

function normalizeStringArray(values = []) {
  if (!Array.isArray(values)) return [];
  return values.map((item) => normalizeString(item)).filter(Boolean);
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isUseVaultEnabled() {
  return normalizeString(process.env[USE_VAULT_ENV]).toLowerCase() === 'true';
}

function getFirstPrinciplesKeyRefsFromCode() {
  const useVault = isUseVaultEnabled();
  const refs = useVault
    ? FIRST_PRINCIPLES_KEY_REFS.useVault
    : FIRST_PRINCIPLES_KEY_REFS.standard;

  return {
    ...refs,
    source: useVault ? 'code-use-vault' : 'code-default',
  };
}

function parseJsonObjectSafe(value) {
  const raw = normalizeString(value);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function pickFirstNonBlankString(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function normalizeFirstPrinciplesCompare(compareConfig = {}) {
  if (!isObject(compareConfig)) {
    return {
      enableNearDedup: true,
      enableGapRescue: true,
    };
  }

  const normalized = {
    enableNearDedup: compareConfig.enableNearDedup === undefined ? true : Boolean(compareConfig.enableNearDedup),
    enableGapRescue: compareConfig.enableGapRescue === undefined ? true : Boolean(compareConfig.enableGapRescue),
  };

  const sampleSize = normalizeOptionalNumber(compareConfig.sampleSize);
  const nearDedupThreshold = normalizeOptionalNumber(compareConfig.nearDedupThreshold);
  const gapRescueThreshold = normalizeOptionalNumber(compareConfig.gapRescueThreshold);

  if (sampleSize !== undefined) {
    normalized.sampleSize = sampleSize;
  }
  if (nearDedupThreshold !== undefined) {
    normalized.nearDedupThreshold = nearDedupThreshold;
  }
  if (gapRescueThreshold !== undefined) {
    normalized.gapRescueThreshold = gapRescueThreshold;
  }

  return normalized;
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pickBestConfigDoc(configDocs = [], inferredLob = '') {
  const normalizedLob = normalizeLob(inferredLob);
  const docs = Array.isArray(configDocs) ? configDocs : [];
  const filtered = docs.filter((doc) => {
    if (!normalizedLob) return true;
    const docLob = normalizeLob(doc?.inferredLob);
    if (!docLob) return true;
    return docLob === normalizedLob;
  });

  const pool = filtered.length > 0 ? filtered : docs;
  if (pool.length === 0) return null;

  const scored = pool.map((doc, index) => {
    const title = normalizeString(doc?.title).toLowerCase();
    const id = normalizeString(doc?.id).toLowerCase();
    let score = 0;

    if (title === LEGACY_RUNTIME_CONFIG_TITLE.toLowerCase()) score += 100;
    if (/first-principles-runtime-v\d+-geisinger-import\.json/.test(title)) score += 90;
    if (/first-principles-runtime-v\d+-geisinger-import/.test(id)) score += 80;
    if (looksLikeFirstPrinciplesRuntimeConfigDoc(doc)) score += 40;

    return { doc, index, score };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return scored[0]?.doc || null;
}

async function readJsonFileSafe(filePath) {
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

function resolvePrecedenceValue({ adminValue, fileValue, defaultValue, normalize = (value) => value }) {
  const normalizedAdminValue = normalize(adminValue);
  if (normalizedAdminValue !== undefined && normalizedAdminValue !== null && normalizedAdminValue !== '') {
    return { value: normalizedAdminValue, source: 'admin' };
  }

  const normalizedFileValue = normalize(fileValue);
  if (normalizedFileValue !== undefined && normalizedFileValue !== null && normalizedFileValue !== '') {
    return { value: normalizedFileValue, source: 'file' };
  }

  return { value: normalize(defaultValue), source: 'default' };
}

export function resolveEnvValueByRef(keyRef) {
  const normalizedRef = normalizeString(keyRef);
  if (!normalizedRef) return '';

  const envName = normalizeString(process.env.envName);
  const hostPrefix = envName
    ? `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.`
    : '';

  return normalizeString(
    process.env[normalizedRef]
    || (hostPrefix ? process.env[`${hostPrefix}${normalizedRef}`] : '')
  );
}

export async function resolveFirstPrinciplesRuntimeConfigV1({
  inferredLob = '',
  configDir = DEFAULT_CONFIG_DIR,
  geisingerConfigDocuments,
} = {}) {
  const configPath = path.join(configDir, DEFAULT_CONFIG_FILE);
  const fileConfig = await readJsonFileSafe(configPath);

  const hasInjectedDocs = Array.isArray(geisingerConfigDocuments);
  let docs = geisingerConfigDocuments;
  if (!hasInjectedDocs) {
    const selectGeisingerConfigContextDocuments = await getSelectGeisingerConfigContextDocuments();
    const fetched = (await selectGeisingerConfigContextDocuments(CONFIG_QUERY))?.data;
    docs = Array.isArray(fetched)
      ? fetched.filter((doc) => looksLikeFirstPrinciplesRuntimeConfigDoc(doc))
      : [];
  }
  const configDoc = pickBestConfigDoc(docs, inferredLob);
  const documentTextConfig = parseJsonObjectSafe(configDoc?.documentText) || {};

  const defaults = DEFAULT_FIRST_PRINCIPLES_RUNTIME_CONFIG_V1;
  const file = isObject(fileConfig) ? fileConfig : {};

  const prepEngine = resolvePrecedenceValue({
    adminValue: pickFirstNonBlankString(
      configDoc?.prepEngine,
      documentTextConfig?.engines?.prepEngine,
      documentTextConfig?.prepEngine
    ),
    fileValue: file?.engines?.prepEngine,
    defaultValue: defaults.engines.prepEngine,
    normalize: (value) => normalizeString(value),
  });

  const conversationEngine = resolvePrecedenceValue({
    adminValue: pickFirstNonBlankString(
      configDoc?.conversationEngine,
      documentTextConfig?.engines?.conversationEngine,
      documentTextConfig?.conversationEngine
    ),
    fileValue: file?.engines?.conversationEngine,
    defaultValue: defaults.engines.conversationEngine,
    normalize: (value) => normalizeString(value),
  });

  const comparisonEngine = resolvePrecedenceValue({
    adminValue: pickFirstNonBlankString(
      configDoc?.comparisonEngine,
      documentTextConfig?.engines?.comparisonEngine,
      documentTextConfig?.comparisonEngine
    ),
    fileValue: file?.engines?.comparisonEngine,
    defaultValue: defaults.engines.comparisonEngine,
    normalize: (value) => normalizeString(value),
  });

  const codeKeyRefs = getFirstPrinciplesKeyRefsFromCode();

  const chunkIndexName = resolvePrecedenceValue({
    adminValue: pickFirstNonBlankString(
      configDoc?.firstPrinciplesChunkIndexName,
      documentTextConfig?.firstPrinciples?.chunkIndexName,
      documentTextConfig?.firstPrinciplesChunkIndexName
    ),
    fileValue: file?.firstPrinciples?.chunkIndexName,
    defaultValue: defaults.firstPrinciples.chunkIndexName,
    normalize: (value) => normalizeString(value),
  });

  const requirementIndexName = resolvePrecedenceValue({
    adminValue: pickFirstNonBlankString(
      configDoc?.firstPrinciplesRequirementIndexName,
      documentTextConfig?.firstPrinciples?.requirementIndexName,
      documentTextConfig?.firstPrinciplesRequirementIndexName
    ),
    fileValue: file?.firstPrinciples?.requirementIndexName,
    defaultValue: defaults.firstPrinciples.requirementIndexName,
    normalize: (value) => normalizeString(value),
  });

  const adminFirstPrinciplesCompareFromJson = parseJsonObjectSafe(configDoc?.firstPrinciplesCompareJson);
  const adminFirstPrinciplesCompareFromObject = isObject(configDoc?.firstPrinciplesCompare)
    ? configDoc.firstPrinciplesCompare
    : undefined;
  const adminFirstPrinciplesCompareFromDocumentText = isObject(documentTextConfig?.firstPrinciplesCompare)
    ? documentTextConfig.firstPrinciplesCompare
    : undefined;
  const fileFirstPrinciplesCompare = isObject(file?.firstPrinciplesCompare)
    ? file.firstPrinciplesCompare
    : undefined;
  const defaultFirstPrinciplesCompare = isObject(defaults?.firstPrinciplesCompare)
    ? defaults.firstPrinciplesCompare
    : {};

  let firstPrinciplesCompare = defaultFirstPrinciplesCompare;
  let firstPrinciplesCompareSource = 'default';

  if (fileFirstPrinciplesCompare) {
    firstPrinciplesCompare = fileFirstPrinciplesCompare;
    firstPrinciplesCompareSource = 'file';
  }
  if (adminFirstPrinciplesCompareFromObject) {
    firstPrinciplesCompare = adminFirstPrinciplesCompareFromObject;
    firstPrinciplesCompareSource = 'admin-object';
  }
  if (adminFirstPrinciplesCompareFromDocumentText) {
    firstPrinciplesCompare = adminFirstPrinciplesCompareFromDocumentText;
    firstPrinciplesCompareSource = 'admin-document-text';
  }
  if (adminFirstPrinciplesCompareFromJson) {
    firstPrinciplesCompare = adminFirstPrinciplesCompareFromJson;
    firstPrinciplesCompareSource = 'admin-json';
  }

  let rolloutScope = defaults.rolloutScope;
  let rolloutScopeSource = 'default';
  if (isObject(file?.rolloutScope)) {
    rolloutScope = file.rolloutScope;
    rolloutScopeSource = 'file';
  }
  if (isObject(configDoc?.rolloutScope)) {
    rolloutScope = configDoc.rolloutScope;
    rolloutScopeSource = 'admin';
  }
  if (isObject(documentTextConfig?.rolloutScope)) {
    rolloutScope = documentTextConfig.rolloutScope;
    rolloutScopeSource = 'admin';
  }

  const normalizedRolloutScope = {
    teamAllowlist: normalizeStringArray(rolloutScope?.teamAllowlist),
    lobAllowlist: normalizeStringArray(rolloutScope?.lobAllowlist),
  };

  return {
    configDoc,
    config: {
      engines: {
        prepEngine: prepEngine.value,
        conversationEngine: conversationEngine.value,
        comparisonEngine: comparisonEngine.value,
      },
      firstPrinciples: {
        searchEndpointKeyRef: codeKeyRefs.searchEndpointKeyRef,
        searchQueryKeyRef: codeKeyRefs.searchQueryKeyRef,
        searchUploadKeyRef: codeKeyRefs.searchUploadKeyRef,
        chunkIndexName: chunkIndexName.value,
        requirementIndexName: requirementIndexName.value,
      },
      firstPrinciplesCompare: normalizeFirstPrinciplesCompare(firstPrinciplesCompare),
      rolloutScope: normalizedRolloutScope,
    },
    sources: {
      prepEngine: prepEngine.source,
      conversationEngine: conversationEngine.source,
      comparisonEngine: comparisonEngine.source,
      firstPrinciplesSearchEndpointKeyRef: codeKeyRefs.source,
      firstPrinciplesSearchQueryKeyRef: codeKeyRefs.source,
      firstPrinciplesSearchUploadKeyRef: codeKeyRefs.source,
      firstPrinciplesChunkIndexName: chunkIndexName.source,
      firstPrinciplesRequirementIndexName: requirementIndexName.source,
      firstPrinciplesCompare: firstPrinciplesCompareSource,
      rolloutScope: rolloutScopeSource,
    },
    metadata: {
      fileConfigLoaded: !!fileConfig,
      configPath,
      configDocId: normalizeString(configDoc?.id) || null,
      inferredLob: normalizeLob(inferredLob) || null,
      injectedConfigDocs: hasInjectedDocs,
    },
  };
}
