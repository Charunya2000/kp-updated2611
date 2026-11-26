'use server';

import { selectDocument, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { validateBasicMulti } from './validation';

export async function createChatInteraction(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  if (document.feedback === undefined) {
    document.feedback = null;
  }
  const newChatInteraction = await insertDocument(document, null, `team-${teamName}-db`);
  return newChatInteraction;
}

export async function selectChatInteraction(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  const chatInteraction = await selectDocument(query, `team-${teamName}-db`);
  return chatInteraction;
}

export async function selectChatInteractions(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`);
}

export async function updateChatInteraction(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateChatInteractions(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, `team-${teamName}-db`);
}

export async function deleteChatInteraction(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);
}

export async function deleteChatInteractions(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  query.app = 'SmartNotes';
  return await deleteDocuments(query, `team-${teamName}-db`);
}

export async function updateChatInteractionFeedback(chatInteractionId, feedback, teamName, smartNoteId = null) {
  const { nuid } = await getServerSession();
  const query = { type: 'ChatInteraction', id: chatInteractionId, nuid };

  if (smartNoteId) {
    query.smartNoteId = smartNoteId;
  }

  const updatedChatInteraction = await updateDocument(
    { type: 'ChatInteraction', feedback },
    query,
    validateBasicMulti,
    `team-${teamName}-db`
  );

  return updatedChatInteraction
    ? { id: chatInteractionId, smartNoteId, feedback }
    : null;
}
