'use server';

import { vectorize } from '@services/vectorizeDataService';
import { getServerSession } from '@utils/getSession';

/**
 * Vectorizes the file description to use for semantic search
 * This node takes the file description from the state and generates a vector embedding
 * that can be used for semantic search of document content
 */
export const vectorizePromptNode = async (state) => {
  const { fileDescription, documentName } = state;

  let { nuid } = state;

  // If nuid is not in state, get it from session
  if (!nuid) {
    try {
      const session = await getServerSession();
      nuid = session.nuid;
    } catch (error) {
      console.error('Error getting server session:', error);
      return {
        error: `Failed to get user session: ${error.message}`,
        promptEmbedding: null
      };
    }
  }

  if (!fileDescription) {
    return {
      error: 'No file description provided for vectorization',
      promptEmbedding: null
    };
  }

  // Create a search query that combines file description and document name (if available)
  const searchQuery = documentName
    ? `${fileDescription} related to ${documentName}`
    : fileDescription;


  try {
    const promptEmbedding = await vectorize({ nuid, content: searchQuery });

    if (!promptEmbedding || !Array.isArray(promptEmbedding) || promptEmbedding.length === 0) {
      console.error('Vectorization returned empty or invalid embedding');
      return {
        error: 'Vectorization returned invalid embedding',
        promptEmbedding: null
      };
    }

    return { promptEmbedding };
  } catch (error) {
    console.error('Error vectorizing prompt:', error);
    return {
      error: `Failed to vectorize prompt: ${error.message}`,
      promptEmbedding: null
    };
  }
};
