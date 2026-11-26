'use server';

import { selectDocument, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument } from '@db/updateDocument';
import { deleteDocument } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';

export async function createInfoSourceFilterSettings(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectInfoSourceFilterSettings(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`);
}

export async function selectInfoSourceFilterSettingsById(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function updateInfoSourceFilterSettings(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function deleteInfoSourceFilterSettings(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);
}