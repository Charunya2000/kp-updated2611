'use server';

import { insertDocument } from '@/db/insertDocument';
import { updateDocument } from '@/db/updateDocument';
import { deleteDocument } from '@/db/deleteDocument';
import { selectDocument, selectDocumentsExt } from '@/db/selectDocument';

const PREP_ENGINES = new Set(['legacy', 'first-principles']);
const RUNTIME_ENGINES = new Set(['service3', 'first-principles']);

function validateStringArray(values, fieldName, errors) {
  if (values === undefined) {
    return;
  }
  if (!Array.isArray(values)) {
    errors.push(`${fieldName} must be an array of strings when provided`);
    return;
  }
  if (values.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    errors.push(`${fieldName} must only contain non-empty strings`);
  }
}

function validateNumericRange(value, fieldName, min, max, errors) {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    errors.push(`${fieldName} must be a number when provided`);
    return;
  }
  if (value < min || value > max) {
    errors.push(`${fieldName} must be between ${min} and ${max}`);
  }
}

function parseFirstPrinciplesCompareJson(firstPrinciplesCompareJson, errors) {
  if (firstPrinciplesCompareJson === undefined || firstPrinciplesCompareJson === null) {
    return undefined;
  }

  if (typeof firstPrinciplesCompareJson !== 'string') {
    errors.push('firstPrinciplesCompareJson must be a JSON string when provided');
    return undefined;
  }

  const raw = firstPrinciplesCompareJson.trim();
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push('firstPrinciplesCompareJson must deserialize to an object');
      return undefined;
    }
    return parsed;
  } catch (error) {
    errors.push(`firstPrinciplesCompareJson contains invalid JSON: ${error?.message || String(error)}`);
    return undefined;
  }
}

const geisingerConfigQueryValidation = (geisingerConfig) => {
  const { type } = geisingerConfig;
  if (!type) {
    throw new Error('Invalid GeisingerConfig object');
  }
  return true;
};

const geisingerConfigQueryByIdValidation = (geisingerConfig) => {
  const { type, id } = geisingerConfig;
  if (!type || !id) {
    throw new Error('Invalid GeisingerConfig query');
  }
  return true;
};

const geisingerConfigValidation = (geisingerConfig) => {
  const {
    id,
    type,
    title,
    documentText,
    inferredLob,
    purpose,
    prepEngine,
    conversationEngine,
    comparisonEngine,
    rolloutScope,
    firstPrinciplesCompare,
    firstPrinciplesCompareJson,
  } = geisingerConfig;

  if (!id || !type || !title || !documentText || !inferredLob || !purpose) {
    throw new Error('Invalid GeisingerConfig object');
  }

  const errors = [];

  if (prepEngine !== undefined && !PREP_ENGINES.has(prepEngine)) {
    errors.push("prepEngine must be one of: 'legacy', 'first-principles'");
  }
  if (conversationEngine !== undefined && !RUNTIME_ENGINES.has(conversationEngine)) {
    errors.push("conversationEngine must be one of: 'service3', 'first-principles'");
  }
  if (comparisonEngine !== undefined && !RUNTIME_ENGINES.has(comparisonEngine)) {
    errors.push("comparisonEngine must be one of: 'service3', 'first-principles'");
  }

  if (rolloutScope !== undefined) {
    if (!rolloutScope || typeof rolloutScope !== 'object' || Array.isArray(rolloutScope)) {
      errors.push('rolloutScope must be an object when provided');
    } else {
      validateStringArray(rolloutScope.teamAllowlist, 'rolloutScope.teamAllowlist', errors);
      validateStringArray(rolloutScope.lobAllowlist, 'rolloutScope.lobAllowlist', errors);
    }
  }

  const parsedFirstPrinciplesCompareJson = parseFirstPrinciplesCompareJson(firstPrinciplesCompareJson, errors);
  const effectiveFirstPrinciplesCompare = parsedFirstPrinciplesCompareJson ?? firstPrinciplesCompare;

  if (effectiveFirstPrinciplesCompare !== undefined) {
    if (!effectiveFirstPrinciplesCompare || typeof effectiveFirstPrinciplesCompare !== 'object' || Array.isArray(effectiveFirstPrinciplesCompare)) {
      errors.push('firstPrinciplesCompare must be an object when provided');
    } else {
      validateNumericRange(effectiveFirstPrinciplesCompare.sampleSize, 'firstPrinciplesCompare.sampleSize', 1, 100000, errors);
      validateNumericRange(effectiveFirstPrinciplesCompare.nearDedupThreshold, 'firstPrinciplesCompare.nearDedupThreshold', 0, 1, errors);
      validateNumericRange(effectiveFirstPrinciplesCompare.gapRescueThreshold, 'firstPrinciplesCompare.gapRescueThreshold', 0, 1, errors);

      if (
        effectiveFirstPrinciplesCompare.enableNearDedup !== undefined
        && typeof effectiveFirstPrinciplesCompare.enableNearDedup !== 'boolean'
      ) {
        errors.push('firstPrinciplesCompare.enableNearDedup must be a boolean when provided');
      }
      if (
        effectiveFirstPrinciplesCompare.enableGapRescue !== undefined
        && typeof effectiveFirstPrinciplesCompare.enableGapRescue !== 'boolean'
      ) {
        errors.push('firstPrinciplesCompare.enableGapRescue must be a boolean when provided');
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid GeisingerConfig object: ${errors.join('; ')}`);
  }

  return true;
};

export async function insertGeisingerConfigContextDocument(geisingerConfig) {
  const insertedGeisingerConfig = await insertDocument(geisingerConfig, geisingerConfigValidation);
  return { success: true, id: insertedGeisingerConfig.id };
}

export async function updateGeisingerConfigContextDocumentById(id, geisingerConfig) {
  geisingerConfig.id = id;
  const configQuery = { id: id, type: 'GeisingerConfig' };
  await updateDocument(geisingerConfig, configQuery, geisingerConfigValidation);
  return { success: true, id: geisingerConfig.id };
}

export async function deleteGeisingerConfigContextDocumentById(geisingerConfigId) {
  const geisingerConfig = { id: geisingerConfigId, type: 'GeisingerConfig' };
  const deletionSuccess = await deleteDocument(geisingerConfig, geisingerConfigQueryByIdValidation);
  return { success: deletionSuccess };
}

export async function selectGeisingerConfigContextDocuments(geisingerConfig) {
  const selectedGeisingerConfigs = await selectDocumentsExt(geisingerConfig, geisingerConfigQueryValidation, {});
  return { success: true, data: selectedGeisingerConfigs };
}

export async function selectGeisingerConfigContextDocumentById(id) {
  const selectedGeisingerConfig = await selectDocument({ id }, geisingerConfigValidation);
  return { success: true, data: selectedGeisingerConfig };
}
