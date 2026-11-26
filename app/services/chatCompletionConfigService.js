import { deleteDocument } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { insertDocument } from '@db/insertDocument';
import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { updateDocument } from '@db/updateDocument';
import { v4 as uuidv4 } from 'uuid';
import {
  validateGetAllPrompts, validateBasicSingle,
  validateUpdatePrompt, validateDocumentDelete,
  validateCreateChatCompletions,
  validateSelectSystemPrompt
} from './validation';

const documentType = 'ChatCompletionConfig';

export async function createChatCompletionConfig(document, teamName, assistantName) {

  const { nuid } = await getServerSession();
  document.createdBy = nuid;
  document.updatedBy = nuid;
  document.assistantName = assistantName;
  document.id = uuidv4();
  document.type = documentType;
  return await insertDocument(document, validateCreateChatCompletions, `team-${teamName}-db`);
}

export async function getAllChatCompletionConfigs(teamName, assistantName) {
  const query = { assistantName, type: documentType };
  return await selectDocumentsExt(query, validateGetAllPrompts, null, `team-${teamName}-db`);
}

export async function getDefaultChatCompletionConfig(teamName, assistantName) {
  const query = { assistantName, type: documentType, default: true };
  return await selectDocumentExt(query, validateSelectSystemPrompt, null, `team-${teamName}-db`);
}

export async function getChatCompletionConfigById(id, teamName) {
  const query = { type: documentType, id };
  return await selectDocumentExt(query, validateBasicSingle, null, `team-${teamName}-db`);
}

export async function updateChatCompletionConfig(document, teamName, assistantName) {
  const { nuid } = await getServerSession();
  document.updatedBy = nuid;
  document.assistantName = assistantName;
  document.type = documentType;
  const query = { id: document.id, type: documentType };
  return await updateDocument(document, query, validateUpdatePrompt, `team-${teamName}-db`);
}

export async function deleteChatCompletionConfig(id, teamName) {
  return await deleteDocument({ type: documentType, id: id }, validateDocumentDelete, `team-${teamName}-db`);
}