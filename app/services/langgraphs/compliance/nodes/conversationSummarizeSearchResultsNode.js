'use server';

export const conversationSummarizeSearchResultsNode = async (state) => {
  const { completionsClient, searchResults, userPrompt } = state;
  const { cognitiveResults = [], mongoResults = [] } = searchResults || {};

  // Prepare context for summarization
  let contextChunks = [];
  if (Array.isArray(cognitiveResults)) {
    contextChunks.push(
      'Cognitive Search Results:',
      ...cognitiveResults.map((doc, i) => `Result ${i + 1}: ${JSON.stringify(doc)}`)
    );
  }
  if (Array.isArray(mongoResults)) {
    contextChunks.push(
      'MongoDB HierarchyNode Results:',
      ...mongoResults.map((doc, i) => `Node ${i + 1}: ${JSON.stringify(doc)}`)
    );
  }
  const contextText = contextChunks.join('\n');

  // Summarization prompt for GPT-4o
  const prompt = `You are a compliance document assistant. Given the following search results and user question, summarize the most relevant information for answering the question.\n\nUser question: ${userPrompt}\n\nSearch results:\n${contextText}\n\nSummarize only the key facts, relationships, and context needed to answer the question. Be concise and accurate.\n\n When you have the full CFR number in the search resutls, be sure to call it out in the summary.`;

  // Call GPT-4o for summarization
  const completion = await completionsClient.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a compliance document assistant.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_completion_tokens: 512
  });
  const summary = completion.choices[0].message.content;

  return {
    ...state,
    searchSummary: summary
  };
};
