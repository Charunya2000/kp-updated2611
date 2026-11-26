'use server';

export const userComparisonIntentNode = async (state) => {
  const { updateChatInteractionProgress } = await import('../helpers/progressTracking');

  let progressResponse = state.progressResponse || "## Comparison Progress\n\n";
  progressResponse += "⏳ Parsing comparison intent...\n\n---\n";

  // Update progress
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  let errorMessage = "";
  try {
    const { userPrompt, configDocuments } = state;

    // Find the intent config for comparison
    const foundIntentDoc = configDocuments.find(doc => doc.purpose === "UserIntent" && doc.title === "User Doc Comparison Intent");

    const intentMessage = { role: "system", content: foundIntentDoc?.documentText };

    // Extract JSON block for schema
    let intentSchema = {};
    try {
      const jsonSchemaMatch = intentMessage.content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonSchemaMatch && jsonSchemaMatch[1]) {
        intentSchema = JSON.parse(jsonSchemaMatch[1]);
      }
    } catch (e) {
      errorMessage = "Error parsing JSON schema in 'User Doc Comparison Intent' message: " + e.message;
    }

    const userMessage = { role: "user", content: userPrompt };
    const messages = [intentMessage, userMessage];

    if (!state.completionsClient) {
      errorMessage = 'OpenAI client not initialized. Make sure it is passed in the state.';
      throw new Error(errorMessage);
    }


    // Find chat completion config for comparison
    const chatCompletionDoc = configDocuments.find(doc => doc.purpose === "ChatCompletionConfig" && doc.title === "Doc Comparison Chat Completion Config");


    // Extract JSON block for config
    let parsedConfig = {};
    try {
      const jsonConfigMatch = chatCompletionDoc?.documentText?.match(/```jsonconfig\s*([\s\S]*?)\s*```/);
      if (jsonConfigMatch && jsonConfigMatch[1]) {
        parsedConfig = JSON.parse(jsonConfigMatch[1]);
      } // If not found, just leave parsedConfig as {}
    } catch (e) {
      errorMessage = "Error parsing chat completion config: " + e.message;
      // Default to empty config
      parsedConfig = {};
    }

    // Call OpenAI for intent parsing
    const completion = await state.completionsClient.chat.completions.create({
      temperature: parsedConfig.temperature ?? 0.7,
      max_completion_tokens: parsedConfig.max_tokens ?? 1000,
      model: parsedConfig.model ?? "gpt-4o",
      stream: parsedConfig.stream ?? false,
      top_p: parsedConfig.top_p ?? 1.0,
      messages
    });
    const content = completion.choices[0]?.message?.content || '';

    let parsedIntent = {};
    try {
      const schemaInstanceMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (schemaInstanceMatch && schemaInstanceMatch[1]) {
        parsedIntent = JSON.parse(schemaInstanceMatch[1]);
      } else {
        throw new Error("Could not find valid JSON schema instance in response content.");
      }
    } catch (e) {
      errorMessage = "Error parsing schema instance from response content: " + e.message;
      throw new Error(errorMessage);
    }

    const intentResponse = parsedIntent.markdownResponse;

    // Update progress - halfway through
    progressResponse = progressResponse.replace("⏳ Parsing", "✓ Parsing");
    progressResponse += "⏳ Generating follow-up suggestions...\n\n---\n";
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    // Get suggested follow-up prompts
    const suggestedPromptsCompletion = await state.completionsClient.chat.completions.create({
      temperature: parsedConfig.temperature ?? 0.7,
      max_completion_tokens: parsedConfig.max_tokens ?? 1000,
      model: parsedConfig.model ?? "gpt-4o",
      stream: parsedConfig.stream ?? false,
      top_p: parsedConfig.top_p ?? 1.0,
      messages: [
        {
          role: "user",
          content: `Previous response: ${intentResponse}\n\nGenerate 3 relevant follow-up questions for document comparison, separated by '~!~'. Don't number them, just questions.`
        }
      ]
    });
    const suggestedPrompts = suggestedPromptsCompletion.choices[0]?.message?.content?.trim().split('~!~').map(p => p.trim()) || [];

    // Mark intent parsing complete
    progressResponse = progressResponse.replace("⏳ Generating", "✓ Generating");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    return {
      ...state,
      intentSchema,
      parsedIntent,
      intentResponse,
      suggestedPrompts,
      progressResponse
    };
  } catch (error) {
    console.error("Error in userComparisonIntentNode:", error);
    progressResponse = progressResponse.replace("⏳", "❌");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }
    return {
      ...state,
      parsedIntent: {},
      intentResponse: "",
      suggestedPrompts: [],
      errorMessage: errorMessage || error.message,
      progressResponse
    };
  }
};
