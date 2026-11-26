'use server';

import { selectDocument, selectDocumentExt, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { recordWebURL, recordConfluenceSource, recordQTestSource } from '@services/statisticsService';
import { validateBasicChildSingle, validateDocumentDelete } from './validation';

export async function createWebsiteURL(document, teamName, assistantName = null) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  if (document.variant === 'ConfluenceURL') {
    recordConfluenceSource(nuid, null, teamName, assistantName);
  } else if (document.variant === 'QTestURL') {
    recordQTestSource(nuid, null, teamName, assistantName);
  } else {
    recordWebURL(nuid, null, teamName, assistantName);
  }
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectWebsiteURL(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function selectWebsiteURLs(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`);
}

export async function updateWebsiteURL(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateWebsiteURLs(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, `team-${teamName}-db`);
}
export async function deleteWebsiteURL(id, teamName) {
  const { nuid } = await getServerSession();
  return await deleteDocument({ id, type: 'WebsiteURL' }, validateDocumentDelete, `team-${teamName}-db`);
}
export async function deleteWebsiteURLs(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocuments(query, `team-${teamName}-db`);
}

export async function cloneWebsiteURL(templateQuery, parentId, sourceId, teamName) {
  const existingWebsiteURL = await selectDocumentExt(templateQuery, validateBasicChildSingle, null, `team-${teamName}-db`);
  if (!existingWebsiteURL) {
    return null;
  }

  const { nuid } = await getServerSession();
  const newDocument = { ...existingWebsiteURL };
  delete newDocument._id;

  newDocument.id = sourceId
  newDocument.nuid = nuid;
  newDocument.parentId = parentId;
  newDocument.smartNoteId = parentId;

  const insertedDocument = await insertDocument(newDocument, null, `team-${teamName}-db`);
  return insertedDocument;
}
