import { searchIndex } from '@services/searchVectorDataService';
import { selectRelatedWebsiteURLs } from '@services/actualSourcesService';

const createMessagesFromWebsiteURLs = (websiteURLs) => {
  const contents = [];

  websiteURLs.forEach(websiteURLArray => {
    websiteURLArray.forEach(result => {
      contents.push(result.document.content);
    });
  });

  return contents.join(' ');
};

export const websiteURLsNode = async (state) => {
  const foundWebsiteURLs = await selectRelatedWebsiteURLs(state.smartNoteId, state.teamName);
  const filteredWebsiteURLs = foundWebsiteURLs.filter(websiteURL =>
    state.actualSources.some(actualSource => actualSource.sourceId === websiteURL.id)
  );
  const websiteURLsSearchResults = await Promise.all(
    filteredWebsiteURLs.map(async (websiteURL) => {
      const filter = `smart_type eq 'WebsiteURL' and smartnote_id eq '${websiteURL.parentId}'`;
      const result = await searchIndex({
        searchIndex: 'smartnote-001',
        selectFields: ["smart_type", "content"],
        searchEmbedding: state.originalPromptEmbedding,
        nearestNeighbors: 5,
        filter
      });
      return result;
    })
  );
  const filteredWebsiteURLsSearchResults = createMessagesFromWebsiteURLs(websiteURLsSearchResults);
  return { filteredWebsiteURLsSearchResults };
};
