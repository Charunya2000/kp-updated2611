import { v4 as uuidv4 } from 'uuid';
import { selectDocument, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument } from '@db/updateDocument';
import { deleteDocument } from '@db/deleteDocument';
import { getServerSession } from '@/utils/getSession';

const MEMORY_TYPE = 'MemoryItem';

export async function listMemoryItems(teamName, smartNoteId, filters = {}) {
  const { nuid } = await getServerSession();
  const query = {
    type: MEMORY_TYPE,
    parentId: smartNoteId,
    nuid
  };

  if (filters.scope) {
    query.scope = filters.scope;
  }

  if (filters.memoryType) {
    query.memoryType = filters.memoryType;
  }

  const documents = await selectDocuments(query, `team-${teamName}-db`);
  const includeExpired = Boolean(filters.includeExpired);
  const now = new Date();

  return documents
    .filter((item) => includeExpired || !item.expiresAt || new Date(item.expiresAt) > now)
    .sort((left, right) => {
      if (left.pinned && !right.pinned) {
        return -1;
      }
      if (!left.pinned && right.pinned) {
        return 1;
      }
      const leftUpdated = new Date(left.updatedAt || left.createdAt || 0).getTime();
      const rightUpdated = new Date(right.updatedAt || right.createdAt || 0).getTime();
      return rightUpdated - leftUpdated;
    });
}

export async function getMemoryItem(teamName, smartNoteId, id) {
  const { nuid } = await getServerSession();
  return await selectDocument({
    type: MEMORY_TYPE,
    parentId: smartNoteId,
    id,
    nuid
  }, `team-${teamName}-db`);
}

export async function createMemoryItem(teamName, smartNoteId, payload = {}) {
  const { nuid } = await getServerSession();

  const document = {
    id: uuidv4(),
    type: MEMORY_TYPE,
    parentId: smartNoteId,
    nuid,
    scope: normalizeScope(payload.scope),
    memoryType: normalizeMemoryType(payload.memoryType),
    key: normalizeText(payload.key),
    value: normalizeText(payload.value),
    source: payload.source || 'manual',
    sourceInteractionId: payload.sourceInteractionId || null,
    confidence: normalizeConfidence(payload.confidence),
    sensitivity: normalizeSensitivity(payload.sensitivity),
    pinned: Boolean(payload.pinned),
    expiresAt: normalizeExpiry(payload.expiresAt),
    metadata: payload.metadata || {}
  };

  assertRequired(document.key, 'key');
  assertRequired(document.value, 'value');

  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function updateMemoryItem(teamName, smartNoteId, id, payload = {}) {
  const existing = await getMemoryItem(teamName, smartNoteId, id);
  if (!existing) {
    return null;
  }

  const updated = {
    ...existing,
    scope: payload.scope ? normalizeScope(payload.scope) : existing.scope,
    memoryType: payload.memoryType ? normalizeMemoryType(payload.memoryType) : existing.memoryType,
    key: payload.key ? normalizeText(payload.key) : existing.key,
    value: payload.value ? normalizeText(payload.value) : existing.value,
    source: payload.source || existing.source,
    sourceInteractionId: payload.sourceInteractionId || existing.sourceInteractionId,
    confidence: typeof payload.confidence !== 'undefined' ? normalizeConfidence(payload.confidence) : existing.confidence,
    sensitivity: payload.sensitivity ? normalizeSensitivity(payload.sensitivity) : existing.sensitivity,
    pinned: typeof payload.pinned === 'boolean' ? payload.pinned : existing.pinned,
    expiresAt: typeof payload.expiresAt !== 'undefined' ? normalizeExpiry(payload.expiresAt) : existing.expiresAt,
    metadata: payload.metadata || existing.metadata
  };

  assertRequired(updated.key, 'key');
  assertRequired(updated.value, 'value');

  return await updateDocument(updated, {
    type: MEMORY_TYPE,
    parentId: smartNoteId,
    id,
    nuid: existing.nuid
  }, null, `team-${teamName}-db`);
}

export async function deleteMemoryItem(teamName, smartNoteId, id) {
  const { nuid } = await getServerSession();
  return await deleteDocument({
    type: MEMORY_TYPE,
    parentId: smartNoteId,
    id,
    nuid
  }, null, `team-${teamName}-db`);
}

export function extractMemoryCandidatesFromText({ prompt = '', response = '', maxItems = 8 } = {}) {
  const sourceText = `${prompt}\n${response}`.replace(/\r/g, '');
  if (!sourceText.trim()) {
    return [];
  }

  const lines = sourceText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const candidatePatterns = [
    { regex: /(avoid|do not|don't)\b/i, memoryType: 'constraint', sensitivity: 'medium' },
    { regex: /(prefer|style|format|tone)\b/i, memoryType: 'preference', sensitivity: 'low' },
    { regex: /(follow[- ]?up|next step|owner|due)\b/i, memoryType: 'action', sensitivity: 'low' },
    { regex: /(must|need to|required|important)\b/i, memoryType: 'fact', sensitivity: 'medium' }
  ];

  const candidates = [];
  lines.forEach((line) => {
    const match = candidatePatterns.find((pattern) => pattern.regex.test(line));
    if (!match) {
      return;
    }

    candidates.push({
      scope: 'smartnote',
      memoryType: match.memoryType,
      key: inferKey(line),
      value: line,
      source: 'extraction',
      confidence: 0.72,
      sensitivity: match.sensitivity,
      pinned: false
    });
  });

  return dedupeCandidates(candidates).slice(0, maxItems);
}

function dedupeCandidates(candidates = []) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const signature = `${candidate.memoryType}:${candidate.value.toLowerCase()}`;
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
}

function inferKey(text = '') {
  const compact = text
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(' ')
    .toLowerCase();

  return compact || 'memory-item';
}

function normalizeScope(scope = 'smartnote') {
  const value = String(scope).toLowerCase();
  return ['interaction', 'smartnote', 'user', 'team'].includes(value) ? value : 'smartnote';
}

function normalizeMemoryType(memoryType = 'fact') {
  const value = String(memoryType).toLowerCase();
  return ['fact', 'preference', 'constraint', 'action'].includes(value) ? value : 'fact';
}

function normalizeSensitivity(sensitivity = 'medium') {
  const value = String(sensitivity).toLowerCase();
  return ['low', 'medium', 'high'].includes(value) ? value : 'medium';
}

function normalizeConfidence(confidence = 0.7) {
  const value = Number(confidence);
  if (Number.isNaN(value)) {
    return 0.7;
  }
  return Math.min(1, Math.max(0, value));
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeExpiry(expiresAt) {
  if (!expiresAt) {
    return null;
  }

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function assertRequired(value, field) {
  if (!value || !value.trim()) {
    throw new Error(`Memory ${field} is required`);
  }
}
