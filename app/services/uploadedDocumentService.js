'use server';

import { selectDocument, selectDocumentExt, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { deleteFromIndex } from '@services/deleteFromVectorDataService.js';
import { recordUploadedDocument, recordSharePointSource } from '@services/statisticsService';
import { v4 } from 'uuid';
import { validateBasicChildSingle } from './validation';

export async function createUploadedDocument(document, teamName, assistantName = null) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  if (document.type === 'SharePointFile') {
    recordSharePointSource(nuid, null, teamName, assistantName);
  } else {
    recordUploadedDocument(nuid, null, teamName, assistantName);
  }
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectUploadedDocument(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function selectUploadedDocuments(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`);
}

export async function getUploadedDocument(teamName, assistantName, parentId, documentId) {
  const { nuid } = await getServerSession();
  const query = { id: documentId, nuid, type: 'UploadedDocument', parentId };
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function updateUploadedDocument(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateUploadedDocuments(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, `team-${teamName}-db`);
}

export async function deleteUploadedDocument(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);

}

export async function deleteUploadedDocumentFromIndex(query) {
  const response = await deleteFromIndex({ searchIndex: 'smartnote-file-002', filter: `smartnote_id eq '${query.smartNoteId}' and smart_file_name eq '${query.fileName}'` });
  return response;
}

export async function deleteUploadedDocuments(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await deleteDocuments(query, `team-${teamName}-db`);
}

export async function cloneUploadedDocument(query, parentId, sourceId, teamName) {
  const existingUploadedDocument = await selectDocumentExt(query, validateBasicChildSingle, null, `team-${teamName}-db`);
  if (!existingUploadedDocument) {
    return null;
  }

  const { nuid } = await getServerSession();
  const newDocument = { ...existingUploadedDocument };
  delete newDocument._id;

  newDocument.id = sourceId;
  newDocument.nuid = nuid;
  newDocument.parentId = parentId;
  newDocument.smartNoteId = parentId;

  const insertedDocument = await insertDocument(newDocument, null, `team-${teamName}-db`);
  return insertedDocument;
}
