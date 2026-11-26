'use server';

export const parseUserIntentNode = async (state) => {

  let errorMessage = "";

  try {
    const { userPrompt, configDocuments } = state;

    const intentMessages = configDocuments.filter(doc => doc.purpose === "UserIntent" && doc.title === "User Doc Conversation Intent").map(doc => ({ role: "system", content: doc.documentText }));

    if (Number(intentMessages.length) !== 1) {
      errorMessage = "Error: There should be exactly one 'User Doc Conversation Intent' message in the config.";
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
        let rawSchema = jsonSchemaMatch[1];
        rawSchema = rawSchema.replace(/\s+/g, ' ').trim();
        rawSchema = rawSchema
          // Replace <...> placeholders with empty strings
          .replace(/<[^>]+>/g, '""');
        // Replace single quotes with double quotes
        // .replace(/'/g, '"');
        // Trim trailing non-JSON after last closing brace
        const lastBrace = rawSchema.lastIndexOf('}');
        if (lastBrace !== -1) {
          rawSchema = rawSchema.substring(0, lastBrace + 1);
        }
        intentSchema = JSON.parse(rawSchema);
      } catch (e) {
        errorMessage = "Error parsing JSON schema in 'Initial User Intent' message: " + e.message;
        throw new Error(errorMessage);
      }
    }

    const userMessage = {
      role: "user",
      content: userPrompt
    };

    const messages = [intentMessage, userMessage];

    let intentResponse = "";

    if (!state.completionsClient) {
      errorMessage = 'OpenAI client not initialized. Make sure it is passed in the state.';
      throw new Error(errorMessage);
    }

    const chatCompletionConfigs = configDocuments.filter(doc => doc.purpose === "ChatCompletionConfig" && doc.title === "Doc Conversation Chat Completion Config").map(doc => doc.documentText);

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
      max_completion_tokens: parsedConfig.max_tokens ?? 1000,
      model: parsedConfig.model ?? "gpt-4o",
      stream: parsedConfig.stream ?? false,
      top_p: parsedConfig.top_p ?? 1.0,
      messages: messages
    });

    const content = completion.choices[0]?.message?.content || '';

    // Debugging: Log the raw response content for schema extraction troubleshooting.

    const extractJsonFromText = (text = '') => {
      const trimmed = String(text || '').trim();
      if (!trimmed) {
        return null;
      }

      // Try direct JSON first.
      try {
        return JSON.parse(trimmed);
      } catch {
        // Continue with fallbacks.
      }

      // Try fenced code blocks such as ```json ... ``` or generic ``` ... ```.
      const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fencedMatch?.[1]) {
        try {
          return JSON.parse(fencedMatch[1].trim());
        } catch {
          // Continue with object-slice fallback.
        }
      }

      // Try extracting the first balanced {...} JSON object from mixed text.
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

    let parsedIntent = extractJsonFromText(content);
    if (!parsedIntent) {
      throw new Error('Could not find valid JSON schema instance in response content.');
    }

    // Canonicalize historical LOB name so downstream lookups use Marketplace consistently.
    if (typeof parsedIntent.lob === 'string' && parsedIntent.lob.trim().toLowerCase() === 'aca') {
      parsedIntent.lob = 'Marketplace';
    }

    // Check if the parsed content matches the expected schema
    if (typeof parsedIntent !== 'object' || Array.isArray(parsedIntent) || Object.keys(parsedIntent).length === 0) {
      throw new Error('Response content is empty or missing required fields');
    }

    intentResponse = parsedIntent.markdownResponse;

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
