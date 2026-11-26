/**
 * User Prompt Node Implementation
 * Provides static text content as output
 */

import { NodeDataTypes, UIComponents } from '../services/schemas/nodeSchema.js';

// Node Definition Schema
export const userPromptNodeDefinition = {
  metadata: {
    displayName: "User Prompt",
    type: "user_prompt",
    version: "1.0.0",
    description: "Text input node",
    category: "Input",
    icon: "📝",
    color: "#490180"
  },
  inputSchema: {
    properties: {}
  },
  stateSchema: {
    properties: {}
  },
  outputSchema: {
    required: ["text_content"],
    properties: {
      text_content: {
        type: NodeDataTypes.STRING,
        description: "User prompt",
        default: "",
        persistent: true,
        editable: true, // Allow users to edit this output field
        ui: {
          component: UIComponents.TEXT_AREA
        }
      }
    }
  },
  executionLogic: {
    implementation: "user_prompt_node",
    async: false
  }
};

// Node Implementation
export async function userPromptNodeImplementation(inputs, context) {
  const textContent = context?.executionOptions?.prompt || inputs.text_content || '';

  return {
    text_content: textContent, // Match the output schema
    metadata: {
      nodeId: context.nodeId,
      executedAt: new Date().toISOString(),
      inputLength: textContent.length
    }
  };
}

// Node Configuration for Execution Engine
export const userPromptNodeConfig = {
  implementationKey: 'user_prompt_node',
  implementation: userPromptNodeImplementation,
  description: 'User input prompt node that outputs configured text content',
  async: false,
  timeout: null
};