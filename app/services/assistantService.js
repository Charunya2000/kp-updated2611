'use server';

import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { validateBasicMulti, validateBasicSingleByName, validateBasicSingle, validateDocumentDelete } from './validation';
import { prepDocument } from '../clientServices/insertDocument';
import { insertDocument } from '@/db/insertDocument';
import { updateDocument } from '@/db/updateDocument';
import { deleteDocument } from '@/db/deleteDocument';

export async function getAssistantByName(teamName, name, options) {
  return await selectDocumentExt({ type: 'Assistant', name }, validateBasicMulti, options, `team-${teamName}-db`);
};

export async function getAssistantById(teamName, id) {
  return await selectDocumentExt({ type: 'Assistant', id: id }, validateBasicSingle, {}, `team-${teamName}-db`);
};

export async function getAllAssistants(teamName) {
  return await selectDocumentsExt(
    { type: 'Assistant' },
    validateBasicMulti,
    { projection: { id: 1, isPublic: 1, isNavRoute: 1, isDeleteSmartNoteEnabled: 1, isHiddenFromSettings: 1, name: 1, category: 1, displayName: 1, description: 1 } },
    `team-${teamName}-db`
  );
}

export async function addAssistant(teamName, assistant) {
  try {
    const { name, displayName, description, category, isPublic, isNavRoute, isDeleteSmartNoteEnabled, isHiddenFromSettings, teamId } = assistant;

    const newAssistant = prepDocument({
      type: 'Assistant',
      name,
      displayName,
      description,
      category,
      isPublic,
      isNavRoute,
      isDeleteSmartNoteEnabled,
      isHiddenFromSettings,
      teamName,
      teamId
    });

    return await insertDocument(newAssistant, validateBasicSingleByName, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error adding assistant:', error);
    return false;
  }
}

export async function updateAssistant(teamName, assistant) {
  try {
    const { name, displayName, description, category, isPublic, isNavRoute, isDeleteSmartNoteEnabled, isHiddenFromSettings, id } = assistant;

    const updatedAssistant = {
      type: 'Assistant',
      name,
      displayName,
      description,
      category,
      isPublic,
      isNavRoute,
      isDeleteSmartNoteEnabled,
      isHiddenFromSettings
    };

    const updateQuery = {
      type: 'Assistant',
      id: id
    };

    return await updateDocument(updatedAssistant, updateQuery, validateBasicSingleByName, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error updating assistant:', error);
    return false;
  }
}

export async function deleteAssistant(teamName, assistant) {
  try {
    const { id } = assistant;

    const query = {
      type: 'Assistant',
      id: id
    };

    return await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error deleting assistant:', error);
    return false;
  }
}