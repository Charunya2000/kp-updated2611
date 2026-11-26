/**
 * Node Implementations Index
 * Exports all node implementations, configurations, and schemas
 */

import { userPromptNodeConfig, userPromptNodeDefinition } from './userPromptNode.js';
import { llmNodeConfig, llmNodeDefinition } from './llmNode.js';
import { responseNodeConfig, responseNodeDefinition } from './responseNode.js';
import { aiSearchNodeConfig, aiSearchNodeDefinition } from './aiSearchNode.js';

// Export all node configurations
export const nodeImplementations = [
  userPromptNodeConfig,
  llmNodeConfig,
  responseNodeConfig,
  aiSearchNodeConfig
];

// Export all node definitions (schemas)
export const nodeDefinitions = [
  userPromptNodeDefinition,
  llmNodeDefinition,
  responseNodeDefinition,
  aiSearchNodeDefinition
];

// Create maps for easy lookup
export const nodeImplementationMap = new Map(
  nodeImplementations.map(config => [config.implementationKey, config])
);

export const nodeDefinitionMap = new Map(
  nodeDefinitions.map(definition => [definition.metadata.type, definition])
);

// Export individual configurations for direct import
export {
  userPromptNodeConfig,
  llmNodeConfig,
  responseNodeConfig,
  aiSearchNodeConfig
};

// Export individual definitions for direct import
export {
  userPromptNodeDefinition,
  llmNodeDefinition,
  responseNodeDefinition,
  aiSearchNodeDefinition
};

// Export individual implementations for direct import
export { userPromptNodeImplementation } from './userPromptNode.js';
export { llmNodeImplementation } from './llmNode.js';
export { responseNodeImplementation } from './responseNode.js';
export { aiSearchNodeImplementation } from './aiSearchNode.js';