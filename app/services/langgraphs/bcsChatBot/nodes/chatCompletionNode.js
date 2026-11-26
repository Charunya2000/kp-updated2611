'use server';

import { chatCompletion, chatCompletionPrompts } from '../../../chatCompletionService2.js';

function formatContext(results) {
  if (!results || !Array.isArray(results.items)) {
    return '';
  }

  return results.items
    .map((item, index) => {
      const doc = item.document;
      return `[${index + 1}] ${Object.entries(doc)
        .filter(([key]) => !key.startsWith('_') && key !== 'vectorize_field' && key !== 'aggregate_field')
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ')}`;
    })
    .join('\n\n');
}

function formatGitHubContext(metadata) {
  if (!metadata?.fileFound || !metadata?.file) {
    return '';
  }

  const { file } = metadata;
  return `File: ${file.name}
Path: ${file.path}
Content:
${file.content || 'Content not available'}`;
}

export const chatCompletionNode = async (state) => {
  try {
    if (!state.promptProfile) {
      throw new Error('No prompt profile found in state');
    }

    const { systemMessage, userMessage } = state.promptProfile;
    const userQuestion = state.userMessage;

    // Format context based on the source
    let context = '';
    if (state.searchResults?.items?.length > 0) {
      context = formatContext(state.searchResults);
    } else if (state.githubMetadata?.fileFound) {
      context = formatGitHubContext(state.githubMetadata);
    }

    if (!context) {
      throw new Error('No valid context found in search results or GitHub metadata');
    }

    const userContent = userMessage.content
      .replace("{context}", context)
      .replace("{question}", userQuestion);

    // Prepare messages array for chat completion
    const messages = [
      systemMessage,
      {
        role: "user",
        content: userContent
      }
    ];

    if (!state.completionsClient) {
      throw new Error('OpenAI client not initialized. Make sure it is passed in the state.');
    }

    let suggestedPromptsCompletion = null;

    // Make the main chat completion request
    const completionConfig = {
      assistantName: state.assistantName,
      temperature: 0.7,
      max_tokens: 1000,
      model: "gpt-4o",
      messages: messages,
      teamName: state?.teamName,
      assistantName: state?.assistantName
    };

    // Extract the main response
    const response = await chatCompletion(completionConfig)

    // Get suggested follow-up prompts
    suggestedPromptsCompletionConfig = {
      temperature: 0.7,
      max_tokens: 1000,
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `Previous response: ${response}\n\nGenerate 3 relevant follow-up questions, separated by '~!~'. Don't number them, just questions.`
        }
      ],
      teamName: state?.teamName,
      assistantName: state?.assistantName
    };

    // Extract and process suggested prompts
    const suggestedPrompts = await chatCompletionPrompts(suggestedPromptsCompletionConfig);

    if (!response) {
      throw new Error('No response received from chat completion');
    }

    // // Stream the markdown content first
    // state.sendEvent?.({
    //   type: 'data',
    //   data: response
    // });

    // // Then stream the suggested prompts in the expected JSON format
    // state.sendEvent?.({
    //   type: 'data',
    //   data: JSON.stringify({ suggestedPrompts })
    // });

    // Return updated state
    return {
      ...state,
      context: userContent,
      chatResponse: {
        content: response,
        suggestedPrompts,
        timestamp: new Date().toISOString(),
        metadata: {
          model: "gpt-4o",
          promptType: state.searchResults ? 'search' : 'github',
          sourceType: state.searchResults ? state.searchResults.indexName : 'github',
          contextSize: context.length
        }
      },
      chatSuccess: true
    };

  } catch (error) {
    console.error('Error in chatCompletionNode:', error);
    return {
      ...state,
      chatResponse: {
        content: "I apologize, but I encountered an error while processing your request. Please try again.",
        error: error.message,
        timestamp: new Date().toISOString()
      },
      chatSuccess: false
    };
  }
};
