'use server';

import { selectDocuments, selectDocumentCount } from '@db/selectDocument';
import { deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';

export async function selectSmartNotes(teamName) {
  let updatedSmartNotes = [];
  try {
    const { nuid } = await getServerSession();
    const query = { type: 'SmartNote', nuid, parentId: { $exists: true } };
    const smartNotes = await selectDocuments(query, `team-${teamName}-db`);

    updatedSmartNotes = await updateSmartNotesWithCounts(smartNotes, nuid, teamName);

  } catch (error) {
    console.error('Error retrieving smartNotes: ', error);
  }

  return updatedSmartNotes;
}

export async function selectSmartNotesByTeam(teamName, selectedUserAssistant) {
  let updatedSmartNotes = [];
  try {
    const { nuid } = await getServerSession();
    const query = { type: 'SmartNote', nuid, parentId: { $exists: true }, selectedUserAssistant: selectedUserAssistant };
    updatedSmartNotes = await selectDocuments(query, `team-${teamName}-db`);
    updatedSmartNotes = await updateSmartNotesWithCounts(updatedSmartNotes, nuid, teamName);

  } catch (error) {
    console.error('Error retrieving smartNotes: ', error);
  }

  return updatedSmartNotes;
}

export async function deleteSmartNotes(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await deleteDocuments(query, `team-${teamName}-db`);
}

export async function getSmartNoteSourceCounts(smartNoteId, teamName) {
  const { nuid } = await getServerSession();

  return await updateSmartNoteWithCounts({ id: smartNoteId }, nuid, teamName);
}

async function updateSmartNotesWithCounts(smartNotes, nuid, teamName) {
  return await Promise.all(
    smartNotes.map(async (smartNote) => {
      return await updateSmartNoteWithCounts(smartNote, nuid, teamName);
    })
  );
}

async function updateSmartNoteWithCounts(smartNote, nuid, teamName) {
  smartNote.designReferenceCount = await selectDocumentCount({ type: 'DesignReference', nuid, parentId: smartNote.id }, `team-${teamName}-db`);
  smartNote.jiraIssueCount = await selectDocumentCount({ type: 'JiraIssue', nuid, parentId: smartNote.id }, `team-${teamName}-db`);
  smartNote.savedNoteCount = await selectDocumentCount({ type: 'SavedNote', nuid, parentId: smartNote.id }, `team-${teamName}-db`);
  smartNote.savedResponseCount = await selectDocumentCount({ type: 'SavedResponse', nuid, parentId: smartNote.id }, `team-${teamName}-db`);
  smartNote.sourceCount = await selectDocumentCount({ type: 'Source', nuid, parentId: smartNote.id }, `team-${teamName}-db`);
  smartNote.uploadedDocumentCount = await selectDocumentCount({ type: 'UploadedDocument', nuid, parentId: smartNote.id }, `team-${teamName}-db`);
  smartNote.chatInteractionCount = await selectDocumentCount({ type: 'ChatInteraction', nuid, parentId: smartNote.id }, `team-${teamName}-db`);
  return smartNote;
}