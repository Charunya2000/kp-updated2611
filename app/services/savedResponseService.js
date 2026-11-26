'use server';

import { selectDocument, selectDocumentExt, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { recordSavedResponseAdded } from '@services/statisticsService';
import { validateBasicChildSingle } from './validation';

export async function createSavedResponse(document, teamName, assistantName = null) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  recordSavedResponseAdded(nuid, null, teamName, assistantName);
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectSavedResponse(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function selectSavedResponses(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`);
}

export async function updateSavedResponse(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateSavedResponses(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, `team-${teamName}-db`);
}

export async function deleteSavedResponse(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);
}

export async function deleteSavedResponses(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocuments(query, `team-${teamName}-db`);
}

export async function cloneSavedResponse(templateQuery, parentId, sourceId, teamName) {
  const existingSavedResponse = await selectDocumentExt(templateQuery, validateBasicChildSingle, null, `team-${teamName}-db`);
  if (!existingSavedResponse) {
    return null;
  }

  const { nuid } = await getServerSession();
  const newDocument = { ...existingSavedResponse };
  delete newDocument._id;

  newDocument.id = sourceId
  newDocument.nuid = nuid;
  newDocument.parentId = parentId;

  const insertedDocument = await insertDocument(newDocument, null, `team-${teamName}-db`);
  return insertedDocument;
}
