'use server';

import { vectorize } from '@services/vectorizeDataService.js';

export const vectorizePromptNode = async (state) => {
  const promptEmbedding = await vectorize({ nuid: state.nuid, content: state.userPrompt });
  return { promptEmbedding };
};
