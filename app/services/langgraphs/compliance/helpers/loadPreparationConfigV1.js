import { readFile } from 'fs/promises';
import path from 'path';

const DEFAULT_CONFIG_DIR = path.resolve(process.cwd(), 'app/services/langgraphs/compliance/config');

const DEFAULT_PREPARATION_CONFIG_V1 = {
  runtime: {
    job: {
      jobType: 'GeisingerDocumentPreparation',
      maxConcurrency: 10,
      defaultConcurrency: 1,
    },
    discovery: {
      defaultRootFolder: 'Shared Documents/Regulatory and Contractual Documents',
      preparableExtensions: ['pdf', 'docx'],
      requireSingleLobWhenFileNameFilterPresent: true,
    },
    collections: {
      conversationCollectionName: 'user_collection',
    },
    preparationVersion: {
      envVar: 'GEISINGER_PREPARATION_VERSION',
      defaultValue: '1',
    },
    sharePoint: {
      domainToggleEnvVar: 'USE_VAULT',
      vaultDomain: 'geisinger.sharepoint.com',
      legacyDomain: 'sp-cloud.kp.org',
    },
  },
  ui: {
    defaults: {
      concurrency: 1,
      discoveryRootFolder: 'Shared Documents/Regulatory and Contractual Documents',
      pollingIntervalMs: 3000,
    },
    limits: {
      concurrencyInputMin: 1,
      concurrencyInputMax: 10,
    },
    inventorySample: {
      lob: 'CHIP',
      preparationVersion: '1',
      status: 'Not Prepared',
      siteName: 'your-site-name',
      fileAName: 'example.pdf',
      relativeAUrl: '/Shared Documents/CHIP/example.pdf',
    },
  },
};

const FILES = {
  runtime: 'preparation-runtime-v1.json',
  ui: 'preparation-ui-v1.json',
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
  const normalized = value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeLookupKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.(json|md)$/g, '')
    .replace(/[^a-z0-9]+/g, '');
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

function normalizeConfig(rawConfig) {
  const merged = deepMerge(DEFAULT_PREPARATION_CONFIG_V1, rawConfig || {});
  const normalized = JSON.parse(JSON.stringify(DEFAULT_PREPARATION_CONFIG_V1));

  normalized.runtime.job.jobType = parseString(merged?.runtime?.job?.jobType, normalized.runtime.job.jobType);
  normalized.runtime.job.maxConcurrency = parseNumber(merged?.runtime?.job?.maxConcurrency, normalized.runtime.job.maxConcurrency, { min: 1, integer: true });
  normalized.runtime.job.defaultConcurrency = parseNumber(merged?.runtime?.job?.defaultConcurrency, normalized.runtime.job.defaultConcurrency, { min: 1, integer: true });

  normalized.runtime.discovery.defaultRootFolder = parseString(merged?.runtime?.discovery?.defaultRootFolder, normalized.runtime.discovery.defaultRootFolder);
  normalized.runtime.discovery.preparableExtensions = parseStringArray(merged?.runtime?.discovery?.preparableExtensions, normalized.runtime.discovery.preparableExtensions);
  normalized.runtime.discovery.requireSingleLobWhenFileNameFilterPresent = !!merged?.runtime?.discovery?.requireSingleLobWhenFileNameFilterPresent;

  normalized.runtime.collections.conversationCollectionName = parseString(merged?.runtime?.collections?.conversationCollectionName, normalized.runtime.collections.conversationCollectionName);
  normalized.runtime.preparationVersion.envVar = parseString(merged?.runtime?.preparationVersion?.envVar, normalized.runtime.preparationVersion.envVar);
  normalized.runtime.preparationVersion.defaultValue = parseString(merged?.runtime?.preparationVersion?.defaultValue, normalized.runtime.preparationVersion.defaultValue);

  normalized.runtime.sharePoint.domainToggleEnvVar = parseString(merged?.runtime?.sharePoint?.domainToggleEnvVar, normalized.runtime.sharePoint.domainToggleEnvVar);
  normalized.runtime.sharePoint.vaultDomain = parseString(merged?.runtime?.sharePoint?.vaultDomain, normalized.runtime.sharePoint.vaultDomain);
  normalized.runtime.sharePoint.legacyDomain = parseString(merged?.runtime?.sharePoint?.legacyDomain, normalized.runtime.sharePoint.legacyDomain);

  normalized.ui.defaults.concurrency = parseNumber(merged?.ui?.defaults?.concurrency, normalized.ui.defaults.concurrency, { min: 1, integer: true });
  normalized.ui.defaults.discoveryRootFolder = parseString(merged?.ui?.defaults?.discoveryRootFolder, normalized.ui.defaults.discoveryRootFolder);
  normalized.ui.defaults.pollingIntervalMs = parseNumber(merged?.ui?.defaults?.pollingIntervalMs, normalized.ui.defaults.pollingIntervalMs, { min: 250, integer: true });

  normalized.ui.limits.concurrencyInputMin = parseNumber(merged?.ui?.limits?.concurrencyInputMin, normalized.ui.limits.concurrencyInputMin, { min: 1, integer: true });
  normalized.ui.limits.concurrencyInputMax = parseNumber(merged?.ui?.limits?.concurrencyInputMax, normalized.ui.limits.concurrencyInputMax, { min: normalized.ui.limits.concurrencyInputMin, integer: true });

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

function detectFragmentKeyFromDocument(doc = {}) {
  const titleKey = normalizeLookupKey(doc?.title || '');
  const purposeKey = normalizeLookupKey(doc?.purpose || '');

  const aliasMap = {
    preparationruntimev1: 'runtime',
    preparationruntime: 'runtime',
    preparationuiv1: 'ui',
    preparationui: 'ui',
  };

  if (aliasMap[titleKey]) return aliasMap[titleKey];
  if (aliasMap[purposeKey]) return aliasMap[purposeKey];
  return null;
}

export function parseGeisingerPreparationConfigDocuments(documents = []) {
  const overlayParts = {};
  const applied = [];
  const parseErrors = [];

  for (const doc of Array.isArray(documents) ? documents : []) {
    const rawText = String(doc?.documentText || '').trim();
    if (!rawText) continue;

    try {
      const fragmentKey = detectFragmentKeyFromDocument(doc);
      if (!fragmentKey || !FILES[fragmentKey]) continue;

      const parsed = parseJsonConfigText(rawText);
      if (!isObject(parsed)) continue;

      overlayParts[fragmentKey] = deepMerge(overlayParts[fragmentKey] || {}, parsed);
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

export async function loadPreparationConfigV1(options = {}) {
  const baseDir = options.baseDir ? path.resolve(String(options.baseDir)) : DEFAULT_CONFIG_DIR;
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

  const geisingerOverlay = parseGeisingerPreparationConfigDocuments(geisingerConfigDocuments);
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

export { DEFAULT_PREPARATION_CONFIG_V1 };
