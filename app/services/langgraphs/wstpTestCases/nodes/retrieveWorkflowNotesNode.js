'use server';

import { getWorkflowNotes } from '@services/testCaseService';

/**
 * Retrieve workflow notes for the smart note
 * Fetches workflow notes that contain user-provided instructions
 * for test case generation
 * 
 * @param {Object} state - Current LangGraph state
 * @returns {Promise<Object>} - Updated state with workflowNotes
 */
export async function retrieveWorkflowNotesNode(state) {
  const { smartNoteId, teamName, assistantName } = state;

  try {
    // Get workflow notes from the database
    const workflowNotes = await getWorkflowNotes(teamName, assistantName, smartNoteId);
    const workflowNotesContent = workflowNotes?.map(note => note.content) || [];

    return {
      workflowNotes: workflowNotesContent || null,
    };
  } catch (error) {
    console.error('Error retrieving workflow notes:', error);
    return {
      workflowNotes: null,
      error: `Failed to retrieve workflow notes: ${error.message}`,
    };
  }
}
