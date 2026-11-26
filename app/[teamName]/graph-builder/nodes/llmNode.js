/**
 * LLM Node Implementation
 * Processes text prompts using language models
 */

import { getCompletionsClient } from '@/app/services/chatCompletionService3.js';
import { NodeDataTypes, UIComponents } from '../services/schemas/nodeSchema.js';
import { generateChatCompletion } from '@/app/services/nexusos/completionsClient.js';

// Node Definition Schema
export const llmNodeDefinition = {
  metadata: {
    displayName: "Chat Completion",
    type: "llm",
    version: "1.0.0",
    description: "Large Language Model node for text generation",
    category: "AI/ML",
    icon: "🤖",
    color: "#012780"
  },
  inputSchema: {
    required: ["prompt"],
    properties: {
      prompt: {
        type: NodeDataTypes.STRING,
        description: "Input prompt for the language model",
      }
    }
  },
  stateSchema: {
    properties: {
      model: {
        type: NodeDataTypes.SELECT,
        description: "Select the language model to use",
        default: "gpt-4o",
        validation: {
          options: [
            { value: "gpt-4o", label: "GPT-4o" }
          ]
        }
      },
      temperature: {
        type: NodeDataTypes.NUMBER,
        description: "Controls randomness in the output",
        default: 0.7,
        validation: { min: 0, max: 1, step: 0.1 },
        ui: {
          component: UIComponents.SLIDER
        }
      },
      max_tokens: {
        type: NodeDataTypes.NUMBER,
        description: "Maximum number of tokens to generate",
        default: 1000,
        validation: { min: 500, max: 4000, step: 500 }
      },
      output_format: {
        type: NodeDataTypes.SELECT,
        description: "Format for the model response",
        default: "text",
        validation: {
          options: [
            { value: "text", label: "Plain Text" },
            { value: "markdown", label: "Markdown" },
            { value: "json", label: "JSON" }
          ]
        }
      }
    }
  },
  outputSchema: {
    required: ["response"],
    properties: {
      response: {
        type: NodeDataTypes.STRING,
        description: "Generated text response from the model"
      },
      token_count: {
        type: NodeDataTypes.NUMBER,
        description: "Number of tokens used in the generation"
      }
    }
  },
  executionLogic: {
    implementation: "llm_node",
    async: true,
    timeout: 30000
  }
};

// Node Implementation
export async function llmNodeImplementation(inputs, context) {
  // Extract from merged inputs (config + data flow inputs)
  const prompt = inputs.prompt || '';
  const model = inputs.model || 'gpt-4o';
  const temperature = inputs.temperature || 0.7;
  const maxTokens = inputs.max_tokens || 1000;
  const outputFormat = inputs.output_format || 'text';

  console.log(`LLM Node executing with prompt: "${prompt.substring(0, 100)}..."`);

  // Create format instruction based on selected output format
  const formatInstructions = getFormatInstructions(outputFormat);

  // Prepare messages array with format instruction
  const messages = [
    { role: "user", content: prompt }
  ];

  // Add format instruction as a system message if not plain text
  if (outputFormat !== 'text') {
    messages.unshift({ role: "system", content: formatInstructions });
  }

  let tokens = 0;
  let hasStreamedContent = false;

  const response = await chatCompletion({
    messages: messages,
    config: { model, temperature, maxTokens },
    onToken: (token) => {
      tokens++;
      // Stream tokens if streaming is enabled
      if (context.streaming && context.onToken) {
        hasStreamedContent = true;
        context.onToken(token);
      }
    },
    teamName: context.teamName,
    assistantName: context.assistantName
  });

  // Mark that we had streaming output if we streamed any content
  if (hasStreamedContent && context.executionContext) {
    context.executionContext.hadStreamingOutput = true;
  }

  return {
    response: response,
    token_count: tokens,
    metadata: {
      nodeId: context.nodeId,
      model,
      temperature,
      maxTokens,
      outputFormat,
      executedAt: new Date().toISOString()
    }
  };
}

// Helper function to get format instructions
function getFormatInstructions(format) {
  switch (format) {
    case 'markdown':
      return "Format your response using Markdown syntax. Use appropriate headers, lists, code blocks, and other Markdown formatting elements to structure your response clearly.";
    case 'json':
      return "Format your response as valid JSON. Ensure the JSON is properly structured with appropriate key-value pairs and follows JSON syntax rules. Do not include any additional text or explanation. Do not use Markdown syntax to display the JSON, it must just be raw, so I can immediately use JSON.parse() on it.";
    case 'text':
    default:
      return "";
  }
}

async function chatCompletion({ messages, config, onToken, teamName, assistantName }) {
  try {
    const completion = await generateChatCompletion({
      teamName: teamName,
      assistantName: assistantName,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000,
      model: config.model || "gpt-4o",
      event: 'chat-completion',
      messages: messages
    });

    const content = completion.choices?.[0]?.message?.content || 'Oops something went wrong, no content returned.';

    onToken(content);
    return content;
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'llmNodeImplementation.chatCompletionMarkdown', detail: { error: error.message } } }));
    onToken("Your request could not be processed. Please try again.");
  }
}

// Node Configuration for Execution Engine
export const llmNodeConfig = {
  implementationKey: 'llm_node',
  implementation: llmNodeImplementation,
  description: 'Large Language Model node for text generation',
  async: true,
  timeout: 30000
};