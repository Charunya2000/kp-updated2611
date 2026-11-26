export const enrichPromptNode = async (state) => {
  const enrichedPrompt = state.totalMessages.map(result => result.content).join("\n") + "\n\nUser question is: " + state.chatInteraction.prompt;
  return { enrichedPrompt };
};