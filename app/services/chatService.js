'use server';

import { selectDocument, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';

export async function createChat(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectChat(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function selectCurrentChat(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  const chats = await selectDocuments(query, `team-${teamName}-db`);
  if (chats.length > 1) {
    throw new Error('Unexpected number of current chats.');
  } else if (chats.length === 1) {
    return await chats[0];
  } else {
    return null;
  }
}

export async function selectChats(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`)
}

export async function updateChat(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateChats(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, `team-${teamName}-db`);
}

export async function deleteChat(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);
}

export async function deleteChats(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  query.app = 'SmartNotes';
  return await deleteDocuments(query, `team-${teamName}-db`);
}
