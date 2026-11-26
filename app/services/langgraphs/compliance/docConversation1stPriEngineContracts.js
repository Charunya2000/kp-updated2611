const FIRST_PRI_ENGINE_CONTRACT_VERSION = 'v1';

export const FIRST_PRI_QUERY_INPUT_CONTRACT = {
  version: FIRST_PRI_ENGINE_CONTRACT_VERSION,
  required: ['conversationId', 'queryText'],
  optional: ['top', 'filter', 'includeVectors'],
  notes: 'Conversation-level retrieval input. Comparison uses this shape per side with conversationId scoped to each side.',
};

export const FIRST_PRI_FUSED_EVIDENCE_CONTRACT = {
  version: FIRST_PRI_ENGINE_CONTRACT_VERSION,
  required: ['id', 'resultType', 'fusedScore', 'document'],
  documentRequired: ['id', 'conversation_id', 'file_name'],
  documentOptional: [
    'requirement_key',
    'requirement_text',
    'content',
    'section_number',
    'heading',
    'page_start',
    'page_end',
    'char_start',
    'char_end',
    'source_chunk_id',
    'modality',
    'category',
    'normalized_actor',
    'normalized_action',
    'normalized_object',
  ],
};

export const FIRST_PRI_CITATION_PAYLOAD_CONTRACT = {
  version: FIRST_PRI_ENGINE_CONTRACT_VERSION,
  required: ['id', 'citation', 'file_name'],
  optional: ['page_start', 'section_number'],
};

export const FIRST_PRI_CONVERSATION_RESPONSE_CONTRACT = {
  version: FIRST_PRI_ENGINE_CONTRACT_VERSION,
  required: ['conversationId', 'queryText', 'answerText', 'citations', 'metrics', 'indexUsage'],
  optional: ['evidence', 'summaryMode', 'modelInfo', 'contractVersion'],
};

export const FIRST_PRI_COMPARISON_RESPONSE_CONTRACT = {
  version: FIRST_PRI_ENGINE_CONTRACT_VERSION,
  required: [
    'leftConversationId',
    'rightConversationId',
    'queryText',
    'comparisonSummary',
    'summary',
    'matches',
    'partials',
    'conflicts',
    'gaps',
  ],
  optional: ['summaryMode', 'modelInfo', 'contractVersion', 'comparisonMode'],
  classifications: ['match', 'partial', 'conflict', 'gap'],
};

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasOwn(obj = {}, key = '') {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function validateRequiredFields(payload = {}, requiredFields = []) {
  const missing = [];
  for (const key of Array.isArray(requiredFields) ? requiredFields : []) {
    if (!hasOwn(payload, key) || payload[key] === undefined || payload[key] === null) {
      missing.push(key);
    }
  }
  return missing;
}

function normalizeCitation(citation = {}) {
  return {
    id: normalizeString(citation?.id),
    citation: normalizeString(citation?.citation),
    file_name: normalizeString(citation?.file_name),
    page_start: Number.isFinite(Number(citation?.page_start)) ? Number(citation.page_start) : null,
    section_number: normalizeString(citation?.section_number),
  };
}

function validateCitationPayloadList(citations = []) {
  const required = FIRST_PRI_CITATION_PAYLOAD_CONTRACT.required || [];
  return ensureArray(citations).map((citation) => {
    const normalized = normalizeCitation(citation);
    const missing = validateRequiredFields(normalized, required);
    return {
      valid: missing.length === 0,
      missing,
      value: normalized,
    };
  });
}

export function normalizeFirstPrinciplesQueryInput(input = {}, defaults = {}) {
  return {
    conversationId: normalizeString(input?.conversationId, normalizeString(defaults?.conversationId)),
    queryText: normalizeString(input?.queryText, normalizeString(defaults?.queryText, '*')),
    top: normalizePositiveInt(input?.top, normalizePositiveInt(defaults?.top, 20)),
    filter: normalizeString(input?.filter),
    includeVectors: Boolean(input?.includeVectors || defaults?.includeVectors || false),
  };
}

export function getFirstPrinciplesEngineContracts() {
  return {
    version: FIRST_PRI_ENGINE_CONTRACT_VERSION,
    queryInput: FIRST_PRI_QUERY_INPUT_CONTRACT,
    fusedEvidence: FIRST_PRI_FUSED_EVIDENCE_CONTRACT,
    citationPayload: FIRST_PRI_CITATION_PAYLOAD_CONTRACT,
    conversationResponse: FIRST_PRI_CONVERSATION_RESPONSE_CONTRACT,
    comparisonResponse: FIRST_PRI_COMPARISON_RESPONSE_CONTRACT,
  };
}

export function buildFirstPrinciplesConversationResponsePayload(input = {}) {
  const payload = {
    contractVersion: FIRST_PRI_ENGINE_CONTRACT_VERSION,
    conversationId: normalizeString(input?.conversationId),
    queryText: normalizeString(input?.queryText),
    answerText: normalizeString(input?.answerText),
    citations: validateCitationPayloadList(input?.citations)
      .filter((entry) => entry.valid)
      .map((entry) => entry.value),
    evidence: ensureArray(input?.evidence),
    metrics: input?.metrics || {},
    indexUsage: input?.indexUsage || {},
    summaryMode: normalizeString(input?.summaryMode),
    modelInfo: input?.modelInfo || null,
  };

  const missing = validateRequiredFields(payload, FIRST_PRI_CONVERSATION_RESPONSE_CONTRACT.required || []);
  if (missing.length > 0) {
    throw new Error(`First-principles conversation response missing required fields: ${missing.join(', ')}`);
  }

  return payload;
}

export function buildFirstPrinciplesComparisonResponsePayload(input = {}) {
  const payload = {
    contractVersion: FIRST_PRI_ENGINE_CONTRACT_VERSION,
    leftConversationId: normalizeString(input?.leftConversationId),
    rightConversationId: normalizeString(input?.rightConversationId),
    queryText: normalizeString(input?.queryText),
    comparisonSummary: normalizeString(input?.comparisonSummary),
    summary: input?.summary || {},
    matches: ensureArray(input?.matches),
    partials: ensureArray(input?.partials),
    conflicts: ensureArray(input?.conflicts),
    gaps: {
      left: ensureArray(input?.gaps?.left),
      right: ensureArray(input?.gaps?.right),
    },
    comparisonMode: normalizeString(input?.comparisonMode),
    summaryMode: normalizeString(input?.summaryMode),
    modelInfo: input?.modelInfo || null,
  };

  const missing = validateRequiredFields(payload, FIRST_PRI_COMPARISON_RESPONSE_CONTRACT.required || []);
  if (missing.length > 0) {
    throw new Error(`First-principles comparison response missing required fields: ${missing.join(', ')}`);
  }

  return payload;
}
