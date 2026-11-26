import { chatCompletionPrompts } from "@/app/services/chatCompletionService2";

export const chatCompletionPromptsNode = async (state) => {
  const contextMessages = [
    {
      role: "user",
      content: `Based on your ${state.markdownResponse} response, provide 3 suggested prompts, plain text only, separated by ~!~ and don't number them.`
    }
  ];

  const suggestedPrompts = await chatCompletionPrompts({ messages: contextMessages, teamName: state?.teamName, assistantName: state?.assistantName });
  state.sendEvent({ type: 'data', data: JSON.stringify({ suggestedPrompts }) });
  return { suggestedPrompts };
};