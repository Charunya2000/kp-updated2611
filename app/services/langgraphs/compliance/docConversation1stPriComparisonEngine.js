import {
  retrieveRequirementArtifacts,
  retrieveChunkArtifacts,
  reconstructCitation,
} from './docConversation1stPriRetrievalService.js';
import {
  buildFirstPrinciplesComparisonResponsePayload,
  getFirstPrinciplesEngineContracts,
  normalizeFirstPrinciplesQueryInput,
} from './docConversation1stPriEngineContracts.js';

const DEFAULT_TOP = 40;
const DEFAULT_MIN_PARTIAL_SCORE = 0.58;
const DEFAULT_MIN_MATCH_SCORE = 0.82;
const DEFAULT_MIN_CONFLICT_SCORE = 0.42;

const MODALITY_GROUPS = {
  must: 'required',
  shall: 'required',
  required_to: 'required',
  will: 'required_soft',
  must_not: 'prohibited',
  shall_not: 'prohibited',
  may_not: 'prohibited',
  prohibited: 'prohibited',
};

function logCompareEvent(name, detail = {}) {
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

function getResultScore(result = {}) {
  if (typeof result?.score === 'number') return result.score;
  if (typeof result?.document?.['@search.score'] === 'number') return result.document['@search.score'];
  return 0;
}

function truncateText(text = '', maxLength = 220) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function extractQueryTerms(queryText = '') {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'does', 'for', 'from', 'how',
    'in', 'is', 'it', 'mean', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'what',
    'when', 'where', 'which', 'who', 'why', 'with',
  ]);

  const terms = String(queryText || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));

  return Array.from(new Set(terms));
}

function extractFocusedTopicQuery(queryText = '') {
  const normalized = normalizeString(queryText);
  if (!normalized || normalized === '*') {
    return {
      phrase: '',
      terms: [],
      hasFocus: false,
      source: 'none',
    };
  }

  const quotedMatch = normalized.match(/["']([^"']+)["']/);
  if (quotedMatch?.[1]) {
    const phrase = normalizeString(quotedMatch[1]);
    return {
      phrase,
      terms: extractQueryTerms(phrase),
      hasFocus: true,
      source: 'quoted',
    };
  }

  const definitionPromptMatch = normalized.match(/(?:what\s+does|define|meaning\s+of)\s+(.+?)(?:\s+mean\??)?$/i);
  if (definitionPromptMatch?.[1]) {
    const phrase = normalizeString(definitionPromptMatch[1]).replace(/[.\s?]+$/, '');
    return {
      phrase,
      terms: extractQueryTerms(phrase),
      hasFocus: !!phrase,
      source: 'definition-prompt',
    };
  }

  const terms = extractQueryTerms(normalized);
  return {
    phrase: '',
    terms,
    hasFocus: terms.length > 0,
    source: 'terms',
  };
}

function isDefinitionStylePrompt(value = '') {
  const text = normalizeString(value).toLowerCase();
  if (!text) return false;
  return /\bwhat\s+does\b/.test(text)
    || /\bdefine\b/.test(text)
    || /\bmeaning\s+of\b/.test(text)
    || /\bwhat\s+is\s+the\s+definition\s+of\b/.test(text);
}

function scoreDefinitionCandidate(item = {}, focus = {}) {
  const text = normalizeString(item?.text);
  const heading = normalizeString(item?.heading).toLowerCase();
  if (!text) return 0;

  const lower = text.toLowerCase();
  const phrase = normalizeString(focus?.phrase).toLowerCase();
  const terms = (Array.isArray(focus?.terms) ? focus.terms : []).map((term) => String(term || '').toLowerCase());
  const anchor = phrase || terms[0] || '';
  if (!anchor) return 0;

  let score = 0;
  if (heading.includes('glossary') || heading.includes('definition') || heading.includes('defined term')) {
    score += 4;
  }

  if (lower.includes(`${anchor} means`) || lower.includes(`${anchor} shall mean`)) {
    score += 5;
  }

  if (lower.includes(`${anchor} is defined as`) || lower.includes(`${anchor} refers to`)) {
    score += 4;
  }

  const nearPattern = new RegExp(`${anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]{0,80}(means|shall\\s+mean|is\\s+defined\\s+as|refers\\s+to)`, 'i');
  if (nearPattern.test(text)) {
    score += 3;
  }

  return score;
}

function selectDefinitionFocusedRequirements(requirements = [], focus = {}, maxItems = 40) {
  const scored = (Array.isArray(requirements) ? requirements : [])
    .map((item) => ({ item, definitionScore: scoreDefinitionCandidate(item, focus) }))
    .filter((row) => row.definitionScore > 0)
    .sort((a, b) => b.definitionScore - a.definitionScore)
    .slice(0, Math.max(1, maxItems));

  return scored.map((row) => row.item);
}

function matchesFocusedTopicText(text = '', focus = {}) {
  const normalizedText = String(text || '').toLowerCase();
  if (!normalizedText) return false;

  const phrase = normalizeString(focus?.phrase).toLowerCase();
  const terms = Array.isArray(focus?.terms) ? focus.terms : [];

  if (phrase && normalizedText.includes(phrase)) {
    return true;
  }

  if (terms.length === 0) {
    return false;
  }

  if (terms.length === 1) {
    return normalizedText.includes(terms[0]);
  }

  return terms.every((term) => normalizedText.includes(term));
}

function filterRequirementsByFocusedTopic(requirements = [], focus = {}) {
  const safeRequirements = Array.isArray(requirements) ? requirements : [];
  if (!focus?.hasFocus) return safeRequirements;
  return safeRequirements.filter((item) => matchesFocusedTopicText(item?.text, focus));
}

function getMatchedQueryTerms(text = '', queryTerms = []) {
  const normalizedText = String(text || '').toLowerCase();
  if (!normalizedText || !Array.isArray(queryTerms) || queryTerms.length === 0) {
    return [];
  }
  return queryTerms.filter((term) => normalizedText.includes(term));
}

function summarizeRawRetrievalResults(results = [], queryTerms = [], maxItems = 8) {
  const safeResults = Array.isArray(results) ? results : [];
  const sampled = safeResults.slice(0, Math.max(0, maxItems));

  const sampledHits = sampled.map((result) => {
    const doc = result?.document || {};
    const text = normalizeString(doc?.requirement_text || doc?.content);
    return {
      id: normalizeString(doc?.id),
      requirementKey: normalizeString(doc?.requirement_key),
      citation: reconstructCitation(doc, { includeOffsets: true, includeSection: true }),
      heading: normalizeString(doc?.heading),
      score: Number(getResultScore(result).toFixed(6)),
      matchedQueryTerms: getMatchedQueryTerms(text, queryTerms),
      preview: truncateText(text),
    };
  });

  const rawHitsWithAnyQueryTerm = safeResults.filter((result) => {
    const doc = result?.document || {};
    const text = normalizeString(doc?.requirement_text || doc?.content);
    return getMatchedQueryTerms(text, queryTerms).length > 0;
  }).length;

  const rawHitsMissingText = safeResults.filter((result) => {
    const doc = result?.document || {};
    const text = normalizeString(doc?.requirement_text || doc?.content);
    return !text;
  }).length;

  return {
    rawResultCount: safeResults.length,
    rawHitsWithAnyQueryTerm,
    rawHitsMissingText,
    rawTopHits: sampledHits,
  };
}

function summarizeNormalizedRequirements(requirements = [], queryTerms = [], maxItems = 8) {
  const safeRequirements = Array.isArray(requirements) ? requirements : [];
  const sampled = safeRequirements.slice(0, Math.max(0, maxItems));

  const sampledHits = sampled.map((item) => ({
    requirementId: normalizeString(item?.id),
    requirementKey: normalizeString(item?.requirementKey),
    citation: normalizeString(item?.citation),
    heading: normalizeString(item?.heading),
    matchedQueryTerms: getMatchedQueryTerms(item?.text, queryTerms),
    preview: truncateText(item?.text),
  }));

  const normalizedHitsWithAnyQueryTerm = safeRequirements.filter(
    (item) => getMatchedQueryTerms(item?.text, queryTerms).length > 0
  ).length;

  return {
    normalizedRequirementCount: safeRequirements.length,
    normalizedHitsWithAnyQueryTerm,
    normalizedTopRequirements: sampledHits,
  };
}

function tokenize(text = '') {
  return Array.from(new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  ));
}

function jaccardScore(a = [], b = []) {
  const setA = new Set(Array.isArray(a) ? a : []);
  const setB = new Set(Array.isArray(b) ? b : []);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }

  const union = setA.size + setB.size - intersection;
  if (union <= 0) return 0;
  return intersection / union;
}

function normalizeRequirement(result = {}) {
  const doc = result?.document || {};
  const text = normalizeString(doc?.requirement_text || doc?.content);
  const actor = normalizeString(doc?.normalized_actor);
  const action = normalizeString(doc?.normalized_action);
  const object = normalizeString(doc?.normalized_object);
  const modality = normalizeString(doc?.modality).toLowerCase();
  const sectionNumber = normalizeString(doc?.section_number);
  const category = normalizeString(doc?.category).toLowerCase();

  return {
    id: normalizeString(doc?.id),
    requirementKey: normalizeString(doc?.requirement_key),
    sourceChunkId: normalizeString(doc?.source_chunk_id),
    text,
    sectionNumber,
    heading: normalizeString(doc?.heading),
    actor,
    action,
    object,
    modality,
    category,
    citation: reconstructCitation(doc, {
      includeOffsets: true,
      includeSection: true,
    }),
    tokens: tokenize(text),
    tripletTokens: tokenize(`${actor} ${action} ${object}`),
  };
}

function normalizeChunkAsRequirement(result = {}) {
  const doc = result?.document || {};
  const text = normalizeString(doc?.content || doc?.requirement_text);
  const sectionNumber = normalizeString(doc?.section_number);
  const heading = normalizeString(doc?.heading);
  const syntheticId = normalizeString(doc?.id) ? `chunk-${normalizeString(doc.id)}` : '';

  return {
    id: syntheticId,
    requirementKey: normalizeString(doc?.source_chunk_id || doc?.id),
    sourceChunkId: normalizeString(doc?.id || doc?.source_chunk_id),
    text,
    sectionNumber,
    heading,
    actor: '',
    action: '',
    object: '',
    modality: '',
    category: normalizeString(doc?.category).toLowerCase() || 'chunk-evidence',
    citation: reconstructCitation(doc, {
      includeOffsets: true,
      includeSection: true,
    }),
    tokens: tokenize(text),
    tripletTokens: tokenize(`${sectionNumber} ${heading}`),
  };
}

function mergeRequirementsWithDedupe(base = [], extras = []) {
  const out = [];
  const seen = new Set();

  const pushUnique = (item = {}) => {
    const idKey = normalizeString(item?.id);
    const textKey = normalizeString(item?.text).toLowerCase();
    const key = idKey || `${normalizeString(item?.sectionNumber)}|${textKey.slice(0, 180)}`;
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };

  (Array.isArray(base) ? base : []).forEach(pushUnique);
  (Array.isArray(extras) ? extras : []).forEach(pushUnique);
  return out;
}

function modalityGroup(modality = '') {
  return MODALITY_GROUPS[normalizeString(modality).toLowerCase()] || 'unknown';
}

function computePairScore(a, b) {
  const lexical = jaccardScore(a.tokens, b.tokens);
  const triplet = jaccardScore(a.tripletTokens, b.tripletTokens);
  const sectionBoost = a.sectionNumber && b.sectionNumber && a.sectionNumber === b.sectionNumber ? 0.08 : 0;
  const categoryBoost = a.category && b.category && a.category === b.category ? 0.05 : 0;

  const modalityA = modalityGroup(a.modality);
  const modalityB = modalityGroup(b.modality);
  const modalityConflict =
    (modalityA === 'required' && modalityB === 'prohibited') ||
    (modalityA === 'prohibited' && modalityB === 'required');

  // Keep raw topical similarity independent of modality direction; conflict routing
  // happens during classification using modalityConflict + minConflict threshold.
  const score = Math.max(0, Math.min(1,
    (lexical * 0.62) +
    (triplet * 0.25) +
    sectionBoost +
    categoryBoost
  ));

  return {
    score: Number(score.toFixed(4)),
    lexical: Number(lexical.toFixed(4)),
    triplet: Number(triplet.toFixed(4)),
    modalityConflict,
  };
}

function classifyPair(pairScore, options = {}) {
  const minMatch = Number.isFinite(Number(options?.minMatchScore))
    ? Number(options.minMatchScore)
    : DEFAULT_MIN_MATCH_SCORE;
  const minPartial = Number.isFinite(Number(options?.minPartialScore))
    ? Number(options.minPartialScore)
    : DEFAULT_MIN_PARTIAL_SCORE;
  const minConflict = Number.isFinite(Number(options?.minConflictScore))
    ? Number(options.minConflictScore)
    : DEFAULT_MIN_CONFLICT_SCORE;

  if (pairScore.modalityConflict && pairScore.score >= minConflict) {
    return 'conflict';
  }

  if (pairScore.score >= minMatch) {
    return 'match';
  }

  if (pairScore.score >= minPartial) {
    return 'partial';
  }

  return 'none';
}

function buildAlignmentEntry(classification, a, b, pairScore) {
  return {
    classification,
    score: pairScore.score,
    diagnostics: {
      lexical: pairScore.lexical,
      triplet: pairScore.triplet,
      modalityConflict: pairScore.modalityConflict,
    },
    left: {
      requirementId: a.id,
      requirementKey: a.requirementKey,
      text: a.text,
      sectionNumber: a.sectionNumber,
      heading: a.heading,
      citation: a.citation,
      modality: a.modality,
      category: a.category,
      sourceChunkId: a.sourceChunkId,
    },
    right: {
      requirementId: b.id,
      requirementKey: b.requirementKey,
      text: b.text,
      sectionNumber: b.sectionNumber,
      heading: b.heading,
      citation: b.citation,
      modality: b.modality,
      category: b.category,
      sourceChunkId: b.sourceChunkId,
    },
  };
}

function buildGapEntry(sideLabel, item) {
  return {
    side: sideLabel,
    requirementId: item.id,
    requirementKey: item.requirementKey,
    text: item.text,
    sectionNumber: item.sectionNumber,
    heading: item.heading,
    citation: item.citation,
    modality: item.modality,
    category: item.category,
    sourceChunkId: item.sourceChunkId,
  };
}

function summarizeRequirement(requirement = {}, maxLength = 180) {
  const citation = normalizeString(requirement.citation);
  const section = normalizeString(requirement.sectionNumber);
  const heading = normalizeString(requirement.heading);
  const text = normalizeString(requirement.text).replace(/\s+/g, ' ');

  const location = citation || section || heading;
  if (!text) return location || 'Requirement text unavailable';

  if (text.length <= maxLength) {
    return location ? `${location}: ${text}` : text;
  }

  const truncated = `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  return location ? `${location}: ${truncated}` : truncated;
}

function fallbackComparisonSummary(result = {}) {
  const { summary = {}, matches = [], partials = [], conflicts = [], gaps = {} } = result;
  const firstConflict = conflicts[0];
  const firstGap = (gaps.left || [])[0] || (gaps.right || [])[0];

  const lines = [
    `Compared ${summary.leftRequirementCount || 0} requirements vs ${summary.rightRequirementCount || 0} requirements.`,
    `Matches: ${matches.length}, partials: ${partials.length}, conflicts: ${conflicts.length}.`,
    `Gaps: left-only=${(gaps.left || []).length}, right-only=${(gaps.right || []).length}.`,
  ];

  if (firstConflict) {
    lines.push(
      `Sample conflict: ${summarizeRequirement(firstConflict.left)} <> ${summarizeRequirement(firstConflict.right)}`,
    );
  }

  if (firstGap) {
    lines.push(`Sample gap (${firstGap.side}): ${summarizeRequirement(firstGap)}`);
  }

  return lines.join('\n');
}

async function maybeGenerateSummary(result = {}, deps = {}) {
  if (typeof deps?.generateComparisonSummary !== 'function') {
    return {
      text: fallbackComparisonSummary(result),
      mode: 'fallback',
    };
  }

  const generated = await deps.generateComparisonSummary(result);
  const text = normalizeString(generated?.text || generated?.summary || '', fallbackComparisonSummary(result));
  return {
    text,
    mode: 'model',
    modelInfo: generated?.modelInfo || null,
  };
}

/**
 * Non-integrated first-principles comparison engine.
 *
 * Aligns requirement artifacts from two prepared conversations and emits
 * structured match/partial/conflict/gap results with citations.
 */
export async function compareWithFirstPrinciplesEngine({
  leftConversationId = '',
  rightConversationId = '',
  queryText = '*',
  options = {},
} = {}, deps = {}) {
  const startedAt = Date.now();
  const logger = typeof deps?.logEvent === 'function' ? deps.logEvent : logCompareEvent;
  const assertNotCancelled = typeof deps?.assertNotCancelled === 'function'
    ? deps.assertNotCancelled
    : async () => { };

  await assertNotCancelled();

  const leftId = normalizeString(leftConversationId);
  const rightId = normalizeString(rightConversationId);
  if (!leftId || !rightId) {
    throw new Error('leftConversationId and rightConversationId are required.');
  }

  const top = normalizePositiveInt(options?.top, DEFAULT_TOP);
  const requirementIndexName = normalizeString(options?.requirementIndexName);
  const comparisonMode = normalizeString(options?.comparisonMode).toLowerCase() === 'comprehensive'
    ? 'comprehensive'
    : 'topic';
  const traceId = normalizeString(options?.traceId) || null;
  const originalPrompt = normalizeString(options?.originalPrompt);
  const definitionIntent = isDefinitionStylePrompt(originalPrompt);
  const normalizedQuery = normalizeString(queryText, '*');
  const queryTerms = extractQueryTerms(normalizedQuery);
  const focusedTopicQuery = extractFocusedTopicQuery(normalizedQuery);
  const retrievalTop = comparisonMode === 'topic' && focusedTopicQuery.hasFocus
    ? Math.max(top, 120)
    : top;
  const contracts = getFirstPrinciplesEngineContracts();

  const leftQuery = normalizeFirstPrinciplesQueryInput({
    conversationId: leftId,
    queryText: normalizedQuery,
    top: retrievalTop,
  }, { top: DEFAULT_TOP });

  const rightQuery = normalizeFirstPrinciplesQueryInput({
    conversationId: rightId,
    queryText: normalizedQuery,
    top: retrievalTop,
  }, { top: DEFAULT_TOP });

  logger('firstPriComparisonEngineStarted', {
    traceId,
    leftConversationId: leftId,
    rightConversationId: rightId,
    queryText: normalizedQuery,
    queryTerms,
    focusedTopicQuery,
    definitionIntent,
    originalPrompt,
    top,
    retrievalTop,
  });

  await assertNotCancelled();

  const [leftResponse, rightResponse] = await Promise.all([
    retrieveRequirementArtifacts({
      conversationId: leftQuery.conversationId,
      query: { searchText: leftQuery.queryText, top: leftQuery.top },
      options: { requirementIndexName },
    }, deps),
    retrieveRequirementArtifacts({
      conversationId: rightQuery.conversationId,
      query: { searchText: rightQuery.queryText, top: rightQuery.top },
      options: { requirementIndexName },
    }, deps),
  ]);

  await assertNotCancelled();

  const leftRequirements = leftResponse.results.map(normalizeRequirement).filter((item) => item.text);
  const rightRequirements = rightResponse.results.map(normalizeRequirement).filter((item) => item.text);
  let leftChunkFocusedAugment = [];
  let rightChunkFocusedAugment = [];

  let focusedLeftRequirements = filterRequirementsByFocusedTopic(leftRequirements, focusedTopicQuery);
  let focusedRightRequirements = filterRequirementsByFocusedTopic(rightRequirements, focusedTopicQuery);

  const shouldAugmentFromChunks = comparisonMode === 'topic'
    && focusedTopicQuery.hasFocus
    && (definitionIntent || focusedLeftRequirements.length === 0 || focusedRightRequirements.length === 0);

  let effectiveLeftRequirementsRaw = leftRequirements;
  let effectiveRightRequirementsRaw = rightRequirements;

  if (shouldAugmentFromChunks) {
    const [leftChunkResponse, rightChunkResponse] = await Promise.all([
      retrieveChunkArtifacts({
        conversationId: leftQuery.conversationId,
        query: { searchText: leftQuery.queryText, top: Math.max(retrievalTop, 160) },
      }, deps),
      retrieveChunkArtifacts({
        conversationId: rightQuery.conversationId,
        query: { searchText: rightQuery.queryText, top: Math.max(retrievalTop, 160) },
      }, deps),
    ]);

    await assertNotCancelled();

    leftChunkFocusedAugment = (leftChunkResponse.results || [])
      .map(normalizeChunkAsRequirement)
      .filter((item) => item.text)
      .filter((item) => matchesFocusedTopicText(item.text, focusedTopicQuery));

    rightChunkFocusedAugment = (rightChunkResponse.results || [])
      .map(normalizeChunkAsRequirement)
      .filter((item) => item.text)
      .filter((item) => matchesFocusedTopicText(item.text, focusedTopicQuery));

    effectiveLeftRequirementsRaw = mergeRequirementsWithDedupe(leftRequirements, leftChunkFocusedAugment);
    effectiveRightRequirementsRaw = mergeRequirementsWithDedupe(rightRequirements, rightChunkFocusedAugment);

    focusedLeftRequirements = filterRequirementsByFocusedTopic(effectiveLeftRequirementsRaw, focusedTopicQuery);
    focusedRightRequirements = filterRequirementsByFocusedTopic(effectiveRightRequirementsRaw, focusedTopicQuery);
  }

  const useFocusedSubset = comparisonMode === 'topic'
    && focusedTopicQuery.hasFocus
    && focusedLeftRequirements.length > 0
    && focusedRightRequirements.length > 0;

  const definitionFocusedLeft = definitionIntent
    ? selectDefinitionFocusedRequirements(effectiveLeftRequirementsRaw, focusedTopicQuery)
    : [];
  const definitionFocusedRight = definitionIntent
    ? selectDefinitionFocusedRequirements(effectiveRightRequirementsRaw, focusedTopicQuery)
    : [];
  const useDefinitionSubset = definitionIntent
    && definitionFocusedLeft.length > 0
    && definitionFocusedRight.length > 0;

  const effectiveLeftRequirements = useDefinitionSubset
    ? definitionFocusedLeft
    : (useFocusedSubset ? focusedLeftRequirements : effectiveLeftRequirementsRaw);
  const effectiveRightRequirements = useDefinitionSubset
    ? definitionFocusedRight
    : (useFocusedSubset ? focusedRightRequirements : effectiveRightRequirementsRaw);

  logger('firstPriComparisonRetrievalSnapshot', {
    traceId,
    leftConversationId: leftId,
    rightConversationId: rightId,
    comparisonMode,
    queryText: normalizedQuery,
    queryTerms,
    leftRetrieval: {
      ...summarizeRawRetrievalResults(leftResponse.results, queryTerms),
      ...summarizeNormalizedRequirements(leftRequirements, queryTerms),
      focusedRequirementCount: focusedLeftRequirements.length,
      focusedChunkAugmentCount: leftChunkFocusedAugment.length,
    },
    rightRetrieval: {
      ...summarizeRawRetrievalResults(rightResponse.results, queryTerms),
      ...summarizeNormalizedRequirements(rightRequirements, queryTerms),
      focusedRequirementCount: focusedRightRequirements.length,
      focusedChunkAugmentCount: rightChunkFocusedAugment.length,
    },
    focusMode: {
      focusedTopicQuery,
      definitionIntent,
      usedChunkAugment: shouldAugmentFromChunks,
      useFocusedSubset,
      useDefinitionSubset,
      leftDefinitionFocusedCount: definitionFocusedLeft.length,
      rightDefinitionFocusedCount: definitionFocusedRight.length,
      leftEffectiveCount: effectiveLeftRequirements.length,
      rightEffectiveCount: effectiveRightRequirements.length,
    },
  });

  const aligned = [];
  const matchedRight = new Set();
  let cancellationCheckCounter = 0;

  for (const leftItem of effectiveLeftRequirements) {
    cancellationCheckCounter += 1;
    if (cancellationCheckCounter % 10 === 0) {
      await assertNotCancelled();
    }

    let best = null;

    effectiveRightRequirements.forEach((rightItem, rightIndex) => {
      if (matchedRight.has(rightIndex)) return;
      const pairScore = computePairScore(leftItem, rightItem);
      const classification = classifyPair(pairScore, options);
      if (classification === 'none') return;

      if (!best || pairScore.score > best.pairScore.score) {
        best = {
          rightIndex,
          rightItem,
          pairScore,
          classification,
        };
      }
    });

    if (!best) continue;

    matchedRight.add(best.rightIndex);
    aligned.push(buildAlignmentEntry(best.classification, leftItem, best.rightItem, best.pairScore));
  }

  const matches = aligned.filter((item) => item.classification === 'match');
  const partials = aligned.filter((item) => item.classification === 'partial');
  const conflicts = aligned.filter((item) => item.classification === 'conflict');

  const matchedLeftIds = new Set(aligned.map((item) => item.left.requirementId));
  const matchedRightIds = new Set(aligned.map((item) => item.right.requirementId));

  const gapsLeft = effectiveLeftRequirements
    .filter((item) => item.id && !matchedLeftIds.has(item.id))
    .map((item) => buildGapEntry('left', item));

  const gapsRight = effectiveRightRequirements
    .filter((item) => item.id && !matchedRightIds.has(item.id))
    .map((item) => buildGapEntry('right', item));

  const result = {
    queryText: normalizedQuery,
    comparisonMode,
    requirementIndexName: rightResponse.indexName || leftResponse.indexName || requirementIndexName || 'compliance-requirements-v1',
    leftConversationId: leftId,
    rightConversationId: rightId,
    summary: {
      leftRequirementCount: effectiveLeftRequirements.length,
      rightRequirementCount: effectiveRightRequirements.length,
      leftRequirementRetrievedCount: leftRequirements.length,
      rightRequirementRetrievedCount: rightRequirements.length,
      leftRequirementEffectiveCount: effectiveLeftRequirements.length,
      rightRequirementEffectiveCount: effectiveRightRequirements.length,
      alignedCount: aligned.length,
      matchCount: matches.length,
      partialCount: partials.length,
      conflictCount: conflicts.length,
      gapLeftCount: gapsLeft.length,
      gapRightCount: gapsRight.length,
      durationMs: Date.now() - startedAt,
    },
    matches,
    partials,
    conflicts,
    gaps: {
      left: gapsLeft,
      right: gapsRight,
    },
  };

  await assertNotCancelled();

  const generatedSummary = await maybeGenerateSummary(result, deps);
  await assertNotCancelled();

  const output = {
    ...result,
    comparisonSummary: generatedSummary.text,
    summaryMode: generatedSummary.mode,
    modelInfo: generatedSummary.modelInfo || null,
    contracts,
  };

  output.responsePayload = buildFirstPrinciplesComparisonResponsePayload({
    leftConversationId: leftId,
    rightConversationId: rightId,
    queryText: normalizedQuery,
    comparisonMode,
    comparisonSummary: output.comparisonSummary,
    summary: output.summary,
    matches: output.matches,
    partials: output.partials,
    conflicts: output.conflicts,
    gaps: output.gaps,
    summaryMode: output.summaryMode,
    modelInfo: output.modelInfo,
  });

  logger('firstPriComparisonEngineCompleted', {
    traceId,
    leftConversationId: leftId,
    rightConversationId: rightId,
    comparisonMode,
    alignedCount: output.summary.alignedCount,
    matchCount: output.summary.matchCount,
    partialCount: output.summary.partialCount,
    conflictCount: output.summary.conflictCount,
    gapLeftCount: output.summary.gapLeftCount,
    gapRightCount: output.summary.gapRightCount,
    summaryMode: output.summaryMode,
    durationMs: output.summary.durationMs,
  });

  return output;
}
