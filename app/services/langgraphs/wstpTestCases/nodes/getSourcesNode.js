import { selectJustSources } from "@services/actualSourcesService";

export const getSourcesNode = async (state) => {
  const actualSources = await selectJustSources(state.smartNoteId, state.teamName);

  return { actualSources };
};