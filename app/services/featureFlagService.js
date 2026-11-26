import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument } from '@db/updateDocument';
import { deleteDocument } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { validateBasicMulti, validateDocumentDelete } from './validation';
import { v4 } from 'uuid';

const dbType = 'FeatureFlag';

export async function createFeatureFlag(document) {
  const { nuid } = await getServerSession();
  document.id = v4();
  document.createdBy = nuid;
  document.updatedBy = nuid;
  document.type = dbType;
  return await insertDocument(document, validateBasicMulti);
}

export async function getFeatureFlag(name) {
  const query = { name, type: dbType };
  return await selectDocumentExt(query, validateBasicMulti);
}

export async function getFeatureFlags() {
  const query = { type: dbType };
  return await selectDocumentsExt(query, validateBasicMulti);
}

export async function updateFeatureFlag(id, name, updates) {
  const document = updates;
  document.type = dbType;
  document.updatedAt = new Date();
  const query = { id, type: dbType };
  return await updateDocument(document, query, validateBasicMulti);
}

export async function deleteFeatureFlag(id) {
  const query = { id, type: dbType };

  // This fixes an issue where feature falgs were created without an id
  // deletes one random non-id document at a time
  if (!id || id === 'undefined') {
    query.id = { $exists: false };
    return await deleteDocument(query, validateDocumentDelete)
  }

  return await deleteDocument(query, validateDocumentDelete);
}

// use-epds
// Enables UI and backend calling for EPDS inside Insight 360