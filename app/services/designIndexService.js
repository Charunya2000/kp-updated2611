'use server';

import { selectDocument, selectDocumentExt, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { v4 } from 'uuid';
import { validateBasicChildSingle } from './validation';

export async function createDesignIndex(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectDesignIndex(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function selectDesignIndexs(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`);
}

export async function updateDesignIndex(document, teamName) {
  const { nuid } = await getServerSession();
  // const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateDesignIndexs(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, `team-${teamName}-db`);
}

export async function deleteDesignIndex(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);
}

export async function deleteDesignIndexs(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocuments(query, `team-${teamName}-db`);
}

export async function cloneDesignIndex(templateQuery, parentId, sourceId, teamName) {
  const existingDesignIndex = await selectDocumentExt(templateQuery, validateBasicChildSingle, null, `team-${teamName}-db`);
  if (!existingDesignIndex) {
    return null;
  }

  const { nuid } = await getServerSession();
  const newDocument = { ...existingDesignIndex };
  delete newDocument._id;

  newDocument.nuid = nuid;
  newDocument.parentId = parentId;
  newDocument.id = sourceId

  const insertedDocument = await insertDocument(newDocument, null, `team-${teamName}-db`);
  return insertedDocument;
}
