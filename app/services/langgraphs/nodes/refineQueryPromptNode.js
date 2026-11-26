'use server';

import { chatCompletionMarkdown } from '@/app/services/langgraphs/chatCompletionService2.js';

const chatCompletionMarkdownNode = async (state) => {
  const contextMessages = [
    {
      role: "system",
      content: state.systemMessage
    },
    {
      role: "system",
      content: "Even if asked, in all responses, avoid anything that appears to be PII or PHI: names, email addresses, etc."
    },
    {
      role: "system",
      content: "Please respond with UTF-8 encoding and return formatted markdown. If the prompt directly requests a graph or you can infer that a graph would help explain the response, then introduce a mermaid graph in your response."
    }
  ];

  const userMessages = [
    {
      role: "user",
      content: state.enrichedPrompt
    }
  ];

  const allMessages = [...contextMessages, ...userMessages];

  const markdownResponse = await chatCompletionMarkdown({
    messages: allMessages, onToken: (content) => {
      state.sendEvent({ type: 'data', data: content });
    },
    teamName: state?.teamName,
    assistantName: state?.assistantName
  });

  return { markdownResponse };
};
