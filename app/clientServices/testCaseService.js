'use client';

import { prepDocument } from '@clientServices/insertDocument';

/**
 * Client service for managing test cases
 * Provides functions to create, read, update, and delete test cases
 */

/**
 * Get all test cases
 * @param {string} teamName - The name of the team
 * @param {string} assistantName - The name of the assistant
 * @param {string} smartNoteId - The ID of the smart note
 * @returns {Promise<Array>} - Array of test cases
 */
export const getTestCases = async (teamName, assistantName, smartNoteId) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to fetch test cases');
    }

    return await result.json();
  } catch (error) {
    console.error('Error fetching test cases:', error);
    throw error;
  }
};

/**
 * Get a specific test case by ID
 * @param {string} teamName - The name of the team
 * @param {string} assistantName - The name of the assistant
 * @param {string} smartNoteId - The ID of the smart note
 * @param {string} testCaseId - The ID of the test case
 * @returns {Promise<Object>} - The test case object
 */
export const getTestCaseById = async (teamName, assistantName, smartNoteId, testCaseId) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase/${testCaseId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to fetch test case');
    }

    return await result.json();
  } catch (error) {
    console.error(`Error fetching test case ${testCaseId}:`, error);
    throw error;
  }
};

/**
 * Create a new test case
 * @param {string} teamName - The name of the team
 * @param {string} assistantName - The name of the assistant
 * @param {string} smartNoteId - The ID of the smart note
 * @param {Object} testCaseData - The test case data to create
 * @returns {Promise<Object>} - The created test case
 */
export const createTestCase = async (teamName, assistantName, smartNoteId, testCaseData) => {
  try {
    // Prepare the document with proper structure using prepDocument
    const testCase = prepDocument({
      type: 'TestCase',
      smartNoteId: smartNoteId,
      parentId: smartNoteId,
      ...testCaseData
    });

    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCase),
    });

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to create test case');
    }

    return await result.json();
  } catch (error) {
    console.error('Error creating test case:', error);
    throw error;
  }
};

/**
 * Update an existing test case
 * @param {string} teamName - The name of the team
 * @param {string} assistantName - The name of the assistant
 * @param {string} smartNoteId - The ID of the smart note
 * @param {string} testCaseId - The ID of the test case
 * @param {Object} testCaseData - The updated test case data
 * @returns {Promise<Object>} - The updated test case
 */
export const updateTestCase = async (teamName, assistantName, smartNoteId, testCaseId, testCaseData) => {
  try {
    // Use prepDocument with the existing ID to maintain consistent document structure
    // This ensures timestamps are updated and all fields have the right structure
    const testCase = prepDocument({
      type: 'TestCase',
      smartNoteId: smartNoteId,
      parentId: smartNoteId,
      ...testCaseData
    }, testCaseId); // Pass the existing ID to prepDocument

    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase/${testCaseId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCase),
    });

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to update test case');
    }

    return await result.json();
  } catch (error) {
    console.error(`Error updating test case ${testCaseId}:`, error);
    throw error;
  }
};

/**
 * Delete a test case
 * @param {string} teamName - The name of the team
 * @param {string} assistantName - The name of the assistant
 * @param {string} smartNoteId - The ID of the smart note
 * @param {string} testCaseId - The ID of the test case to delete
 * @returns {Promise<Object>} - The result of the delete operation
 */
export const deleteTestCase = async (teamName, assistantName, smartNoteId, testCaseId) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase/${testCaseId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to delete test case');
    }

    return await result.json();
  } catch (error) {
    console.error(`Error deleting test case ${testCaseId}:`, error);
    throw error;
  }
};

/**
 * Import test cases in bulk
 * @param {string} teamName - The name of the team
 * @param {string} assistantName - The name of the assistant
 * @param {string} smartNoteId - The ID of the smart note
 * @param {Array<Object>} testCasesData - Array of test cases to import
 * @returns {Promise<Object>} - The result of the bulk import operation
 */
export const importTestCases = async (teamName, assistantName, smartNoteId, testCasesData) => {
  try {
    // Prepare each test case with proper structure
    const testCases = testCasesData.map(testCaseData =>
      prepDocument({
        type: 'TestCase',
        smartNoteId: smartNoteId,
        parentId: smartNoteId,
        ...testCaseData
      })
    );

    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ testCases }),
    });

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to import test cases');
    }

    return await result.json();
  } catch (error) {
    console.error('Error importing test cases:', error);
    throw error;
  }
};

/**
 * Export test cases as a formatted text file
 * @param {string} teamName - The name of the team
 * @param {string} assistantName - The name of the assistant
 * @param {string} smartNoteId - The ID of the smart note
 * @param {Array<string>} testCaseIds - Array of test case IDs to export
 * @returns {Promise<Blob>} - A blob containing the formatted test cases
 */
export const exportTestCases = async (teamName, assistantName, smartNoteId, testCaseIds) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ testCaseIds }),
    });

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to export test cases');
    }

    // Return the blob directly for download
    return await result.blob();
  } catch (error) {
    console.error('Error exporting test cases:', error);
    throw error;
  }
};

/**
 * Generate test cases from an uploaded document
 * @param {string} teamName - The name of the team
 * @param {string} assistantName - The name of the assistant
 * @param {string} smartNoteId - The ID of the smart note
 * @param {string} uploadedDocumentId - The ID of the uploaded document
 * @param {string} fileDescription - Description of the file
 * @returns {Promise<Object>} - The result of the test case generation
 */
export const generateTestCasesFromDocument = async (teamName, assistantName, smartNoteId, uploadedDocumentId, fileDescription) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uploadedDocumentId, fileDescription }),
    });

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to generate test cases');
    }

    return await result.json();
  } catch (error) {
    console.error('Error generating test cases:', error);
    throw error;
  }
};

/**
 * Update the test case template and get a new download URL
 * @param {string} teamName - The name of the team
 * @param {string} assistantName - The name of the assistant
 * @param {string} smartNoteId - The ID of the smart note
 * @param {Array} testCases - Array of test cases to include in the template
 * @param {string} documentName - Name of the original document (optional)
 * @returns {Promise<Object>} - Object with template download URL
 */
export const updateTestCaseTemplate = async (teamName, assistantName, smartNoteId, testCases, documentName) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/testCase/updateTemplate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ testCases, documentName }),
    });

    if (!result.ok) {
      const errorData = await result.json();
      throw new Error(errorData.error || 'Failed to update test case template');
    }

    return await result.json();
  } catch (error) {
    console.error('Error updating test case template:', error);
    throw error;
  }
};
