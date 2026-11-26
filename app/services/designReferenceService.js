'use server';

import { selectDocument, selectDocumentExt, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getDistinctValuesFromIndexes } from '@services/searchVectorDataService';
import { getServerSession } from '@utils/getSession';
import { validateBasicChildSingle } from './validation';

export async function createDesignReference(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectDesignReference(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function selectDesignReferences(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`);
}

export async function updateDesignReference(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateDesignReferences(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, `team-${teamName}-db`);
}

export async function deleteDesignReference(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);
}

export async function deleteDesignReferences(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocuments(query, `team-${teamName}-db`);
}

export async function insertDesignReferenceFiles(designReferences, teamName) {
  const { nuid } = await getServerSession();
  designReferences.map(async designReference => {
    const referenceFile =
    {
      ...designReference,
      nuid,
      parentId: null
    };
    await insertDocument(referenceFile, null, `team-${teamName}-db`);
  }
  );
  return { result: 'success' };
}

export async function retrieveDesignReferenceFiles(indexName, teamName) {
  const { nuid } = await getServerSession();
  const query = {
    type: 'DesignFileReference',
    nuid,
    parentId: null,
    indexName
  };
  const referenceDocumentFiles = selectDocuments(query, `team-${teamName}-db`);
  return referenceDocumentFiles;
}

export async function retrieveDesignReferenceFilesFromSearch() {
  try {
    const cache = await getDistinctValuesFromIndexes();
    return cache;
  } catch (error) {
    console.error('Error retrieving design reference files from search:', error);
    throw error;
  }
}

export async function cloneDesignReference(templateQuery, parentId, sourceId, teamName) {
  const existingDesignFileReference = await selectDocumentExt(templateQuery, validateBasicChildSingle, null, `team-${teamName}-db`);
  if (!existingDesignFileReference) {
    return null;
  }

  const { nuid } = await getServerSession();
  const newDocument = { ...existingDesignFileReference };
  delete newDocument._id;

  newDocument.id = sourceId
  newDocument.nuid = nuid;
  newDocument.parentId = parentId;
  newDocument.smartNoteId = parentId;

  const insertedDocument = await insertDocument(newDocument, null, `team-${teamName}-db`);
  return insertedDocument;
}