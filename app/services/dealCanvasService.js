'use server';

import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from '@utils/getSession';
import { insertDocument } from '@db/insertDocument';
import { selectDocumentExt } from '@db/selectDocument';
import { updateDocument } from '@db/updateDocument';
import { validateBasicMulti, validateDealCanvasDocument, validateDealCanvasQuery } from './validation';

const DEAL_CANVAS_TYPE = 'DealCanvas';
const DEAL_CANVAS_PARENT_ID = 'infosource-shared';
const INFO_SOURCE_ASSISTANTS = new Set(['infosource', 'info-source-assistant']);

function isInfoSourceAssistant(assistantName = '') {
  return INFO_SOURCE_ASSISTANTS.has(String(assistantName || '').toLowerCase());
}

function buildDealCanvasId(teamName, assistantName) {
  return `deal-canvas::${teamName}::${assistantName}`;
}

function normalizeScope(scope) {
  const normalized = String(scope || 'assistant').toLowerCase();
  if (['assistant', 'individuals', 'none'].includes(normalized)) {
    return normalized;
  }
  return 'assistant';
}

function normalizeLanes(lanes) {
  if (!Array.isArray(lanes)) {
    return [];
  }

  return lanes.map((lane, laneIndex) => ({
    id: String(lane?.id || `lane-${laneIndex + 1}`),
    title: String(lane?.title || ''),
    description: String(lane?.description || ''),
    accent: String(lane?.accent || ''),
    cards: Array.isArray(lane?.cards)
      ? lane.cards.map((card, cardIndex) => ({
        id: String(card?.id || `${lane?.id || `lane-${laneIndex + 1}`}-card-${cardIndex + 1}`),
        title: String(card?.title || ''),
        body: String(card?.body || ''),
      }))
      : []
  }));
}

async function getCurrentCanvas({ teamName, assistantName }) {
  const query = {
    type: DEAL_CANVAS_TYPE,
    id: buildDealCanvasId(teamName, assistantName),
    parentId: DEAL_CANVAS_PARENT_ID,
    teamName,
    assistantName
  };

  return await selectDocumentExt(query, validateDealCanvasQuery, null, `team-${teamName}-db`);
}

export async function selectSharedDealCanvas({ teamName, assistantName }) {
  if (!isInfoSourceAssistant(assistantName)) {
    return null;
  }

  const canvas = await getCurrentCanvas({ teamName, assistantName });
  return canvas || null;
}

export async function saveSharedDealCanvas({
  teamName,
  assistantName,
  smartNoteId,
  lanes,
  expectedUpdatedAt,
  scope,
  sharedWith
}) {
  if (!isInfoSourceAssistant(assistantName)) {
    throw new Error('Deal canvas persistence is only supported for InfoSource assistants.');
  }

  const { nuid } = await getServerSession();
  const canvasId = buildDealCanvasId(teamName, assistantName);
  const normalizedLanes = normalizeLanes(lanes);
  const normalizedScope = normalizeScope(scope);
  const normalizedSharedWith = Array.isArray(sharedWith)
    ? [...new Set(sharedWith.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean))]
    : [];

  const existing = await getCurrentCanvas({ teamName, assistantName });

  if (!existing) {
    const document = {
      id: canvasId,
      type: DEAL_CANVAS_TYPE,
      parentId: DEAL_CANVAS_PARENT_ID,
      teamName,
      assistantName,
      smartNoteId,
      scope: normalizedScope,
      sharedWith: normalizedSharedWith,
      lanes: normalizedLanes,
      nuid,
      version: 1,
      lastEditedBy: nuid,
      lastEditedByName: nuid,
      lastEditedAt: new Date()
    };

    const created = await insertDocument(document, validateDealCanvasDocument, `team-${teamName}-db`);
    return { conflict: false, canvas: created };
  }

  if (expectedUpdatedAt) {
    const expectedMs = Date.parse(expectedUpdatedAt);
    const currentMs = Date.parse(existing.updatedAt);
    if (!Number.isNaN(expectedMs) && !Number.isNaN(currentMs) && expectedMs !== currentMs) {
      return { conflict: true, canvas: existing };
    }
  }

  const updatedDocument = {
    ...existing,
    id: canvasId,
    type: DEAL_CANVAS_TYPE,
    parentId: DEAL_CANVAS_PARENT_ID,
    teamName,
    assistantName,
    smartNoteId,
    nuid: existing.nuid || nuid,
    scope: normalizedScope,
    sharedWith: normalizedSharedWith,
    lanes: normalizedLanes,
    version: (existing.version || 1) + 1,
    lastEditedBy: nuid,
    lastEditedByName: nuid,
    lastEditedAt: new Date()
  };

  const query = {
    type: DEAL_CANVAS_TYPE,
    id: canvasId,
    parentId: DEAL_CANVAS_PARENT_ID,
    teamName,
    assistantName,
    updatedAt: existing.updatedAt
  };

  const saved = await updateDocument(updatedDocument, query, validateDealCanvasDocument, `team-${teamName}-db`);

  if (!saved) {
    const latest = await getCurrentCanvas({ teamName, assistantName });
    return { conflict: true, canvas: latest };
  }

  const refreshed = await getCurrentCanvas({ teamName, assistantName });
  return { conflict: false, canvas: refreshed || saved };
}
