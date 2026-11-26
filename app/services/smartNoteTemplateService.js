import { selectDocumentCount, selectDocumentExt, selectDocumentsExt } from "@/db/selectDocument";
import { validateBasicMulti } from "./validation";
import { getServerSession } from "@/utils/getSession";
import { insertDocument } from "@/db/insertDocument";
import { selectSmartNote } from "./smartNoteService";
import { deleteDocument } from "@/db/deleteDocument";
import { updateDocument } from "@/db/updateDocument";

export const getSmartNoteTemplates = async (teamName, selectedUserAssistant) => {
  try {
    const { nuid } = await getServerSession();

    const query = {
      type: 'SmartNoteTemplate',
      selectedUserAssistant: selectedUserAssistant,
      teamName: teamName,
      $or: [
        { shared: 'assistant' },
        { shared: 'individuals', sharedWith: nuid?.toUpperCase() },
        { shared: 'individuals', nuid: nuid?.toUpperCase() }
      ],
    };

    const templates = await selectDocumentsExt(query, validateBasicMulti, {}, `team-${teamName}-db`);
    console.log(`Fetched templates: ${JSON.stringify(templates)}`);

    if (!templates || templates.length === 0) {
      return [];
    }

    const updatedTemplate = await updateTemplatesWithCounts(templates, teamName);
    return updatedTemplate;
  } catch (error) {
    console.error('Error fetching smart note templates:', error);
    throw new Error('Failed to fetch smart note templates');
  }
}

export const getSmartNoteTemplate = async (id, team) => {
  try {
    const { nuid } = await getServerSession();

    const query = {
      type: 'SmartNoteTemplate',
      smartNoteId: id,
      nuid: nuid,
    };

    const template = await selectDocumentExt(query, validateBasicMulti, {}, `team-${team}-db`);
    if (!template) {
      return null;
    }


    return template;
  } catch (error) {
    console.error('Error fetching smart note templates:', error);
    throw new Error('Failed to fetch smart note templates');
  }
}

export const upsertSmartNoteTemplate = async (id, templateData, teamName) => {
  try {
    const query = { type: 'SmartNote', parentId: { $exists: true }, id: id };
    const smartNote = await selectSmartNote(query, teamName);
    if (!smartNote) {
      return;
    }

    const existingTemplate = await getSmartNoteTemplate(id, smartNote.teamName);
    if (existingTemplate) {
      return await updateSmartNoteTemplate(existingTemplate.id, templateData, teamName);
    }

    const template = {
      type: 'SmartNoteTemplate',
      app: 'SmartNotes',
      selectedUserAssistant: smartNote.selectedUserAssistant,
      title: smartNote.title,
      prelude: smartNote.prelude,
      parentId: null,
      smartNoteId: smartNote.id,
      id: templateData.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      nuid: smartNote.nuid,
      shared: templateData.shared || 'none',
      sharedWith: templateData?.sharedWith,
      teamId: smartNote.teamId,
      teamName: smartNote.teamName,
      assistantId: smartNote.assistantId,
      assistantName: smartNote.assistantName,
    }

    return await insertDocument(template, null, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error creating smart note template:', error);
    throw new Error('Failed to create smart note template');
  }
}

export const deleteSmartNoteTemplate = async (templateId, teamName) => {
  try {
    const { nuid } = await getServerSession();

    const query = {
      type: 'SmartNoteTemplate',
      nuid: nuid,
      id: templateId,
      parentId: null,
    };

    const deleteResult = await deleteDocument(query, validateBasicMulti, `team-${teamName}-db`);

    if (!deleteResult) {
      throw new Error('Template not found or could not be deleted');
    }
    return deleteResult;
  } catch (error) {
    console.error('Error deleting smart note template:', error);
    throw new Error('Failed to delete smart note template');
  }
}

export const updateSmartNoteTemplate = async (id, templateData, teamName) => {
  try {
    const { nuid } = await getServerSession();
    const query = {
      type: 'SmartNoteTemplate',
      nuid: nuid,
      id: id,
      parentId: null,
    };

    const updateData = {
      ...templateData,
      type: 'SmartNoteTemplate',
      nuid: nuid,
      id: id,
      parentId: null
    }

    const updatedTemplate = await updateDocument(updateData, query, null, `team-${teamName}-db`);
    if (!updatedTemplate) {
      throw new Error('Template not found or could not be updated');
    }
    return updatedTemplate;
  } catch (error) {
    console.error('Error updating smart note template:', error);
    throw new Error('Failed to update smart note template');
  }
}

async function updateTemplatesWithCounts(templates, teamName) {
  return await Promise.all(
    templates.map(async (template) => {
      template.designReferenceCount = await selectDocumentCount({ type: 'DesignReference', nuid: template.nuid, parentId: template.smartNoteId }, `team-${teamName}-db`);
      template.jiraIssueCount = await selectDocumentCount({ type: 'JiraIssue', nuid: template.nuid, parentId: template.smartNoteId }, `team-${teamName}-db`);
      template.savedNoteCount = await selectDocumentCount({ type: 'SavedNote', nuid: template.nuid, parentId: template.smartNoteId }, `team-${teamName}-db`);
      template.savedResponseCount = await selectDocumentCount({ type: 'SavedResponse', nuid: template.nuid, parentId: template.smartNoteId }, `team-${teamName}-db`);
      template.sourceCount = await selectDocumentCount({ type: 'Source', nuid: template.nuid, parentId: template.smartNoteId }, `team-${teamName}-db`);
      template.uploadedDocumenteCount = await selectDocumentCount({ type: 'UploadedDocument', nuid: template.nuid, parentId: template.smartNoteId }, `team-${teamName}-db`);
      template.sharePointFileCount = await selectDocumentCount({ type: 'SharePointFile', nuid: template.nuid, parentId: template.smartNoteId }, `team-${teamName}-db`);
      return template;
    })
  );
}

