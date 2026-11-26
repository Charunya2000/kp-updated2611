'use server';

import { searchIndex } from '../searchVectorDataService';

const createMessagesFromChangeRequests = (changeRequests) => {
  const messages = [];

  changeRequests.forEach(changeRequestArray => {
    changeRequestArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: ${result.document.document_name}, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};

const changeRequestsNode = async (state) => {
  const foundChangeRequests = state.actualSources.filter(source => source.indexName === 'kpmc-cr-001');
  const changeRequestSearchResults = await Promise.all(
    foundChangeRequests.map(async (changeRequest) => {
      let filter;
      const integerCheck = /\d+/;
      if (integerCheck.test(state.chatInteraction.prompt) && (state.chatInteraction.prompt.match(integerCheck) || []).length === 1) {
        const numberString = state.chatInteraction.prompt.match(integerCheck)[0];
        filter = `cr_id eq '${numberString}'`;
      }
      const nearestNeighbors = state.nearestNeighborsSettings['changeRequestsNode'] || 2;
      const result = await searchIndex({
        searchIndex: 'kpmc-cr-001',
        selectFields: ["document_name", "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: nearestNeighbors,
        filter: filter
      });
      return result;
    })
  );
  const filteredChangeRequestSearchResults = createMessagesFromChangeRequests(changeRequestSearchResults);
  return { filteredChangeRequestSearchResults };
};

export default changeRequestsNode;