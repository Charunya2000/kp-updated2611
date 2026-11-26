'use server';

import { deleteDocument } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { insertDocument } from '@db/insertDocument';
import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { updateDocument } from '@db/updateDocument';
import { v4 as uuidv4 } from 'uuid';
import {
  validateAdminTabCreate, validateGetAllPrompts,
  validateSelectSystemPrompt, validateDocumentDelete,
  validateUpdatePrompt, validateGetPromptByName, validateBasicSingle
} from './validation';

const documentType = 'SystemPrompt';

export async function createSystemPrompt(document, teamName, assistantName) {
  const { nuid } = await getServerSession();
  document.createdBy = nuid;
  document.updatedBy = nuid;
  document.assistantName = assistantName;
  document.teamName = teamName;
  document.id = uuidv4();
  document.type = documentType;
  return await insertDocument(document, validateAdminTabCreate, `team-${teamName}-db`);
}

export async function getAllSystemPrompts(teamName, assistantName) {
  const { nuid } = await getServerSession();
  const query = { assistantName, teamName, type: documentType };
  return await selectDocumentsExt(query, validateGetAllPrompts, null, `team-${teamName}-db`);
}
export async function getSystemPromptByName(name, teamName, assistantName) {
  const query = {
    name: name,
    assistantName,
    type: documentType
  };
  return await selectDocumentExt(query, validateGetPromptByName, null, `team-${teamName}-db`);
}

export async function getSystemPromptById(id, teamName) {
  const query = { type: documentType, id };
  return await selectDocumentExt(query, validateBasicSingle, null, `team-${teamName}-db`);
}

export async function selectSystemPrompt(query, teamName) {
  let document = null;
  try {
    query.type = documentType;
    document = await selectDocumentExt(query, validateSelectSystemPrompt, null, `team-${teamName}-db`);
  } catch (error) {
    console.error(error);
  }
  return document;
}

export async function updateSystemPrompt(document, teamName, assistantName) {
  const { nuid } = await getServerSession();
  document.updatedBy = nuid;
  document.assistantName = assistantName
  document.teamName = teamName;
  document.type = documentType;

  const query = {
    id: document.id,
    type: documentType,
    teamName,
    assistantName
  };

  return await updateDocument(document, query, validateUpdatePrompt, `team-${teamName}-db`);
}

export async function deleteSystemPrompt(query, teamName, assistantName) {
  const { nuid } = await getServerSession();
  query.type = documentType;
  query.assistantName = assistantName;
  return await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
}
