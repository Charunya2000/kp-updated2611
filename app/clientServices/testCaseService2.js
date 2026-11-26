'use client';

/**
 * Generate QTest test cases for import (alternate workflow)
 * Calls the new API route without uploadedDocumentId or fileDescription
 * @param {string} smartNoteId - The ID of the smart note
 * @returns {Promise<Object>} - The result from the API
 */
export const generateTestCases2 = async (teamName, assistantName, smartNoteId, prompt, llmDirections) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase/generate2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, llmDirections }), // No uploadedDocumentId or fileDescription
    });

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to generate test cases');
    }

    return await result.json();
  } catch (error) {
    console.error('Error generating test cases (alternate workflow):', error);
    throw error;
  }
};

export const saveTestCaseWorkflowNotes = async (teamName, assistantName, smartNoteId, notes) => {
  try {
    const fullNotes = { ...notes, smartNoteId, parentId: smartNoteId, teamName, assistantName };
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase/workflowNotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fullNotes }),
    });

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to save test case workflow notes');
    }

    return await result.json();
  } catch (error) {
    console.error('Error saving test case workflow notes:', error);
    throw error;
  }
};

export const getTestCaseWorkflowNotes = async (teamName, assistantName, smartNoteId) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase/workflowNotes`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to save test case workflow notes');
    }

    const data = await result.json();
    return data;
  } catch (error) {
    console.error('Error saving test case workflow notes:', error);
    throw error;
  }
};

/**
 * Get test case generation progress
 * Polls the progress endpoint to retrieve current status and updates
 * Called repeatedly by the frontend polling loop
 * @param {string} teamName - The team name
 * @param {string} assistantName - The assistant name
 * @param {string} smartNoteId - The ID of the smart note
 * @returns {Promise<Object>} - Progress object with status, sections, counts, download URL
 */
export const getTestCaseGenerationProgress = async (teamName, assistantName, smartNoteId, testCaseGenerationProgressId) => {
  try {
    const result = await fetch(
      `/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase/generate2/progress/${testCaseGenerationProgressId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to fetch test case generation progress');
    }

    const data = await result.json();
    return data;
  } catch (error) {
    console.error('Error fetching test case generation progress:', error);
    throw error;
  }
};
