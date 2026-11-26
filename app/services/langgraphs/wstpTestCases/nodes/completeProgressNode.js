'use server';

import { completeTestCaseGeneration } from '@/app/services/testCaseService';

/**
 * Complete progress tracking node
 * Finalizes the progress document with the final results (download link and summary message)
 * This node runs after saveTemplateToBlobStorageNode to capture the complete generation results
 * 
 * @param {Object} state - Current state of the graph
 * @returns {Object} - Updated state
 */
export const completeProgressNode = async (state) => {
  const { smartNoteId, teamName, summary, testCaseGenerationProgressId, message, templateDownloadUrl } = state;

  // If progress tracking should not be updated, just pass through
  if (!smartNoteId || !teamName) {
    return {
      message,
      templateDownloadUrl
    };
  }

  try {
    // Update progress with final results
    const results = {
      finalMessage: message,
      templateDownloadUrl: templateDownloadUrl
    };

    await completeTestCaseGeneration(
      teamName,
      smartNoteId,
      testCaseGenerationProgressId,
      summary,
      results
    );

    return {
      message,
      templateDownloadUrl
    };
  } catch (error) {
    console.error('Error completing progress tracking:', error);

    // Log error but don't fail the entire workflow
    // The generation was successful, just the progress tracking update failed
    console.warn('Progress tracking update failed, but generation results are available');

    return {
      message,
      templateDownloadUrl
    };
  }
};
