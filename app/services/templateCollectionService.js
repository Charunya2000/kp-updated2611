'use server';

import { selectDocumentExt, selectDocumentsExt, } from '@db/selectDocument';
import { validateDocumentDelete, validateTemplateCollection, validateBasicSingle, validateBasicMulti } from './validation';
import { getServerSession } from '@/utils/getSession';
import { updateDocument } from '@/db/updateDocument';
import { deleteDocument } from '@/db/deleteDocument';
import { insertDocument } from '@/db/insertDocument';


export async function getAllTemplateCollections(teamName) {
  return await selectDocumentsExt({ type: 'TemplateCollection' }, validateBasicMulti, null, `team-${teamName}-db`);
}

export async function getTemplateCollection(teamName, id) {
  const query = { type: 'TemplateCollection', id: id };

  return await selectDocumentExt(query, validateBasicSingle, null, `team-${teamName}-db`);
}

export async function updateTemplateCollection(teamName, document) {
  const { nuid } = await getServerSession();
  document.createdByNUID = nuid;
  document.updatedByNUID = nuid;
  document.type = 'TemplateCollection';

  const query = { id: document.id, type: 'TemplateCollection' }

  return await updateDocument(document, query, validateTemplateCollection, `team-${teamName}-db`);
}

export async function deleteTemplateCollection(teamName, id) {
  const query = { id: id, type: 'TemplateCollection' }
  const result = await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
  return { success: result };
}

export async function createTemplateCollection(teamName, document) {
  const { nuid } = await getServerSession();
  document.createdByNUID = nuid;
  document.updatedByNUID = nuid;

  return await insertDocument(document, validateTemplateCollection, `team-${teamName}-db`);
}