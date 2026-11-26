'use server';
import { vectorize } from '@/app/services/vectorizeDataService';

async function vectorizeContent({ content, nuid }) {
  try {
    const embedding = await vectorize({
      content: content,
      nuid: nuid,
    });
    return embedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    throw error;
  }
}

export const vectorizePromptNode = async (inpText, nuid) => {
  const promptEmbedding = await vectorizeContent({ content: inpText, nuid });
  return promptEmbedding;
};
