import { vectorize } from "../../../vectorizeDataService";

export const vectorizePromptNode = async (state) => {
  const promptEmbedding = await vectorize({ nuid: state.nuid, content: state.chatInteraction.prompt });
  return { promptEmbedding };
};