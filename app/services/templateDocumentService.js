'use server';

import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument } from '@db/updateDocument';
import { deleteDocument } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { validateDocumentDelete, validateTemplateDocument, validateBasicMulti, validateBasicSingle } from './validation';

export async function getTemplateDocument(teamName, id) {
  const query = { type: 'TemplateDocument', id: id };

  return await selectDocumentExt(query, validateBasicSingle, null, `team-${teamName}-db`);
}

export async function updateTemplateDocument(teamName, document) {
  const { nuid } = await getServerSession();
  document.createdByNUID = nuid;
  document.updatedByNUID = nuid;
  document.type = 'TemplateDocument';

  const query = { id: document.id, type: 'TemplateDocument' }

  return await updateDocument(document, query, validateTemplateDocument, `team-${teamName}-db`);
}

export async function deleteTemplateDocument(teamName, id) {
  const query = { id: id, type: 'TemplateDocument' }
  const result = await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
  return { success: result };
}

export async function createTemplateDocument(teamName, document) {
  const { nuid } = await getServerSession();
  document.createdByNUID = nuid;
  document.updatedByNUID = nuid;

  return await insertDocument(document, validateTemplateDocument, `team-${teamName}-db`);
}

export async function getAllTemplateDocuments(teamName) {
  return await selectDocumentsExt({ type: 'TemplateDocument' }, validateBasicMulti, null, `team-${teamName}-db`);
}