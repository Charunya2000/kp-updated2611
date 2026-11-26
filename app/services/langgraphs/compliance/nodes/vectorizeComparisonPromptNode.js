'use server';

async function vectorize(embeddingsClient, content) {
  try {
    const { data: [{ embedding }] } = await embeddingsClient.embeddings.create(
      {
        input: content,
        model: "text-embedding-ada-002",
      }
    );
    return embedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    throw error;
  }
}

export const vectorizeComparisonPromptNode = async (state) => {
  const { updateChatInteractionProgress } = await import('../helpers/progressTracking');

  // Initialize progress if needed
  let progressResponse = state.progressResponse || "## Comparison Progress\n\n";
  progressResponse += "⏳ Vectorizing comparison prompt...\n\n---\n";

  // Update progress
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  try {
    const promptEmbedding = await vectorize(state.embeddingsClient, state.userPrompt);

    // Mark as complete
    progressResponse = progressResponse.replace("⏳ Vectorizing", "✓ Vectorizing");

    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    return { ...state, promptEmbedding, progressResponse };
  } catch (error) {
    console.error('Error in vectorizeComparisonPromptNode:', error);
    progressResponse = progressResponse.replace("⏳ Vectorizing", "❌ Vectorizing");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }
    throw error;
  }
};
