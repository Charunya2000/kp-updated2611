import { selectSystemPrompt } from '@/app/services/systemPromptService';

export const systemPromptNode = async (state) => {
  const query = {
    teamName: state.teamName,
    assistantName: state.assistantName,
    default: true
  };
  const systemPrompt = await selectSystemPrompt(query, state.teamName);
  return { systemPrompt: systemPrompt?.prompt };
};
