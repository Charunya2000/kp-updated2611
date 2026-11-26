'use server';

import { selectDocument, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';


/**
 * Create a new test case
 * @param {Object} document - The test case document to create
 * @returns {Promise<Object>} - The created test case
 */
export async function createTestCase(document, teamName) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Set nuid to match savedResponseService.js pattern
    document.nuid = nuid;

    // Insert the document into MongoDB
    const result = await insertDocument(document, null, `team-${teamName}-db`);

    return result;
  } catch (error) {
    console.error('Error creating test case:', error);
    throw error;
  }
}

/**
 * Get all test cases for a smart note
 * @param {string} smartNoteId - The ID of the smart note
 * @returns {Promise<Array<Object>>} - Array of test cases
 */
export async function getTestCases(smartNoteId, teamName) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Get all test cases for this smart note that belong to the current user
    const filter = {
      smartNoteId,
      parentId: smartNoteId,
      nuid, // Ensure we only get test cases for the current user
      type: 'TestCase' // Ensure we only get TestCase documents
    };
    const result = await selectDocuments(filter, `team-${teamName}-db`);

    return result;
  } catch (error) {
    console.error('Error fetching test cases:', error);
    throw error;
  }
}

/**
 * Get a specific test case by ID
 * @param {string} smartNoteId - The ID of the smart note
 * @param {string} testCaseId - The ID of the test case
 * @returns {Promise<Object>} - The test case
 */
export async function getTestCaseById(smartNoteId, testCaseId, teamName) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Create filter to find the specific test case for the current user
    const filter = {
      smartNoteId,
      parentId: smartNoteId,
      id: testCaseId,
      nuid, // Ensure we only get test cases for the current user
      type: 'TestCase' // Ensure we only get TestCase documents
    };

    const result = await selectDocument(filter, `team-${teamName}-db`);

    return result;
  } catch (error) {
    console.error(`Error fetching test case ${testCaseId}:`, error);
    throw error;
  }
}

/**
 * Update a test case
 * @param {Object} document - The test case document to update
 * @returns {Promise<Object>} - The updated test case
 */
export async function updateTestCase(document, teamName) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Set nuid and updatedAt to match savedResponseService.js pattern
    document.nuid = nuid;
    document.updatedAt = new Date();

    // Create filter to find the specific test case
    const filter = {
      smartNoteId: document.smartNoteId,
      id: document.id,
      nuid, // Ensure we only update test cases for the current user
      type: 'TestCase' // Ensure we only update TestCase documents
    };

    // Update the document in MongoDB
    const result = await updateDocument(filter, document, null, `team-${teamName}-db`);

    return result;
  } catch (error) {
    console.error(`Error updating test case ${document.id}:`, error);
    throw error;
  }
}

/**
 * Delete a test case
 * @param {string} smartNoteId - The ID of the smart note
 * @param {string} testCaseId - The ID of the test case to delete
 * @returns {Promise<Object>} - The result of the delete operation
 */
export async function deleteTestCase(smartNoteId, testCaseId, teamName) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Create filter to find the specific test case for the current user
    const filter = {
      smartNoteId,
      id: testCaseId,
      nuid, // Ensure we only delete test cases for the current user
      type: 'TestCase' // Ensure we only delete TestCase documents
    };

    // Delete the document from MongoDB
    const result = await deleteDocument(filter, null, `team-${teamName}-db`);

    return result;
  } catch (error) {
    console.error(`Error deleting test case ${testCaseId}:`, error);
    throw error;
  }
}

/**
 * Import test cases in bulk
 * @param {Array<Object>} testCases - Array of test cases to import
 * @returns {Promise<Object>} - The result of the bulk import operation
 */
export async function importTestCases(testCases, teamName) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Add nuid to each document, matching savedResponseService.js pattern
    testCases.forEach(testCase => {
      testCase.nuid = nuid;
    });

    // Insert all documents
    const results = await Promise.all(
      testCases.map(doc => insertDocument(doc, null, `team-${teamName}-db`))
    );

    return {
      count: results.length,
      results
    };
  } catch (error) {
    console.error('Error importing test cases:', error);
    throw error;
  }
}

/**
 * Export test cases as formatted text
 * @param {string} smartNoteId - The ID of the smart note
 * @param {Array<string>} testCaseIds - Array of test case IDs to export
 * @returns {Promise<string>} - Formatted text of test cases
 */
export async function exportTestCases(smartNoteId, testCaseIds, teamName) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    let testCases;

    // If test case IDs are provided, fetch only those test cases
    if (testCaseIds && testCaseIds.length > 0) {
      const filter = {
        smartNoteId,
        id: { $in: testCaseIds },
        nuid, // Ensure we only export test cases for the current user
        type: 'TestCase' // Ensure we only get TestCase documents
      };
      testCases = await selectDocuments(filter, `team-${teamName}-db`);
    } else {
      // Otherwise, fetch all test cases for this smart note
      testCases = await getTestCases(smartNoteId, teamName);
    }

    // Format the test cases as text
    let formattedText = '';

    testCases.forEach((testCase, index) => {
      if (index > 0) {
        formattedText += '\n\n----------------------------------\n\n';
      }

      formattedText += `Test Case Id: ${testCase.testCaseId || testCase.id}\n`;
      formattedText += `Test Case Name: ${testCase.testCaseName || 'N/A'}\n`;
      formattedText += `Description: ${testCase.description || 'N/A'}\n`;
      formattedText += `Pre-condition: ${testCase.preCondition || 'N/A'}\n\n`;

      // Format steps
      if (testCase.steps && testCase.steps.length > 0) {
        testCase.steps.forEach(step => {
          formattedText += `Step #: ${step.stepNumber}\n`;
          formattedText += `Step Description: ${step.stepDescription || 'N/A'}\n`;
          formattedText += `Expected Result: ${step.expectedResult || 'N/A'}\n\n`;
        });
      }

      formattedText += `Test Case Type: ${testCase.testCaseType || 'N/A'}\n`;
      formattedText += `Test Case Status: ${testCase.testCaseStatus || 'N/A'}\n`;
      formattedText += `Test Case Priority: ${testCase.testCasePriority || 'N/A'}\n`;
      formattedText += `Test Case Assigned To: ${testCase.testCaseAssignedTo || 'N/A'}\n`;

      // Add custom fields if they exist
      if (testCase.customField1) {
        formattedText += `Custom Field 1: ${testCase.customField1}\n`;
      }
      if (testCase.customField2) {
        formattedText += `Custom Field 2: ${testCase.customField2}\n`;
      }
      if (testCase.customField3) {
        formattedText += `Custom Field 3: ${testCase.customField3}\n`;
      }

      formattedText += `Requirement Ids: ${testCase.requirementIds || 'N/A'}\n`;
    });

    return formattedText;
  } catch (error) {
    console.error('Error exporting test cases:', error);
    throw error;
  }
}

/**
 * Save QTest workflow notes
 * Persists workflow notes for a smart note to the database
 * @param {string} teamName - The team name
 * @param {string} assistantName - The assistant name
 * @param {string} smartNoteId - The ID of the smart note
 * @param {Object} notes - The workflow notes object containing instructions and metadata
 * @returns {Promise<Object>} - The saved workflow notes document
 */
export async function saveWorkflowNotes(teamName, assistantName, smartNoteId, notes) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Validate required fields
    if (!notes || !notes.content) {
      throw new Error('Content field is required');
    }

    if (!smartNoteId || !teamName || !assistantName) {
      throw new Error('Missing required parameters: teamName, assistantName, smartNoteId');
    }

    // Structure the workflow notes document
    const workflowNotes = {
      nuid, // Add current user's nuid
      // Preserve any additional metadata from notes
      ...notes,
    };

    // Delete any existing workflow notes for this smart note and user
    const existingFilter = {
      nuid,
      parentId: smartNoteId,
      type: 'QTestWorkflowNotes',
      smartNoteId
    };
    await deleteDocuments(existingFilter, `team-${teamName}-db`);

    // Insert the document into MongoDB using team-specific database
    const result = await insertDocument(workflowNotes, null, `team-${teamName}-db`);

    return result;
  } catch (error) {
    console.error('Error saving workflow notes:', error);
    throw error;
  }
}

/**
 * Get workflow notes for a smart note
 * Retrieves workflow notes associated with a specific smart note
 * @param {string} teamName - The team name
 * @param {string} assistantName - The assistant name
 * @param {string} smartNoteId - The ID of the smart note
 * @returns {Promise<Object|null>} - The workflow notes document or null if not found
 */
export async function getWorkflowNotes(teamName, assistantName, smartNoteId) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Create filter to find workflow notes for this smart note
    const filter = {
      type: 'QTestWorkflowNotes',
      smartNoteId,
      parentId: smartNoteId,
      teamName,
      assistantName,
      nuid, // Ensure we only get workflow notes for the current user
    };
    // Retrieve the document from MongoDB
    const result = await selectDocuments(filter, `team-${teamName}-db`);
    return result;
  } catch (error) {
    console.error('Error retrieving workflow notes:', error);
    throw error;
  }
}

/**
 * Update workflow notes for a smart note
 * Updates existing workflow notes document
 * @param {string} teamName - The team name
 * @param {string} smartNoteId - The ID of the smart note
 * @param {Object} notes - The updated workflow notes object
 * @returns {Promise<Object>} - The updated workflow notes document
 */
export async function updateWorkflowNotes(teamName, smartNoteId, notes) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    if (!notes || !notes.instructions) {
      throw new Error('Instructions field is required');
    }

    // Create filter to find the specific workflow notes for the current user
    const filter = {
      type: 'QTestWorkflowNotes',
      smartNoteId,
      nuid, // Ensure we only update workflow notes for the current user
    };

    // Update metadata
    notes.updatedAt = new Date();
    notes.characterCount = notes.instructions.length;

    // Update the document in MongoDB
    const result = await updateDocument(filter, notes, null, `team-${teamName}-db`);

    return result;
  } catch (error) {
    console.error('Error updating workflow notes:', error);
    throw error;
  }
}

/**
 * Delete workflow notes for a smart note
 * Removes workflow notes document from the database
 * @param {string} teamName - The team name
 * @param {string} smartNoteId - The ID of the smart note
 * @returns {Promise<Object>} - The result of the delete operation
 */
export async function deleteWorkflowNotes(teamName, smartNoteId) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Create filter to find the specific workflow notes for the current user
    const filter = {
      type: 'QTestWorkflowNotes',
      smartNoteId,
      nuid, // Ensure we only delete workflow notes for the current user
    };

    // Delete the document from MongoDB
    const result = await deleteDocument(filter, null, `team-${teamName}-db`);

    return result;
  } catch (error) {
    console.error('Error deleting workflow notes:', error);
    throw error;
  }
}

/**
 * Initialize test case generation progress tracking
 * Creates a progress document to track generation across multiple sections
 * @param {string} teamName - The team name
 * @param {string} smartNoteId - The ID of the smart note
 * @param {Array<Object>} sections - Array of document sections with shortTopic
 * @returns {Promise<Object>} - The created progress document
 */
export async function initializeTestCaseGenerationProgress(teamName, smartNoteId, testCaseGenerationProgressId, sections) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Create progress document
    const progressDoc = {
      id: testCaseGenerationProgressId,
      type: 'TestCaseGenerationProgress',
      smartNoteId,
      parentId: smartNoteId,
      nuid,
      status: 'in_progress', // in_progress, completed, failed
      startedAt: new Date(),
      sections: sections.map(section => ({
        shortTopic: section.shortTopic || section.short_topic,
        status: 'pending', // pending, in_progress, completed, error
        testCaseCount: 0,
        error: null
      })),
      totalSectionsCount: sections.length,
      completedSectionsCount: 0,
      totalTestCasesCount: 0,
      lastUpdatedAt: new Date()
    };

    // Insert the progress document
    const result = await insertDocument(progressDoc, null, `team-${teamName}-db`);

    return result.id;
  } catch (error) {
    console.error('Error initializing test case generation progress:', error);
    throw error;
  }
}

/**
 * Get test case generation progress
 * Retrieves the current progress of test case generation for a smart note
 * @param {string} teamName - The team name
 * @param {string} smartNoteId - The ID of the smart note
 * @returns {Promise<Object|null>} - The progress document or null if not found
 */
export async function getTestCaseGenerationProgress(teamName, smartNoteId, testCaseGenerationProgressId) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Create filter to find progress document
    const filter = {
      id: testCaseGenerationProgressId,
      type: 'TestCaseGenerationProgress',
      smartNoteId,
      parentId: smartNoteId,
      nuid // Ensure we only get progress for the current user
    };

    // Retrieve the progress document
    const result = await selectDocument(filter, `team-${teamName}-db`);
    return result;
  } catch (error) {
    console.error('Error fetching test case generation progress:', error);
    throw error;
  }
}

/**
 * Update section progress during test case generation
 * Updates the progress for a specific section during generation
 * @param {string} teamName - The team name
 * @param {string} smartNoteId - The ID of the smart note
 * @param {string} progressDocId - The ID of the progress document
 * @param {number} sectionIndex - The index of the section being processed
 * @param {Object} updateData - Object with status, testCaseCount, and optional error
 * @returns {Promise<Object>} - The updated progress document
 */
export async function updateSectionProgress(teamName, smartNoteId, progressDocId, sectionIndex, updateData) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Find the current progress document
    const filter = {
      type: 'TestCaseGenerationProgress',
      smartNoteId,
      parentId: smartNoteId,
      id: progressDocId,
      nuid
    };

    const progressDoc = await selectDocument(filter, `team-${teamName}-db`);

    if (!progressDoc) {
      throw new Error('Progress document not found');
    }

    // Update the specific section
    if (progressDoc.sections && progressDoc.sections[sectionIndex]) {
      progressDoc.sections[sectionIndex].status = updateData.status || progressDoc.sections[sectionIndex].status;
      progressDoc.sections[sectionIndex].testCaseCount = updateData.testCaseCount || progressDoc.sections[sectionIndex].testCaseCount;

      if (updateData.error) {
        progressDoc.sections[sectionIndex].error = updateData.error;
      }
    } else {
      throw new Error('Section index out of bounds');
    }

    // Recalculate totals
    let completedCount = 0;
    let totalTestCases = 0;

    progressDoc.sections.forEach(section => {
      if (section.status === 'completed' || section.status === 'error') {
        completedCount++;
      }
      totalTestCases += section.testCaseCount;
    });

    progressDoc.completedSectionsCount = completedCount;
    progressDoc.totalTestCasesCount = totalTestCases;
    progressDoc.lastUpdatedAt = new Date();

    // If all sections are completed, update overall status
    if (completedCount === progressDoc.totalSectionsCount) {
      progressDoc.status = 'sectionsCompleted';
      progressDoc.completedAt = new Date();
    }

    // Update the document in MongoDB
    const result = await updateDocument(progressDoc, filter, null, `team-${teamName}-db`);
    return result;
  } catch (error) {
    console.error('Error updating section progress:', error);
    throw error;
  }
}

/**
 * Mark test case generation as completed
 * Finalizes the progress document when generation is complete with results
 * @param {string} teamName - The team name
 * @param {string} smartNoteId - The ID of the smart note
 * @param {Object} summaryData - Object with sections array and totalTestCasesCount
 * @param {Object} results - Final results object with finalMessage and templateDownloadUrl
 * @returns {Promise<Object>} - The updated progress document
 */
export async function completeTestCaseGeneration(teamName, smartNoteId, progressId, summaryData, results = {}) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Find the current progress document
    const filter = {
      type: 'TestCaseGenerationProgress',
      smartNoteId,
      parentId: smartNoteId,
      nuid
    };
    filter.id = progressId;
    const progressDoc = await selectDocument(filter, `team-${teamName}-db`);

    if (!progressDoc) {
      throw new Error('Progress document not found');
    }

    // Update with final summary data
    if (summaryData && summaryData.sections) {
      progressDoc.sections = summaryData.sections.map((section, index) => ({
        ...progressDoc.sections[index],
        shortTopic: section.shortTopic,
        testCaseCount: section.testCaseCount,
        status: 'completed'
      }));
    }

    progressDoc.totalTestCasesCount = summaryData?.totalTestCasesCount || 0;
    progressDoc.completedSectionsCount = progressDoc.totalSectionsCount;
    progressDoc.status = 'completed';

    // Add final results if provided
    if (results) {
      if (results.finalMessage) {
        progressDoc.finalMessage = results.finalMessage;
      }
      if (results.templateDownloadUrl) {
        progressDoc.templateDownloadUrl = results.templateDownloadUrl;
      }
    }

    progressDoc.completedAt = new Date();
    progressDoc.lastUpdatedAt = new Date();

    // Update the document in MongoDB
    const result = await updateDocument(progressDoc, filter, null, `team-${teamName}-db`);
    return result;
  } catch (error) {
    console.error('Error completing test case generation:', error);
    throw error;
  }
}

/**
 * Mark test case generation as failed
 * Updates progress document to indicate failure
 * @param {string} teamName - The team name
 * @param {string} smartNoteId - The ID of the smart note
 * @param {string} errorMessage - The error message
 * @returns {Promise<Object>} - The updated progress document
 */
export async function failTestCaseGeneration(teamName, smartNoteId, errorMessage) {
  try {
    // Get current user session
    const { nuid } = await getServerSession();

    // Find the current progress document
    const filter = {
      type: 'TestCaseGenerationProgress',
      smartNoteId,
      parentId: smartNoteId,
      nuid
    };

    const progressDoc = await selectDocument(filter, `team-${teamName}-db`);

    if (!progressDoc) {
      throw new Error('Progress document not found');
    }

    progressDoc.status = 'failed';
    progressDoc.error = errorMessage;
    progressDoc.failedAt = new Date();
    progressDoc.lastUpdatedAt = new Date();

    // Update the document in MongoDB
    const result = await updateDocument(filter, progressDoc, null, `team-${teamName}-db`);

    return result;
  } catch (error) {
    console.error('Error marking test case generation as failed:', error);
    throw error;
  }
}
