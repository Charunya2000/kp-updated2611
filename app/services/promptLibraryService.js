'use server';

import { deleteDocument } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { insertDocument } from '@db/insertDocument';
import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { updateDocument } from '@db/updateDocument';
import { v4 as uuidv4 } from 'uuid';
import {
  validateCreatePromptLibrary, validateGetAllPrompts,
  validateDocumentDelete, validateUpdatePrompt,
  validateSelectLibraryPrompt, validateGetPromptByName, validateBasicSingle
} from './validation';

const documentType = 'PromptLibrary';

export async function createPrompt(document, teamName, assistantName) {
  const { nuid } = await getServerSession();
  document.createdBy = nuid;
  document.updatedBy = nuid;
  document.assistantName = assistantName;
  document.teamName = teamName;
  document.id = uuidv4();
  document.type = documentType;
  document.category = document.category || '';
  document.associatedPersonas = document.associatedPersonas || '';
  return await insertDocument(document, validateCreatePromptLibrary, `team-${teamName}-db`);
}

export async function getAllPrompts(teamName, assistantName) {
  const query = { assistantName, teamName, type: documentType };
  return await selectDocumentsExt(query, validateGetAllPrompts, null, `team-${teamName}-db`);
}

export async function selectPrompt(query, teamName) {
  let document = null;
  try {
    query.type = documentType;
    document = await selectDocumentExt(query, validateSelectLibraryPrompt, null, `team-${teamName}-db`);
  } catch (error) {
    console.error(error);
  }
  return document;
}

export async function getPromptById(id, teamName) {
  const query = { type: documentType, id };
  return await selectDocumentExt(query, validateBasicSingle, null, `team-${teamName}-db`);
}

export async function getPromptByName(name, teamName, assistantName) {
  const query = {
    name: name,
    assistantName,
    type: documentType
  };
  return await selectDocumentExt(query, validateGetPromptByName, null, `team-${teamName}-db`);
}

export async function updatePrompt(document, teamName, assistantName) {
  const { nuid } = await getServerSession();
  document.updatedBy = nuid;
  document.assistantName = assistantName;
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

export async function deletePrompt(query, teamName, assistantName) {
  query.type = documentType;
  query.assistantName = assistantName;
  return await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
}

