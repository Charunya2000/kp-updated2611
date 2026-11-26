import { selectRelatedWebsiteURLs } from "@/app/services/actualSourcesService";
import { searchIndex } from "@/app/services/searchVectorDataService";

export const addWebUrlMessagesNode = async (state) => {
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
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 10,
        filter
      });
      return result;
    })
  );
  const filteredWebsiteURLsSearchResults = createMessagesFromWebsiteURLs(websiteURLsSearchResults);

  const totalMessages = [
    ...(Array.isArray(state.totalMessages) ? state.totalMessages : []),
    ...filteredWebsiteURLsSearchResults
  ];

  return { totalMessages };
}

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