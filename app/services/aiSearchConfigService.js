'use server';

import { deleteDocument } from '@db/deleteDocument';
import { insertDocument } from '@db/insertDocument';
import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { updateDocument } from '@db/updateDocument';
import { v4 as uuidv4 } from 'uuid';

import {
  validateDocumentDelete, validateCreateSearchIndex,
  validateBasicMulti, validateGetAllSearchIndex,
  validateUpdateSearchIndex, validateGetPromptByNameForSearchIndex
} from '@services/validation';

const documentType = 'SearchIndexConfig';

export async function getAllSearchIndexes(teamName, assistantName) {
  const query = { type: documentType, assistantName: assistantName };
  try {
    return await selectDocumentsExt(query, validateGetAllSearchIndex, null, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error fetching search indexes:', error);
    throw new Error('Failed to fetch search indexes.');
  }
}

export const getIndexConfigByAssistantId = async (teamName, assistant) => {
  const query = { type: documentType, assistantId: assistant.id };
  return await selectDocumentsExt(query, validateBasicMulti, { projection: { name: 1, indexName: 1, displayName: 1, enabled: 1, id: 1 } }, `team-${teamName}-db`);
}

export const getIndexConfigById = async (id, teamName) => {
  const query = { type: documentType, id: id };
  return await selectDocumentExt(query, validateBasicMulti, null, `team-${teamName}-db`);
}

export async function getSearchIndexByName(name, teamName, assistantName) {
  const query = {
    type: documentType,
    name: name,
    assistantName: assistantName
  };
  return await selectDocumentExt(query, validateGetPromptByNameForSearchIndex, null, `team-${teamName}-db`);
}

export async function updateSearchIndex(id, indexData, teamName) {
  try {
    indexData.type = documentType;

    const query = {
      type: documentType,
      id: id,
    };

    return await updateDocument(indexData, query, validateUpdateSearchIndex, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error updating search index:', error);
    throw new Error('Failed to update search index.');
  }
}

export async function createSearchIndex(indexData, teamName, assistantName) {
  try {
    indexData.id = uuidv4();
    indexData.type = documentType;
    indexData.assistantName = assistantName;

    return await insertDocument(indexData, validateCreateSearchIndex, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error creating search index:', error);
    throw new Error('Failed to create search index.');
  }
}

export async function deleteSearchIndex(id, teamName) {
  try {
    const query = {
      id: id,
      type: documentType,
    };
    return await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error deleting search index:', error);
    throw new Error('Failed to delete search index.');
  }
}


