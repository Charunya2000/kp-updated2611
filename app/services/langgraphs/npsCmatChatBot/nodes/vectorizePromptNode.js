'use server';
import { vectorize } from '@/app/services/vectorizeDataService';
import { getServerSession } from '@utils/getSession';

async function vectorizeContent({ content, nuid }) {
  try {
    const embedding = await vectorize({
      content: content,
      nuid: nuid
    });
    return embedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    throw error;
  }
}

export const vectorizePromptNode = async (state) => {
  const promptEmbedding = await vectorizeContent({ content: state.userPrompt, nuid: state.nuid });
  return { ...state, promptEmbedding };
};
