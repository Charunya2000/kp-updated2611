'use server';

export const assistantResponseNode = async (state) => {
  try {
    const { completionsClient, searchSummary, userPrompt } = state;

    const prompt = `You are a compliance assistant. Based on the following summarized search results, answer the user's question.\n\nUser question: ${userPrompt}\n\nSearch summary:\n${searchSummary}. Respond in markdown.`;

    const response = await completionsClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a compliance assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });

    const conversationResponse = response.content || response.choices?.[0]?.message?.content;

    return {
      ...state,
      conversationResponse
    };
  } catch (error) {
    console.error('Error in assistantResponseNode:', error);
    return { ...state, error: error.message };
  }
};