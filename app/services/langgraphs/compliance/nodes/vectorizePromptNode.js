'use server';

async function vectorize(embeddingsClient, content) {
  let searchText = content || '*';
  if (typeof searchText === 'string' && searchText !== '*') {
    searchText = searchText
      // CFR followed directly by number
      .replace(/\b(CFR)(?=\d{1,3}\.\d{1,3})/gi, '$1 ')
      // Number immediately followed by letter (subsection) without space
      .replace(/(\d{1,3}\.\d{1,3})(?=[A-Za-z])(?!\.)/g, '$1 ')
      // Ensure a space after the section number if directly followed by '(' (e.g., 156.220(a)(1)) for clearer token separation (optional)
      .replace(/(\d{1,3}\.\d{1,3})(?=\()/g, '$1 ')
      // Trim and collapse extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  try {
    const { data: [{ embedding }] } = await embeddingsClient.embeddings.create(
      {
        input: searchText,
        model: "text-embedding-ada-002",
      }
    );
    return embedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    throw error;
  }
}

export const vectorizePromptNode = async (state) => {
  const promptEmbedding = await vectorize(state.embeddingsClient, state.userPrompt);
  return { ...state, promptEmbedding };
};
