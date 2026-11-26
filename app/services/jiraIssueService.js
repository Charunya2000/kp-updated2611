'use server';

import { selectDocument, selectDocumentExt, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { validateBasicChildSingle } from './validation';
import { recordJiraIssue } from '@services/statisticsService';

export async function createJiraIssue(document, teamName, assistantName = null) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  await recordJiraIssue(nuid, null, teamName, assistantName);
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectJiraIssue(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function selectJiraIssues(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`);
}

export async function updateJiraIssue(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateJiraIssues(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, `team-${teamName}-db`);
}

export async function deleteJiraIssue(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);
}

export async function deleteJiraIssues(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocuments(query, `team-${teamName}-db`);
}

export async function cloneJiraIssue(templateQuery, parentId, sourceId, teamName) {
  const existingJiraIssue = await selectDocumentExt(templateQuery, validateBasicChildSingle, null, `team-${teamName}-db`);
  if (!existingJiraIssue) {
    return null;
  }

  const { nuid } = await getServerSession();
  const newDocument = { ...existingJiraIssue };
  delete newDocument._id;

  newDocument.id = sourceId;
  newDocument.nuid = nuid;
  newDocument.parentId = parentId;
  newDocument.smartNoteId = parentId;

  const insertedDocument = await insertDocument(newDocument, null, `team-${teamName}-db`);

  return insertedDocument;
}
