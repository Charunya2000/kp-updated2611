'use server';

import { selectJustSources } from "../../actualSourcesService";

export const filterSourcesNode = async (state) => {
  const actualSources = await selectJustSources(state.smartNoteId, state.teamName);
  const filteredSearchResults = state.searchResults.filter(searchResult =>
    actualSources.some(actualSource => actualSource.sourceId === searchResult.document.id)
  );

  return { actualSources, filteredSearchResults };
};
