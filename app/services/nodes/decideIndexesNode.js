'use server';

import { chatCompletionPrompts } from '../chatCompletionService2';

const basicQuestions = [
  "What are the KMPC value streams?",
  "What are the products of a value streams?",
  "What is the basic architecture of KPMC?"
];

const decideIndexesNode = async (state) => {
  const indexes = [
    { node: 'designReferencesNode', usefulFor: 'If prompt includes a reference to a design document or if the prompt may be enhanced by checking design documents.' },
    { node: 'savedResponsesNode', usefulFor: 'If the prompt seems to refer to prior prompt/response interactions.' },
    { node: 'designIndexesNode', usefulFor: 'If prompt did not specify specific design and the prompt is not a basic question. Design indexes and related information' },
    { node: 'confluenceNode', usefulFor: `If the prompt is asking something like one of the basic questions: ${basicQuestions.join(', ')}` },
    { node: 'websiteURLsNode', usefulFor: 'If prompt' },
    { node: 'uploadedDocumentsNode', usefulFor: 'Uploaded documents and files' }
  ];

  const contextMessages = [
    {
      role: "system",
      content: state.systemMessage
    },
    {
      role: "user",
      content: `Based on the prompt "${state.chatInteraction.prompt}", which of the following indexes should be included? Respond with the names of the indexes to be included, separated by commas.\n\n` +
        indexes.map(index => `${index.node}: ${index.usefulFor}`).join('\n')
    },
    {
      role: "user",
      content: `If 'confluenceNode' is chosen, then other nodes can be removed from your response.`
    },
    {
      role: "user",
      content: `For each included index, also provide a nearestNeighbors value based on whether the question is broad or narrow. A broad question should have a higher nearestNeighbors value, while a narrow question should have a lower nearestNeighbors value.`
    }
  ];

  const inclusionResponse = await chatCompletionPrompts({ messages: contextMessages, teamName: state?.teamName, assistantName: state?.assistantName });
  const includedIndexes = inclusionResponse.split(',').map(index => index.trim());

  const nearestNeighborsSettings = {};
  includedIndexes.forEach(index => {
    const match = inclusionResponse.match(new RegExp(`${index}: nearestNeighbors=(\\d+)`));
    if (match) {
      nearestNeighborsSettings[index] = parseInt(match[1], 10);
    }
  });

  return { includedIndexes, nearestNeighborsSettings };
};

export default decideIndexesNode;