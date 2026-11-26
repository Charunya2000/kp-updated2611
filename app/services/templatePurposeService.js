'use server';

import { selectDocumentExt, selectDocumentsExt, } from '@db/selectDocument';
import { validateDocumentDelete, validateTemplatePurpose } from './validation';
import { getServerSession } from '@/utils/getSession';
import { updateDocument } from '@/db/updateDocument';
import { deleteDocument } from '@/db/deleteDocument';
import { insertDocument } from '@/db/insertDocument';


export async function getAllTemplatePurposes(teamName) {
  return await selectDocumentsExt({ type: 'TemplatePurpose' }, null, null, `team-${teamName}-db`);
}

export async function getTemplatePurpose(teamName, id) {
  const query = { type: 'TemplatePurpose', id: id };

  return await selectDocumentExt(query, null, null, `team-${teamName}-db`);
}

export async function updateTemplatePurpose(teamName, document) {
  const { nuid } = await getServerSession();
  document.createdByNUID = nuid;
  document.updatedByNUID = nuid;
  document.type = 'TemplatePurpose';

  const query = { id: document.id, type: 'TemplatePurpose' }

  return await updateDocument(document, query, validateTemplatePurpose, `team-${teamName}-db`);
}

export async function deleteTemplatePurpose(teamName, id) {
  const query = { id: id, type: 'TemplatePurpose' }
  const result = await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
  return { success: result };
}

export async function createTemplatePurpose(teamName, document) {
  const { nuid } = await getServerSession();
  document.createdByNUID = nuid;
  document.updatedByNUID = nuid;

  return await insertDocument(document, validateTemplatePurpose, `team-${teamName}-db`);
}