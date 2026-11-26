'use server';

import { searchIndex } from '../searchVectorDataService';
import { selectRelatedWebsiteURLs } from '../actualSourcesService';

const createMessagesFromWebsiteURLs = (websiteURLs) => {
  const messages = [];

  websiteURLs.forEach(websiteURLArray => {
    websiteURLArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: Website URL, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};

const websiteURLsNode = async (state) => {
  const foundWebsiteURLs = await selectRelatedWebsiteURLs(state.smartNoteId);
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

export default websiteURLsNode;