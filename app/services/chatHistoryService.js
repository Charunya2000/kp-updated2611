'use server';

import { selectDocument, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';

export async function createChatHistory(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectChatHistory(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function selectCurrentChatHistory(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  const chatHistorys = await selectDocuments(query, `team-${teamName}-db`);
  if (chatHistorys.length > 1) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'selectCurrentChatHistory', detail: { query, teamName } } }));
    throw new Error('Unexpected number of current chatHistorys.');
  } else if (chatHistorys.length === 1) {
    return await chatHistorys[0];
  } else {
    return null;
  }
}

export async function selectChatHistorys(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`)
}

export async function updateChatHistory(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateChatHistorys(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, null, `team-${teamName}-db`);
}

export async function deleteChatHistory(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);
}

export async function deleteChatHistorys(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  query.app = 'SmartNotes';
  return await deleteDocuments(query, `team-${teamName}-db`);
}
