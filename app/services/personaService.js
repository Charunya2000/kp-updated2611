'use server';

import { deleteDocument } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { insertDocument } from '@db/insertDocument';
import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { updateDocument } from '@db/updateDocument';
import { v4 as uuidv4 } from 'uuid';
import {
  validateAdminTabCreate, validateGetAllPrompts,
  validateSelectPersona, validateDocumentDelete,
  validateUpdatePrompt, validateGetPromptByName, validateBasicSingle
} from './validation';

const documentType = 'Persona';

export async function createPersona(document, teamName, assistantName) {
  const { nuid } = await getServerSession();
  document.createdBy = nuid;
  document.updatedBy = nuid;
  document.assistantName = assistantName;
  document.teamName = teamName;
  document.id = uuidv4();
  document.type = documentType;
  document.associatedGraph = document.associatedGraph || 'Default Graph';
  return await insertDocument(document, validateAdminTabCreate, `team-${teamName}-db`);
}

export async function getAllPersonas(teamName, assistantName) {
  const query = { assistantName, teamName, type: documentType };
  return await selectDocumentsExt(query, validateGetAllPrompts, null, `team-${teamName}-db`);
}

export async function getPersonaById(id, teamName) {
  const query = { type: documentType, id };
  return await selectDocumentExt(query, validateBasicSingle, null, `team-${teamName}-db`);
}

export async function getPersonaByName(name, teamName, assistantName) {
  const query = {
    name: name,
    assistantName,
    type: documentType
  };
  return await selectDocumentExt(query, validateGetPromptByName, null, `team-${teamName}-db`);
}

export async function selectPersona(query, teamName) {
  let document = null;
  try {
    query.type = documentType;
    document = await selectDocumentExt(query, validateSelectPersona, null, `team-${teamName}-db`);
  } catch (error) {
    console.error(error);
  }
  return document;
}

export async function updatePersona(document, teamName, assistantName) {
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

export async function deletePersona(query, teamName, assistantName) {
  query.type = documentType;
  query.assistantName = assistantName;
  return await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
}

