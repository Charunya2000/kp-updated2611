'use server';

import {
  buildUnsupportedLobMessage,
  inferLobFromText,
  normalizeSupportedLob,
  resolveInteractionIntent,
  stripSharePointGuidance
} from '../intentInference.js';

export const parseUserIntentNode = async (state) => {

  let errorMessage = "";

  try {
    const { userPrompt, configDocuments } = state;

    const backgroundMessages = configDocuments.filter(doc => doc.purpose === "Background").map(doc => ({ role: "system", content: doc.documentText }));

    const intentMessages = configDocuments.filter(doc => doc.purpose === "UserIntent" && doc.title === "Initial User Intent").map(doc => ({ role: "system", content: doc.documentText }));

    if (Number(intentMessages.length) !== 1) {
      errorMessage = "Error: There should be exactly one 'Initial User Intent' message in the config.";
      throw new Error(errorMessage);
    }

    const intentMessage = intentMessages[0];

    // Find the JSON schema block in the intentMessage.content
    let intentSchema = {};
    // Extract the JSON schema block between ```json and ```
    const jsonSchemaMatch = intentMessage.content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonSchemaMatch && jsonSchemaMatch[1]) {
      try {
        // Remove <...> placeholders and replace single quotes with double quotes for valid JSON
        intentSchema = JSON.parse(
          jsonSchemaMatch[1]
            .replace(/<[^>]+>/g, '""') // Replace <...> placeholders with empty strings
            .replace(/'/g, '"') // Replace single quotes with double quotes
        );
      } catch (e) {
        errorMessage = "Error parsing JSON schema in 'Initial User Intent' message: " + e.message;
        throw new Error(errorMessage);
      }
    }

    const userMessage = {
      role: "user",
      content: userPrompt
    };

    const messages = [...backgroundMessages, intentMessage, userMessage];

    let intentResponse = "";

    if (!state.completionsClient) {
      errorMessage = 'OpenAI client not initialized. Make sure it is passed in the state.';
      throw new Error(errorMessage);
    }

    const chatCompletionConfigs = configDocuments.filter(doc => doc.purpose === "ChatCompletionConfig" && doc.title === "Initial User Intent Chat Completion Config").map(doc => doc.documentText);

    if (Number(chatCompletionConfigs.length) !== 1) {
      errorMessage = "Error: There should be exactly one 'Initial User Intent Chat Completion Config' message in the config.";
      throw new Error(errorMessage);
    }

    // Extract JSON config from chatCompletionConfig text
    const chatCompletionConfigText = chatCompletionConfigs[0];
    let parsedConfig = {};
    try {
      // Extract the JSON inside ```jsonconfig ... ```
      const jsonMatch = chatCompletionConfigText.match(/```jsonconfig\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        parsedConfig = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Could not find valid JSON config in chatCompletionConfig text.");
      }
    } catch (e) {
      errorMessage = "Error parsing chat completion config: " + e.message;
      throw new Error(errorMessage);
    }

    const completion = await state.completionsClient.chat.completions.create({
      temperature: parsedConfig.temperature ?? 0.7,
      max_completion_tokens: parsedConfig.max_completion_tokens ?? parsedConfig.max_tokens ?? 1000,
      model: parsedConfig.model ?? "gpt-4o",
      stream: parsedConfig.stream ?? false,
      top_p: parsedConfig.top_p ?? 1.0,
      messages: messages
    });

    const content = completion.choices[0]?.message?.content || '';

    const extractJsonFromText = (text = '') => {
      const trimmed = String(text || '').trim();
      if (!trimmed) {
        return null;
      }

      try {
        return JSON.parse(trimmed);
      } catch {
        // Continue with fallback extraction strategies.
      }

      const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fencedMatch?.[1]) {
        try {
          return JSON.parse(fencedMatch[1].trim());
        } catch {
          // Continue with object-slice fallback.
        }
      }

      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const candidate = trimmed.slice(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }

      return null;
    };

    const parsedIntent = extractJsonFromText(content);
    if (!parsedIntent) {
      errorMessage = 'Error parsing schema instance from response content: Could not find valid JSON schema instance in response content.';
      throw new Error(errorMessage);
    }

    const normalizedIntentLob = normalizeSupportedLob(parsedIntent?.lob);
    const inferredPromptLob = inferLobFromText(userPrompt);
    const resolvedLob = normalizedIntentLob || inferredPromptLob;

    if (resolvedLob) {
      parsedIntent.lob = resolvedLob;
      parsedIntent.interaction = resolveInteractionIntent({
        selectedInteraction: null,
        parsedInteraction: parsedIntent?.interaction,
        userPrompt,
      });
    } else {
      parsedIntent.lob = null;
      parsedIntent.interaction = null;
      parsedIntent.markdownResponse = buildUnsupportedLobMessage();
    }

    parsedIntent.markdownResponse = stripSharePointGuidance(parsedIntent.markdownResponse || '');
    if (!parsedIntent.markdownResponse) {
      parsedIntent.markdownResponse = resolvedLob
        ? `I can help with ${resolvedLob} compliance questions.`
        : buildUnsupportedLobMessage();
    }

    intentResponse = parsedIntent.markdownResponse || '';

    // Get suggested follow-up prompts
    const suggestedPromptsCompletion = await state.completionsClient.chat.completions.create({
      temperature: parsedConfig.temperature ?? 0.7,
      max_completion_tokens: parsedConfig.max_completion_tokens ?? parsedConfig.max_tokens ?? 1000,
      model: parsedConfig.model ?? "gpt-4o",
      stream: parsedConfig.stream ?? false,
      top_p: parsedConfig.top_p ?? 1.0,
      messages: [
        {
          role: "user",
          content: `Previous response: ${intentResponse}\n\nGenerate 3 relevant follow-up questions, separated by '~!~'. Don't number them, just questions.`
        }
      ]
    });

    // Extract and process suggested prompts
    const suggestedPrompts = suggestedPromptsCompletion.choices[0]?.message?.content?.trim().split('~!~').map(p => p.trim()) || [];

    return {
      ...state,
      intentSchema,
      parsedIntent,
      intentResponse,
      suggestedPrompts
    };
  } catch (error) {
    console.error("Error in parseUserIntentNode:", error);
    return {
      ...state,
      parsedIntent: {},
      intentResponse: "",
      suggestedPrompts: [],
      errorMessage: errorMessage || error.message
    };
  }
};
