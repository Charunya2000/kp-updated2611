import { selectRelatedSavedResponses } from "@/app/services/actualSourcesService";
import { searchIndex } from "@/app/services/searchVectorDataService";

export const addSavedResponseMessagesNode = async (state) => {
  const foundSavedResponses = await selectRelatedSavedResponses(state.smartNoteId, state.teamName);
  const filteredSavedResponses = foundSavedResponses.filter(savedResponse =>
    state.actualSources.some(actualSource => actualSource.sourceId === savedResponse.id)
  );
  const savedResponseSearchResults = await Promise.all(
    filteredSavedResponses.map(async (savedResponse) => {
      const filter = `smartnote_id eq '${savedResponse.parentId}'`;
      const result = await searchIndex({
        searchIndex: 'smartnote-001',
        selectFields: ["smart_type", "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 5,
        filter
      });
      return result;
    })
  );
  const filteredSavedResponseSearchResults = createMessagesFromSavedResponses(savedResponseSearchResults);

  const totalMessages = [
    ...(Array.isArray(state.totalMessages) ? state.totalMessages : []),
    ...filteredSavedResponseSearchResults
  ];

  return { totalMessages };
}

const createMessagesFromSavedResponses = (savedResponses) => {
  const messages = [];

  savedResponses.forEach(savedResponseArray => {
    savedResponseArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: Saved Response, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};