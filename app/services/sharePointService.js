'use server';

import { selectDocument, selectDocumentExt, selectDocuments, selectDocumentsExt } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { validateBasicChildSingle, validateBasicMulti, validateBasicSingle, validateSharePointSite } from './validation';


export async function createSharePointFile(document, teamName, assistantName = null) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectSharePointFile(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function selectSharePointFiles(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`);
}

export async function updateSharePointFile(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateSharePointFiles(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, `team-${teamName}-db`);
}

export async function deleteSharePointFile(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);
}

export async function deleteSharePointFiles(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocuments(query, `team-${teamName}-db`);
}

export async function insertSharePointFiles(sharePointFiles, teamName) {
  const { nuid } = await getServerSession();
  sharePointFiles.map(async file => {
    const referenceFile =
    {
      ...file,
      nuid,
      parentId: null
    };
    await insertDocument(referenceFile, null, `team-${teamName}-db`);
  });
  return { result: 'success' };

}

export async function retrieveSharePointFiles(indexName, teamName) {
  const { nuid } = await getServerSession();
  const query = {
    type: 'SharePointFile',
    nuid,
    parentId: null,
    indexName
  };
  const referenceDocumentFiles = selectDocuments(query, `team-${teamName}-db`);
  return referenceDocumentFiles;
}

export async function createSharePointSite(document, teamName) {
  const { nuid } = await getServerSession();
  document.createdByNUID = nuid;
  document.updatedByNUID = nuid;

  return await insertDocument(document, validateSharePointSite, `team-${teamName}-db`);
}

export async function getAllSharePointSites(teamName) {
  const spSites = await selectDocumentsExt({
    type: 'SharePointSite',
  }, validateBasicMulti, null, `team-${teamName}-db`);

  return spSites;
}

export async function getAccessibleSharePointSites(teamName, assistantId) {
  const { nuid } = await getServerSession();

  // get all SharePoint sites accessible to the user
  const spSites = await selectDocumentsExt({
    type: 'SharePointSite',
    assistantIds: { $in: [assistantId] }
  }, validateBasicMulti, null, `team-${teamName}-db`);

  return spSites;
}

export async function updateSharePointSite(document, teamName) {
  const { nuid } = await getServerSession();
  document.createdByNUID = nuid;
  document.updatedByNUID = nuid;
  document.type = 'SharePointSite';

  const query = { id: document.id, type: 'SharePointSite' }

  return await updateDocument(document, query, validateSharePointSite, `team-${teamName}-db`);
}

export async function deleteSharePointSite(document, teamName) {
  const query = { id: document.id, type: 'SharePointSite' }
  const result = await deleteDocument(query, validateBasicSingle, `team-${teamName}-db`);
  return { success: result };
}

export async function cloneSharePointFile(templateQuery, parentId, sourceId, teamName) {
  const existingSharePointFile = await selectDocumentExt(templateQuery, validateBasicChildSingle, null, `team-${teamName}-db`);
  if (!existingSharePointFile) {
    return null;
  }

  const { nuid } = await getServerSession();
  const newDocument = { ...existingSharePointFile };
  delete newDocument._id;

  newDocument.id = sourceId
  newDocument.nuid = nuid;
  newDocument.parentId = parentId;
  newDocument.smartNoteId = parentId;

  const insertedDocument = await insertDocument(newDocument, null, `team-${teamName}-db`);
  return insertedDocument;
}