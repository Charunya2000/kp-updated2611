/**
 * docConversation1stPriService.js
 *
 * First-principles draft for document preparation focused on comparison quality.
 *
 * Design goals:
 * - Treat obligations/requirements as the atomic comparison unit.
 * - Preserve citation provenance for every extracted requirement.
 * - Keep chunk artifacts (for conversational context) and requirement artifacts
 *   (for comparison alignment) as separate outputs from one prep pass.
 *
 * Notes:
 * - This is a draft service and is intentionally not integrated into runtime paths.
 * - The entrypoint accepts dependency injection for parsing/segmentation/indexing
 *   to avoid coupling while the model is iterated.
 */

import { v4 as uuidv4 } from 'uuid';

function logConversationEvent(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    }
  }));
}

const REQUIREMENT_VERB_REGEX = /\b(must|shall|required to|is required to|may not|must not|is prohibited from|will)\b/i;
const SECTION_NUMBER_REGEX = /(?<!\d)(\d{1,3}(?:\.\d{1,3}){1,4})(?!\d)/;
const CONDITION_MARKER_REGEX = /\b(if|when|unless|provided that|except when|except if)\b/i;
const DEADLINE_REGEX = /\bwithin\s+(\d{1,4})\s*(calendar\s+)?(day|days|hour|hours|month|months|year|years)\b/i;

const MODALITY_PATTERNS = [
  { pattern: /\bis prohibited from\b/i, value: 'prohibited', strength: 1.0 },
  { pattern: /\bmust not\b/i, value: 'must_not', strength: 1.0 },
  { pattern: /\bshall not\b/i, value: 'shall_not', strength: 1.0 },
  { pattern: /\bmay not\b/i, value: 'may_not', strength: 0.95 },
  { pattern: /\bis required to\b/i, value: 'required_to', strength: 0.9 },
  { pattern: /\brequired to\b/i, value: 'required_to', strength: 0.85 },
  { pattern: /\bmust\b/i, value: 'must', strength: 0.9 },
  { pattern: /\bshall\b/i, value: 'shall', strength: 0.85 },
  { pattern: /\bwill\b/i, value: 'will', strength: 0.7 },
];

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseSectionNumber(text) {
  const source = normalizeText(text);
  const match = source.match(SECTION_NUMBER_REGEX);
  return match ? match[1] : '';
}

function flattenSectionsRecursive(sections = [], parentId = null, level = 0) {
  const flat = [];

  for (const section of Array.isArray(sections) ? sections : []) {
    const id = uuidv4();
    const heading = normalizeText(section?.heading || 'Untitled Section');
    const rawContent = String(section?.content || '');
    const content = normalizeText(rawContent);

    flat.push({
      id,
      heading,
      sectionNumber: parseSectionNumber(heading),
      rawContent,
      content,
      page: Number.isFinite(Number(section?.startPage)) ? Number(section.startPage) : null,
      level,
      parentId,
      root: level === 0,
      startIndex: Number.isFinite(Number(section?.startIndex)) ? Number(section.startIndex) : null,
      endIndex: Number.isFinite(Number(section?.endIndex)) ? Number(section.endIndex) : null,
    });

    const subsectionList = Array.isArray(section?.subsections) ? section.subsections : [];
    if (subsectionList.length > 0) {
      flat.push(...flattenSectionsRecursive(subsectionList, id, level + 1));
    }
  }

  return flat;
}

function splitIntoSentences(text) {
  const source = normalizeText(text);
  if (!source) return [];

  return source
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(])/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function splitTableLikeRows(rawText = '') {
  const rows = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const out = [];
  for (const row of rows) {
    if (!row.includes('|') && !row.includes('\t')) continue;
    const cells = row
      .split(/\||\t/)
      .map((cell) => normalizeText(cell))
      .filter(Boolean);

    if (cells.length === 0) continue;
    out.push(cells.join(' ; '));
  }

  return out;
}

function splitCandidateClauses(rawText = '') {
  const source = String(rawText || '');
  const sentenceCandidates = splitIntoSentences(source);

  const semicolonCandidates = source
    .split(';')
    .map((part) => normalizeText(part))
    .filter((part) => part.length > 0 && REQUIREMENT_VERB_REGEX.test(part));

  const tableCandidates = splitTableLikeRows(source)
    .filter((part) => REQUIREMENT_VERB_REGEX.test(part));

  return Array.from(new Set([
    ...sentenceCandidates,
    ...semicolonCandidates,
    ...tableCandidates,
  ].filter(Boolean)));
}

function detectModality(text = '') {
  for (const item of MODALITY_PATTERNS) {
    const match = String(text || '').match(item.pattern);
    if (match) {
      return {
        modality: item.value,
        obligationStrength: item.strength,
        phrase: match[0],
        index: match.index || 0,
      };
    }
  }
  return {
    modality: '',
    obligationStrength: 0,
    phrase: '',
    index: -1,
  };
}

function extractCondition(text = '') {
  const source = normalizeText(text);
  const match = source.match(CONDITION_MARKER_REGEX);
  if (!match || match.index === undefined) return '';
  return source.slice(match.index).trim();
}

function extractDeadline(text = '') {
  const source = normalizeText(text);
  const match = source.match(DEADLINE_REGEX);
  if (!match) {
    return {
      deadline: '',
      deadlineValue: null,
      deadlineUnit: '',
    };
  }

  const value = Number(match[1]);
  const unit = normalizeText(match[3]).toLowerCase();
  return {
    deadline: normalizeText(match[0]),
    deadlineValue: Number.isFinite(value) ? value : null,
    deadlineUnit: unit,
  };
}

function normalizeEntityValue(text = '') {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim();
}

function extractActorActionObject(sentence = '', modalityInfo = null) {
  const source = normalizeText(sentence);
  if (!source) {
    return {
      actor: '',
      action: '',
      object: '',
    };
  }

  const info = modalityInfo || detectModality(source);
  if (!info.phrase) {
    return {
      actor: '',
      action: '',
      object: '',
    };
  }

  const modalityIndex = Number.isFinite(info.index) ? info.index : source.toLowerCase().indexOf(info.phrase.toLowerCase());
  const actorRaw = modalityIndex >= 0 ? source.slice(0, modalityIndex) : '';
  const postModality = modalityIndex >= 0
    ? source.slice(modalityIndex + info.phrase.length)
    : source;

  const actor = normalizeEntityValue(actorRaw.replace(/^[,\s-]+|[,\s-]+$/g, ''));
  const condition = extractCondition(postModality);
  const corePost = condition
    ? postModality.replace(condition, '').trim()
    : postModality.trim();

  const words = corePost.split(/\s+/).filter(Boolean);
  const action = normalizeEntityValue(words.slice(0, Math.min(2, words.length)).join(' '));
  const object = normalizeEntityValue(words.slice(Math.min(2, words.length)).join(' '));

  return {
    actor,
    action,
    object,
  };
}

function computeRequirementConfidence({
  sectionNumber = '',
  modality = '',
  actor = '',
  action = '',
  object = '',
  condition = '',
  deadlineValue = null,
  sourceText = '',
} = {}) {
  let score = 0.1;
  if (REQUIREMENT_VERB_REGEX.test(sourceText)) score += 0.2;
  if (modality) score += 0.2;
  if (actor) score += 0.12;
  if (action) score += 0.12;
  if (object) score += 0.1;
  if (condition) score += 0.08;
  if (Number.isFinite(Number(deadlineValue))) score += 0.1;
  if (sectionNumber) score += 0.08;

  return Number(Math.max(0, Math.min(1, score)).toFixed(3));
}

function inferRequirementCategory(text) {
  const source = String(text || '').toLowerCase();

  if (source.includes('within') && source.match(/\bday|days|hour|hours|calendar\b/)) {
    return 'timeline';
  }
  if (source.includes('must notify') || source.includes('notice')) {
    return 'notification';
  }
  if (source.includes('record') || source.includes('maintain') || source.includes('documentation')) {
    return 'recordkeeping';
  }
  if (source.includes('review') || source.includes('committee')) {
    return 'review-governance';
  }

  return 'general-obligation';
}

function buildRequirementObject({ sentence, chunk, ordinal }) {
  const normalizedSentence = normalizeText(sentence);
  const sectionNumber = parseSectionNumber(chunk?.heading) || parseSectionNumber(normalizedSentence);
  const modalityInfo = detectModality(normalizedSentence);
  const deadlineInfo = extractDeadline(normalizedSentence);
  const condition = extractCondition(normalizedSentence);
  const entities = extractActorActionObject(normalizedSentence, modalityInfo);
  const confidence = computeRequirementConfidence({
    sectionNumber,
    modality: modalityInfo.modality,
    actor: entities.actor,
    action: entities.action,
    object: entities.object,
    condition,
    deadlineValue: deadlineInfo.deadlineValue,
    sourceText: normalizedSentence,
  });

  return {
    id: uuidv4(),
    requirementKey: `${chunk?.id || 'chunk'}:${ordinal}`,
    sectionNumber,
    heading: chunk?.heading || '',
    category: inferRequirementCategory(normalizedSentence),
    text: normalizedSentence,
    actor: entities.actor,
    action: entities.action,
    object: entities.object,
    condition,
    deadline: deadlineInfo.deadline,
    deadlineValue: deadlineInfo.deadlineValue,
    deadlineUnit: deadlineInfo.deadlineUnit,
    exception: '',
    modality: modalityInfo.modality,
    obligationStrength: modalityInfo.obligationStrength,
    confidence,
    tableDerived: /\||\t/.test(String(sentence || '')),
    conflictFlags: [],
    citation: {
      chunkId: chunk?.id || '',
      page: Number.isFinite(Number(chunk?.page)) ? Number(chunk.page) : null,
      startIndex: Number.isFinite(Number(chunk?.startIndex)) ? Number(chunk.startIndex) : null,
      endIndex: Number.isFinite(Number(chunk?.endIndex)) ? Number(chunk.endIndex) : null,
      fileName: chunk?.fileName || '',
    },
  };
}

function buildDeduplicationSignature(requirement = {}) {
  return [
    normalizeEntityValue(requirement?.sectionNumber),
    normalizeEntityValue(requirement?.actor),
    normalizeEntityValue(requirement?.action),
    normalizeEntityValue(requirement?.object),
    normalizeEntityValue(requirement?.condition),
    normalizeEntityValue(requirement?.modality),
    normalizeEntityValue(requirement?.deadlineValue),
    normalizeEntityValue(requirement?.deadlineUnit),
    normalizeEntityValue(requirement?.text),
  ].join('|');
}

function deduplicateRequirements(requirements = []) {
  const seen = new Map();

  for (const requirement of Array.isArray(requirements) ? requirements : []) {
    const signature = buildDeduplicationSignature(requirement);
    if (!seen.has(signature)) {
      seen.set(signature, requirement);
      continue;
    }

    const existing = seen.get(signature);
    const existingScore = Number(existing?.confidence || 0);
    const currentScore = Number(requirement?.confidence || 0);
    if (currentScore > existingScore) {
      seen.set(signature, requirement);
    }
  }

  return Array.from(seen.values());
}

function annotateRequirementConflicts(requirements = []) {
  const grouped = new Map();

  for (const requirement of Array.isArray(requirements) ? requirements : []) {
    const key = [
      normalizeEntityValue(requirement?.actor),
      normalizeEntityValue(requirement?.action),
      normalizeEntityValue(requirement?.object),
      normalizeEntityValue(requirement?.condition),
    ].join('|');

    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(requirement);
  }

  const annotated = [];
  for (const group of grouped.values()) {
    const modalities = new Set(group.map((req) => normalizeEntityValue(req?.modality)).filter(Boolean));
    const deadlinePairs = new Set(group.map((req) => `${req?.deadlineValue ?? ''}|${normalizeEntityValue(req?.deadlineUnit)}`).filter((v) => v !== '|'));

    for (const requirement of group) {
      const conflictFlags = Array.isArray(requirement?.conflictFlags) ? [...requirement.conflictFlags] : [];
      if (modalities.size > 1) conflictFlags.push('modality_conflict');
      if (deadlinePairs.size > 1) conflictFlags.push('deadline_conflict');

      const uniqueFlags = Array.from(new Set(conflictFlags));
      annotated.push({
        ...requirement,
        conflictFlags: uniqueFlags,
      });
    }
  }

  return annotated;
}

function extractRequirementArtifacts(chunks = []) {
  const requirements = [];

  for (const chunk of Array.isArray(chunks) ? chunks : []) {
    const candidateSentences = splitCandidateClauses(chunk?.rawContent || chunk?.content || '')
      .filter((sentence) => REQUIREMENT_VERB_REGEX.test(sentence));

    candidateSentences.forEach((sentence, index) => {
      requirements.push(buildRequirementObject({
        sentence,
        chunk,
        ordinal: index + 1,
      }));
    });
  }

  const deduped = deduplicateRequirements(requirements);
  return annotateRequirementConflicts(deduped);
}

function computePrepMetrics({ chunks = [], requirements = [] }) {
  const chunkLengths = chunks
    .map((chunk) => String(chunk?.content || '').length)
    .filter((len) => Number.isFinite(len) && len >= 0)
    .sort((a, b) => a - b);

  const requirementPerChunk = chunks.length > 0
    ? Number((requirements.length / chunks.length).toFixed(2))
    : 0;

  const p95Index = chunkLengths.length > 0
    ? Math.min(chunkLengths.length - 1, Math.floor(chunkLengths.length * 0.95))
    : 0;

  const confidenceScores = requirements
    .map((req) => Number(req?.confidence || 0))
    .filter((score) => Number.isFinite(score));

  const highConfidenceCount = confidenceScores.filter((score) => score >= 0.7).length;
  const conflictRequirementCount = requirements.filter((req) => Array.isArray(req?.conflictFlags) && req.conflictFlags.length > 0).length;
  const tableDerivedCount = requirements.filter((req) => req?.tableDerived === true).length;

  return {
    chunksTotal: chunks.length,
    requirementsTotal: requirements.length,
    averageChunkChars: chunkLengths.length > 0
      ? Math.round(chunkLengths.reduce((sum, len) => sum + len, 0) / chunkLengths.length)
      : 0,
    p95ChunkChars: chunkLengths.length > 0 ? chunkLengths[p95Index] : 0,
    maxChunkChars: chunkLengths.length > 0 ? chunkLengths[chunkLengths.length - 1] : 0,
    requirementPerChunk,
    highConfidenceRequirementCount: highConfidenceCount,
    conflictRequirementCount,
    tableDerivedRequirementCount: tableDerivedCount,
  };
}

/**
 * Builds first-principles prep artifacts from sectioned content.
 *
 * @param {object} params
 * @param {Array} params.sections - Nested section/subsection list from segmentation.
 * @param {string} params.conversationId - GeisingerConversation id.
 * @param {string} params.fileAName - Source file name.
 * @returns {{ chunkArtifacts: Array, requirementArtifacts: Array, metrics: object }}
 */
export function buildFirstPrinciplesArtifacts({ sections = [], conversationId = '', fileAName = '' } = {}) {
  const flatChunks = flattenSectionsRecursive(sections).map((chunk) => ({
    ...chunk,
    conversationId,
    fileName: fileAName,
  }));

  const requirementArtifacts = extractRequirementArtifacts(flatChunks);
  const metrics = computePrepMetrics({
    chunks: flatChunks,
    requirements: requirementArtifacts,
  });

  return {
    chunkArtifacts: flatChunks,
    requirementArtifacts,
    metrics,
  };
}

/**
 * Draft prep entrypoint for first-principles processing.
 * This is intentionally dependency-injected and not wired into runtime routes.
 *
 * Required dependencies:
 * - segmentDocument: async ({ conversation }) => { sections }
 * Optional dependencies:
 * - indexChunkArtifacts: async ({ artifacts, conversation }) => void
 * - indexRequirementArtifacts: async ({ artifacts, conversation }) => void
 */
export async function prepareSharePointPdfsForConversation1stPrinciples(conversation, deps = {}) {
  const segmentDocument = deps?.segmentDocument;
  if (typeof segmentDocument !== 'function') {
    throw new Error('prepareSharePointPdfsForConversation1stPrinciples requires deps.segmentDocument(conversation).');
  }

  const startedAt = Date.now();
  logConversationEvent('prepareSharePointPdfsForConversation1stPriStarted', {
    conversationId: conversation?.id || null,
    fileAName: conversation?.fileAName || null,
  });

  const segmented = await segmentDocument({ conversation });
  const sections = Array.isArray(segmented?.sections) ? segmented.sections : [];

  const { chunkArtifacts, requirementArtifacts, metrics } = buildFirstPrinciplesArtifacts({
    sections,
    conversationId: String(conversation?.id || '').trim(),
    fileAName: String(conversation?.fileAName || '').trim(),
  });

  if (typeof deps?.indexChunkArtifacts === 'function') {
    await deps.indexChunkArtifacts({ artifacts: chunkArtifacts, conversation });
  }

  if (typeof deps?.indexRequirementArtifacts === 'function') {
    await deps.indexRequirementArtifacts({ artifacts: requirementArtifacts, conversation });
  }

  // Temporary diagnostic sample for validating requirement extraction quality.
  logConversationEvent('prepareSharePointPdfsForConversation1stPriDiagnostics', {
    conversationId: conversation?.id || null,
    fileAName: conversation?.fileAName || null,
    ...metrics,
    sampleRequirementHeadings: requirementArtifacts.slice(0, 5).map((req) => req?.heading || ''),
  });

  return {
    conversationId: conversation?.id || null,
    chunkCount: chunkArtifacts.length,
    requirementCount: requirementArtifacts.length,
    durationMs: Date.now() - startedAt,
    metrics,
  };
}
