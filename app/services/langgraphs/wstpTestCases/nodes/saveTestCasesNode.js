'use server';

import { insertDocument } from '@db/insertDocument';
import { v4 as uuidv4 } from 'uuid';

export const saveTestCasesNode = async (state) => {
  const { testCases, smartNoteId, nuid } = state;

  if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
    return {
      savedTestCases: [],
      error: state.error || 'No test cases available to save'
    };
  }

  try {
    // Prepare test cases with proper document structure and IDs
    const testCasesWithMetadata = testCases.map(testCase => {
      // Create a document with the prepDocument pattern
      // This is a server-side implementation of the client-side pattern
      return {
        ...testCase,
        type: 'TestCase',
        id: uuidv4(), // Generate ID server-side for this automation workflow
        smartNoteId,
        parentId: smartNoteId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: nuid,
        updatedBy: nuid
      };
    });

    // Save test cases to the database
    const savedTestCases = await Promise.all(
      testCasesWithMetadata.map(testCase =>
        insertDocument(testCase, null, `team-${state.teamName}-db`)
      )
    );

    return {
      savedTestCases,
      message: `Successfully saved ${savedTestCases.length} test cases`
    };
  } catch (error) {
    console.error('Error saving test cases:', error);
    return {
      savedTestCases: [],
      error: `Error saving test cases: ${error.message}`
    };
  }
};
