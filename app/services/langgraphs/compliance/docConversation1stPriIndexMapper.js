import { createHash } from 'crypto';

// Deterministic ID contracts are frozen for idempotent re-indexing.
const CHUNK_ID_KEY_FIELDS = Object.freeze([
  'conversationId',
  'sectionNumber',
  'startIndex',
  'endIndex',
  'heading',
]);

const REQUIREMENT_ID_KEY_FIELDS = Object.freeze([
  'conversationId',
  'requirementKey',
  'requirementText',
  'citationStartIndex',
  'citationEndIndex',
]);

const REQUIRED_CHUNK_FIELDS = Object.freeze([
  'id',
  'conversation_id',
  'doc_id',
  'file_name',
  'artifact_type',
  'heading',
  'content',
  'created_at',
  'updated_at',
]);

const OPTIONAL_CHUNK_FIELDS = Object.freeze([
  'lob',
  'prep_version',
  'section_number',
  'content_vector',
  'page_start',
  'page_end',
  'char_start',
  'char_end',
  'parent_chunk_id',
  'level',
  'effective_date',
  'jurisdiction',
]);

const REQUIRED_REQUIREMENT_FIELDS = Object.freeze([
  'id',
  'requirement_key',
  'conversation_id',
  'doc_id',
  'file_name',
  'artifact_type',
  'requirement_text',
  'category',
  'created_at',
  'updated_at',
]);

// actor/action/object/deadline/exception/modality are intentionally optional at this stage.
const OPTIONAL_REQUIREMENT_FIELDS = Object.freeze([
  'lob',
  'prep_version',
  'requirement_vector',
  'normalized_actor',
  'normalized_action',
  'normalized_object',
  'condition_text',
  'deadline_value',
  'deadline_unit',
  'exception_text',
  'modality',
  'obligation_strength',
  'section_number',
  'heading',
  'page_start',
  'page_end',
  'char_start',
  'char_end',
  'source_chunk_id',
]);

function normalizeString(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeNullableString(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeInt(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function normalizeNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDateTime(value, fallbackIso) {
  if (!value && fallbackIso) return fallbackIso;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallbackIso || new Date().toISOString();
  return date.toISOString();
}

function normalizeVector(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function buildDeterministicId(prefix, parts = []) {
  const normalizedParts = (Array.isArray(parts) ? parts : [])
    .map((part) => normalizeString(part))
    .join('::');
  const digest = createHash('sha256').update(`${prefix}::${normalizedParts}`).digest('hex');
  return `${prefix}-${digest.slice(0, 32)}`;
}

function getVectorByArtifactId(vectorsByArtifactId, artifactId) {
  if (!vectorsByArtifactId || !artifactId) return [];
  if (vectorsByArtifactId instanceof Map) {
    return normalizeVector(vectorsByArtifactId.get(artifactId));
  }
  return normalizeVector(vectorsByArtifactId[artifactId]);
}

function toChunkSearchDoc(chunk, options = {}) {
  const nowIso = new Date().toISOString();
  const conversationId = normalizeString(options.conversationId || chunk?.conversationId);
  const docId = normalizeString(options.docId, conversationId);
  const prepVersion = normalizeString(options.prepVersion, '1');
  const artifactId = normalizeString(chunk?.id);

  const generatedId = buildDeterministicId('chunk', [
    conversationId,
    normalizeString(chunk?.sectionNumber),
    normalizeInt(chunk?.startIndex, -1),
    normalizeInt(chunk?.endIndex, -1),
    normalizeString(chunk?.heading),
  ]);

  const contentVector = getVectorByArtifactId(options.chunkVectorsByArtifactId, artifactId);

  return {
    id: artifactId || generatedId,
    conversation_id: conversationId,
    doc_id: docId,
    file_name: normalizeString(options.fileName || chunk?.fileName),
    lob: normalizeString(options.lob),
    prep_version: prepVersion,
    artifact_type: 'chunk',
    heading: normalizeString(chunk?.heading, 'Untitled Section'),
    section_number: normalizeString(chunk?.sectionNumber),
    content: normalizeString(chunk?.content),
    content_vector: contentVector,
    page_start: normalizeInt(chunk?.page),
    page_end: normalizeInt(chunk?.page),
    char_start: normalizeInt(chunk?.startIndex),
    char_end: normalizeInt(chunk?.endIndex),
    parent_chunk_id: normalizeNullableString(chunk?.parentId),
    level: normalizeInt(chunk?.level, 0),
    effective_date: normalizeDateTime(options.effectiveDate, null),
    jurisdiction: normalizeString(options.jurisdiction),
    created_at: normalizeDateTime(options.createdAt, nowIso),
    updated_at: normalizeDateTime(options.updatedAt, nowIso),
  };
}

function toRequirementSearchDoc(requirement, options = {}) {
  const nowIso = new Date().toISOString();
  const citation = requirement?.citation || {};
  const conversationId = normalizeString(options.conversationId || requirement?.conversationId);
  const docId = normalizeString(options.docId, conversationId);
  const prepVersion = normalizeString(options.prepVersion, '1');
  const artifactId = normalizeString(requirement?.id);

  const generatedId = buildDeterministicId('req', [
    conversationId,
    normalizeString(requirement?.requirementKey),
    normalizeString(requirement?.text),
    normalizeInt(citation?.startIndex, -1),
    normalizeInt(citation?.endIndex, -1),
  ]);

  const requirementVector = getVectorByArtifactId(options.requirementVectorsByArtifactId, artifactId);

  return {
    id: artifactId || generatedId,
    requirement_key: normalizeString(requirement?.requirementKey) || generatedId,
    conversation_id: conversationId,
    doc_id: docId,
    file_name: normalizeString(options.fileName || citation?.fileName),
    lob: normalizeString(options.lob),
    prep_version: prepVersion,
    artifact_type: 'requirement',
    requirement_text: normalizeString(requirement?.text),
    requirement_vector: requirementVector,
    normalized_actor: normalizeString(requirement?.actor),
    normalized_action: normalizeString(requirement?.action),
    normalized_object: normalizeString(requirement?.object),
    condition_text: normalizeString(requirement?.condition),
    deadline_value: normalizeInt(options.deadlineValue ?? requirement?.deadlineValue),
    deadline_unit: normalizeString(options.deadlineUnit || requirement?.deadlineUnit || requirement?.deadline),
    exception_text: normalizeString(requirement?.exception),
    modality: normalizeString(requirement?.modality),
    obligation_strength: normalizeNumber(requirement?.obligationStrength),
    category: normalizeString(requirement?.category, 'general-obligation'),
    section_number: normalizeString(requirement?.sectionNumber),
    heading: normalizeString(requirement?.heading),
    page_start: normalizeInt(citation?.page),
    page_end: normalizeInt(citation?.page),
    char_start: normalizeInt(citation?.startIndex),
    char_end: normalizeInt(citation?.endIndex),
    source_chunk_id: normalizeString(citation?.chunkId),
    created_at: normalizeDateTime(options.createdAt, nowIso),
    updated_at: normalizeDateTime(options.updatedAt, nowIso),
  };
}

function validateRequiredFields(document, fields = []) {
  const missing = [];
  for (const field of fields) {
    const value = document[field];
    if (value === null || value === undefined || value === '') {
      missing.push(field);
    }
  }
  return {
    valid: missing.length === 0,
    missing,
  };
}

export function validateChunkSearchDoc(document = {}) {
  return validateRequiredFields(document, REQUIRED_CHUNK_FIELDS);
}

export function validateRequirementSearchDoc(document = {}) {
  return validateRequiredFields(document, REQUIRED_REQUIREMENT_FIELDS);
}

export function getFirstPrinciplesMapperContracts() {
  return {
    deterministicIdKeys: {
      chunk: [...CHUNK_ID_KEY_FIELDS],
      requirement: [...REQUIREMENT_ID_KEY_FIELDS],
    },
    requiredFields: {
      chunk: [...REQUIRED_CHUNK_FIELDS],
      requirement: [...REQUIRED_REQUIREMENT_FIELDS],
    },
    optionalFields: {
      chunk: [...OPTIONAL_CHUNK_FIELDS],
      requirement: [...OPTIONAL_REQUIREMENT_FIELDS],
    },
  };
}

export function mapChunkArtifactsToSearchDocuments(chunkArtifacts = [], options = {}) {
  return (Array.isArray(chunkArtifacts) ? chunkArtifacts : []).map((chunk) => toChunkSearchDoc(chunk, options));
}

export function mapRequirementArtifactsToSearchDocuments(requirementArtifacts = [], options = {}) {
  return (Array.isArray(requirementArtifacts) ? requirementArtifacts : []).map((requirement) => toRequirementSearchDoc(requirement, options));
}

export function serializeFirstPrinciplesArtifactsForSearch({
  chunkArtifacts = [],
  requirementArtifacts = [],
  options = {},
} = {}) {
  const chunkDocuments = mapChunkArtifactsToSearchDocuments(chunkArtifacts, options);
  const requirementDocuments = mapRequirementArtifactsToSearchDocuments(requirementArtifacts, options);

  const invalidChunkDocs = chunkDocuments
    .map((doc) => ({ doc, check: validateChunkSearchDoc(doc) }))
    .filter((item) => !item.check.valid)
    .map((item) => ({ id: item.doc.id, missing: item.check.missing }));

  const invalidRequirementDocs = requirementDocuments
    .map((doc) => ({ doc, check: validateRequirementSearchDoc(doc) }))
    .filter((item) => !item.check.valid)
    .map((item) => ({ id: item.doc.id, missing: item.check.missing }));

  return {
    chunkDocuments,
    requirementDocuments,
    validation: {
      chunkValid: invalidChunkDocs.length === 0,
      requirementValid: invalidRequirementDocs.length === 0,
      invalidChunkDocs,
      invalidRequirementDocs,
    },
  };
}
