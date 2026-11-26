'use server';

import { selectDocument, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';

export async function createPostludeMessage(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectPostludeMessage(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function selectPostludeMessages(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`);
}

export async function updatePostludeMessage(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updatePostludeMessages(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, `team-${teamName}-db`);
}

export async function deletePostludeMessage(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);
}

export async function deletePostludeMessages(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocuments(query, `team-${teamName}-db`);
}
