'use server';

import { vectorize } from '@services/vectorizeDataService';
import { getServerSession } from '@utils/getSession';

/**
 * Vectorizes the file description to use for semantic search
 * This node takes the file description from the state and generates a vector embedding
 * that can be used for semantic search of document content
 */
export const vectorizeOriginalPromptNode = async (state) => {
  const { prompt } = state;
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

  try {
    const originalPromptEmbedding = await vectorize({ nuid, content: prompt });

    if (!originalPromptEmbedding || !Array.isArray(originalPromptEmbedding) || originalPromptEmbedding.length === 0) {
      console.error('Vectorization returned empty or invalid embedding');
      return {
        error: 'Vectorization returned invalid embedding',
        originalPromptEmbedding: null
      };
    }

    return { originalPromptEmbedding };
  } catch (error) {
    console.error('Error vectorizing prompt:', error);
    return {
      error: `Failed to vectorize prompt: ${error.message}`,
      originalPromptEmbedding: null
    };
  }
};
