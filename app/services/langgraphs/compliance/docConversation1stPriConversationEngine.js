import {
  retrieveChunkArtifacts,
  retrieveRequirementArtifacts,
  fuseHybridRetrievalResults,
  reconstructCitationsFromResults,
} from './docConversation1stPriRetrievalService.js';
import {
  buildFirstPrinciplesConversationResponsePayload,
  getFirstPrinciplesEngineContracts,
  normalizeFirstPrinciplesQueryInput,
} from './docConversation1stPriEngineContracts.js';

const DEFAULT_MAX_REQUIREMENTS = 12;
const DEFAULT_MAX_CHUNKS = 8;
const DEFAULT_MAX_EVIDENCE = 10;
const DEFAULT_MAX_CONTEXT_CHARS = 5000;

function logEngineEvent(name, detail = {}) {
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

function buildTraceId(value, fallback) {
  const normalized = normalizeString(value);
  return normalized || fallback;
}

function collectBounded(values = [], maxItems = 50) {
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

function summarizeFusedEvidence(results = [], maxItems = 50) {
  const docs = (Array.isArray(results) ? results : []).map((item) => item?.document || {});
  return {
    fusedEvidenceIds: collectBounded(docs.map((doc) => doc?.id), maxItems),
    fusedEvidenceFileNames: collectBounded(docs.map((doc) => doc?.file_name), maxItems),
    fusedEvidenceSections: collectBounded(docs.map((doc) => doc?.section_number), maxItems),
    fusedEvidenceRequirementKeys: collectBounded(docs.map((doc) => doc?.requirement_key), maxItems),
  };
}

function buildEvidenceText(result = {}) {
  const doc = result?.document || {};
  const requirementText = normalizeString(doc?.requirement_text);
  const contentText = normalizeString(doc?.content);
  return requirementText || contentText;
}

function buildGroundedContext(results = [], maxContextChars = DEFAULT_MAX_CONTEXT_CHARS) {
  const lines = [];
  let used = 0;

  for (const result of Array.isArray(results) ? results : []) {
    const doc = result?.document || {};
    const text = buildEvidenceText(result);
    if (!text) continue;

    const prefix = [
      normalizeString(doc?.file_name, 'Unknown File'),
      normalizeString(doc?.section_number),
      normalizeString(doc?.heading),
    ].filter(Boolean).join(' | ');

    const line = `${prefix}: ${text}`;
    if (used + line.length > maxContextChars && lines.length > 0) break;

    lines.push(line);
    used += line.length;
  }

  return lines.join('\n');
}

async function generateAnswerFromEvidence({
  userPrompt,
  evidence = [],
  citations = [],
  options = {},
} = {}, deps = {}) {
  const fallbackAnswer = (() => {
    if (!Array.isArray(evidence) || evidence.length === 0) {
      return 'I could not find enough first-principles evidence for this question.';
    }

    const top = evidence.slice(0, 3).map((item, idx) => {
      const doc = item?.document || {};
      const text = buildEvidenceText(item);
      const section = normalizeString(doc?.section_number);
      return `${idx + 1}. ${section ? `Section ${section}: ` : ''}${text}`;
    }).join('\n');

    const citationText = citations
      .slice(0, 3)
      .map((c) => c?.citation)
      .filter(Boolean)
      .join(' ');

    return `${top}${citationText ? `\n\nCitations: ${citationText}` : ''}`;
  })();

  if (typeof deps?.generateAnswer !== 'function') {
    return {
      answerText: fallbackAnswer,
      generationMode: 'fallback',
    };
  }

  const context = buildGroundedContext(evidence, normalizePositiveInt(options?.maxContextChars, DEFAULT_MAX_CONTEXT_CHARS));

  const systemPrompt = normalizeString(options?.systemPrompt, [
    'You answer compliance questions using only provided evidence.',
    'If evidence is insufficient, explicitly say so.',
    'Keep answers concise and include supporting citations when possible.',
  ].join(' '));

  const userContent = [
    `Question: ${normalizeString(userPrompt)}`,
    'Evidence:',
    context || '(no evidence)',
    'Return a grounded answer.',
  ].join('\n\n');

  let generated = null;
  try {
    generated = await deps.generateAnswer({
      systemPrompt,
      userPrompt: userContent,
      originalQuestion: normalizeString(userPrompt),
      citations,
      evidence,
    });
  } catch (error) {
    return {
      answerText: fallbackAnswer,
      generationMode: 'fallback',
      modelInfo: {
        error: error?.message || String(error),
      },
    };
  }

  const answerText = normalizeString(generated?.answerText || generated?.text || '', fallbackAnswer);

  return {
    answerText,
    generationMode: 'model',
    modelInfo: generated?.modelInfo || null,
  };
}

function buildEngineOptions(options = {}) {
  return {
    maxRequirements: normalizePositiveInt(options?.maxRequirements, DEFAULT_MAX_REQUIREMENTS),
    maxChunks: normalizePositiveInt(options?.maxChunks, DEFAULT_MAX_CHUNKS),
    maxEvidence: normalizePositiveInt(options?.maxEvidence, DEFAULT_MAX_EVIDENCE),
    maxContextChars: normalizePositiveInt(options?.maxContextChars, DEFAULT_MAX_CONTEXT_CHARS),
    retrieval: {
      rrfK: normalizePositiveInt(options?.rrfK, 60),
      requirementWeight: Number.isFinite(Number(options?.requirementWeight)) ? Number(options.requirementWeight) : 1.2,
      chunkWeight: Number.isFinite(Number(options?.chunkWeight)) ? Number(options.chunkWeight) : 1.0,
    },
    chunkIndexName: normalizeString(options?.chunkIndexName),
    requirementIndexName: normalizeString(options?.requirementIndexName),
    systemPrompt: normalizeString(options?.systemPrompt),
    traceId: normalizeString(options?.traceId),
    maxLoggedResultIds: normalizePositiveInt(options?.maxLoggedResultIds, 50),
  };
}

/**
 * Non-integrated first-principles conversation engine.
 *
 * This implementation intentionally reads only from first-principles indexes
 * (`compliance-chunks-v1` and `compliance-requirements-v1` by default) via
 * the retrieval service. Runtime routing/integration is intentionally out of scope.
 */
export async function answerWithFirstPrinciplesConversationEngine({
  conversationId = '',
  userPrompt = '',
  options = {},
} = {}, deps = {}) {
  const startedAt = Date.now();
  const logger = typeof deps?.logEvent === 'function' ? deps.logEvent : logEngineEvent;

  const normalizedConversationId = normalizeString(conversationId);
  const normalizedPrompt = normalizeString(userPrompt);
  const engineOptions = buildEngineOptions(options);
  const traceId = buildTraceId(engineOptions.traceId, `first-pri-conv-${normalizedConversationId || 'unknown'}-${Date.now()}`);
  const contracts = getFirstPrinciplesEngineContracts();

  const queryInput = normalizeFirstPrinciplesQueryInput({
    conversationId: normalizedConversationId,
    queryText: normalizedPrompt,
    top: engineOptions.maxRequirements,
  }, {
    top: DEFAULT_MAX_REQUIREMENTS,
  });

  if (!normalizedConversationId) {
    throw new Error('conversationId is required for first-principles conversation retrieval.');
  }

  if (!normalizedPrompt) {
    throw new Error('userPrompt is required for first-principles conversation retrieval.');
  }

  logger('firstPriConversationEngineStarted', {
    traceId,
    conversationId: normalizedConversationId,
    promptLength: normalizedPrompt.length,
    maxRequirements: engineOptions.maxRequirements,
    maxChunks: engineOptions.maxChunks,
    maxEvidence: engineOptions.maxEvidence,
    requirementIndexName: engineOptions.requirementIndexName || null,
    chunkIndexName: engineOptions.chunkIndexName || null,
  });

  const requirementResponse = await retrieveRequirementArtifacts({
    conversationId: queryInput.conversationId,
    query: {
      searchText: queryInput.queryText,
      top: queryInput.top,
    },
    options: {
      requirementIndexName: engineOptions.requirementIndexName,
      traceId,
      maxLoggedResultIds: engineOptions.maxLoggedResultIds,
    },
  }, deps);

  const chunkResponse = await retrieveChunkArtifacts({
    conversationId: queryInput.conversationId,
    query: {
      searchText: queryInput.queryText,
      top: engineOptions.maxChunks,
    },
    options: {
      chunkIndexName: engineOptions.chunkIndexName,
      traceId,
      maxLoggedResultIds: engineOptions.maxLoggedResultIds,
    },
  }, deps);

  let effectiveRequirementResponse = requirementResponse;
  let effectiveChunkResponse = chunkResponse;
  let retrievalFallbackUsed = false;

  // If lexical/vector query retrieval returns no evidence, retry with wildcard
  // scoped to the same conversation to recover broad "summarize" and section prompts.
  if (requirementResponse.results.length === 0 && chunkResponse.results.length === 0) {
    retrievalFallbackUsed = true;

    const wildcardTop = Math.max(engineOptions.maxRequirements, engineOptions.maxChunks);
    const wildcardRequirementResponse = await retrieveRequirementArtifacts({
      conversationId: queryInput.conversationId,
      query: {
        searchText: '*',
        top: wildcardTop,
      },
      options: {
        requirementIndexName: engineOptions.requirementIndexName,
        traceId,
        maxLoggedResultIds: engineOptions.maxLoggedResultIds,
      },
    }, deps);

    const wildcardChunkResponse = await retrieveChunkArtifacts({
      conversationId: queryInput.conversationId,
      query: {
        searchText: '*',
        top: wildcardTop,
      },
      options: {
        chunkIndexName: engineOptions.chunkIndexName,
        traceId,
        maxLoggedResultIds: engineOptions.maxLoggedResultIds,
      },
    }, deps);

    effectiveRequirementResponse = wildcardRequirementResponse;
    effectiveChunkResponse = wildcardChunkResponse;

    logger('firstPriConversationEngineWildcardFallbackApplied', {
      traceId,
      conversationId: normalizedConversationId,
      initialRequirementResultCount: requirementResponse.results.length,
      initialChunkResultCount: chunkResponse.results.length,
      wildcardRequirementResultCount: wildcardRequirementResponse.results.length,
      wildcardChunkResultCount: wildcardChunkResponse.results.length,
      wildcardTop,
    });
  }

  const fused = fuseHybridRetrievalResults({
    requirementResults: effectiveRequirementResponse.results,
    chunkResults: effectiveChunkResponse.results,
    options: engineOptions.retrieval,
  }).slice(0, engineOptions.maxEvidence);

  const citations = reconstructCitationsFromResults(fused, {
    includeOffsets: true,
    includeSection: true,
  });

  const fusedSummary = summarizeFusedEvidence(fused, engineOptions.maxLoggedResultIds);

  const generated = await generateAnswerFromEvidence({
    userPrompt: normalizedPrompt,
    evidence: fused,
    citations,
    options: {
      maxContextChars: engineOptions.maxContextChars,
      systemPrompt: engineOptions.systemPrompt,
    },
  }, deps);

  const summary = {
    conversationId: normalizedConversationId,
    answerText: generated.answerText,
    citations,
    evidence: fused,
    metrics: {
      requirementResultCount: effectiveRequirementResponse.results.length,
      chunkResultCount: effectiveChunkResponse.results.length,
      fusedEvidenceCount: fused.length,
      durationMs: Date.now() - startedAt,
      generationMode: generated.generationMode,
      retrievalFallbackUsed,
      traceId,
    },
    indexUsage: {
      requirementIndexName: effectiveRequirementResponse.indexName,
      chunkIndexName: effectiveChunkResponse.indexName,
    },
    modelInfo: generated.modelInfo || null,
    contracts,
  };

  const responsePayload = buildFirstPrinciplesConversationResponsePayload({
    conversationId: normalizedConversationId,
    queryText: normalizedPrompt,
    answerText: generated.answerText,
    citations,
    evidence: fused,
    metrics: summary.metrics,
    indexUsage: summary.indexUsage,
    summaryMode: generated.generationMode,
    modelInfo: generated.modelInfo || null,
  });

  summary.responsePayload = responsePayload;

  logger('firstPriConversationEngineCompleted', {
    traceId,
    conversationId: normalizedConversationId,
    requirementResultCount: summary.metrics.requirementResultCount,
    chunkResultCount: summary.metrics.chunkResultCount,
    fusedEvidenceCount: summary.metrics.fusedEvidenceCount,
    generationMode: summary.metrics.generationMode,
    durationMs: summary.metrics.durationMs,
    retrievalDiagnostics: {
      requirement: effectiveRequirementResponse?.diagnostics || null,
      chunk: effectiveChunkResponse?.diagnostics || null,
    },
    fusedEvidence: fusedSummary,
    citationPreview: citations.slice(0, 20),
  });

  return summary;
}
