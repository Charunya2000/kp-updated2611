/**
 * Response Node Implementation
 * Formats and outputs final workflow results
 */

import { NodeDataTypes } from '../services/schemas/nodeSchema.js';

// Node Definition Schema
export const responseNodeDefinition = {
  metadata: {
    displayName: "LLM Response",
    type: "response",
    version: "1.0.0",
    description: "Final response node for workflow results",
    category: "Output",
    icon: "📤",
    color: "#220059",
    isTerminal: true
  },
  inputSchema: {
    required: ["final_result"],
    properties: {
      final_result: {
        type: NodeDataTypes.STRING,
        description: "Final result to response"
      },
    }
  },
  stateSchema: {
    properties: {}
  },
  outputSchema: {
    properties: {}
  },
  executionLogic: {
    implementation: "response_node",
    async: false
  }
};

// Node Implementation
export async function responseNodeImplementation(inputs, context) {
  const finalResult = inputs.final_result || '';

  console.log(`Response Node executing with final_result: "${finalResult.substring(0, 100)}..."`);

  // Since output formatting is now handled by the LLM node,
  // this node simply passes through the result
  const formattedOutput = finalResult;

  return {
    formatted_output: formattedOutput,
    metadata: {
      nodeId: context.nodeId,
      executedAt: new Date().toISOString(),
      isTerminal: true
    }
  };
}

// Node Configuration for Execution Engine
export const responseNodeConfig = {
  implementationKey: 'response_node',
  implementation: responseNodeImplementation,
  description: 'Final response node for workflow results',
  async: false,
  timeout: null
};