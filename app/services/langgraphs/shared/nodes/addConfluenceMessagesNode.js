import { searchIndex } from "@/app/services/searchVectorDataService";


export const addConfluenceMessagesNode = async (state) => {
  let confluenceSearchResults = [];

  const confluenceResult = await searchIndex({
    searchIndex: 'kpmc-confluence-002',
    selectFields: ["space", "title", "content"],
    searchEmbedding: state.promptEmbedding,
    nearestNeighbors: 3,
    filter: null
  });
  confluenceSearchResults = createMessagesFromConfliuenceIndex([confluenceResult]);


  const totalMessages = [
    ...(Array.isArray(state.totalMessages) ? state.totalMessages : []),
    ...confluenceSearchResults,
  ];

  return { totalMessages };
}

const createMessagesFromConfliuenceIndex = (designIndexes) => {
  const messages = [];

  designIndexes.forEach(designIndexArray => {
    designIndexArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: Confluence Index - ${result.document.space}/${result.document.title}, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};