/**
 * Azure AI Search Node Implementation
 * Executes Azure AI Search queries and outputs search results
 */

import { NodeDataTypes, UIComponents } from '../services/schemas/nodeSchema.js';
import { getAllIndexNames, getFieldsNamesForIndex } from '@/app/clientServices/aiSearchIndexService.js';
import { searchIndexWithVectorField } from '@/app/services/searchVectorDataService.js';

// Node Definition Schema
export const aiSearchNodeDefinition = {
  metadata: {
    displayName: "Azure AI Search",
    type: "aiSearch",
    version: "1.0.0",
    description: "Execute Azure AI Search queries and retrieve results",
    category: "Data",
    icon: "🔍",
    color: "#0078D4"
  },
  inputSchema: {
    required: [],
    properties: {
      vectorEmbedding: {
        type: NodeDataTypes.ARRAY,
        description: "Vector embedding for similarity search (array of numbers)"
      }
    }
  },
  stateSchema: {
    properties: {
      displayName: {
        type: NodeDataTypes.STRING,
        description: "Display name for this search node",
        default: "Azure AI Search"
      },
      indexName: {
        type: NodeDataTypes.SELECT,
        description: "Select the Azure AI Search index to query",
        default: "",
        validation: {
          options: [] // Will be populated by onLoad
        },
        onChange: 'onIndexNameChange' // Reference to onChange function
      },
      nearestNeighbors: {
        type: NodeDataTypes.NUMBER,
        description: "Number of nearest neighbors to return",
        default: 5,
        validation: { min: 1, max: 50, step: 1 }
      },
      selectFields: {
        type: NodeDataTypes.MULTI_SELECT,
        description: "Fields to include in search results",
        default: [],
        validation: {
          options: [] // Will be populated by onChange handler
        },
        onChange: 'onSelectFieldsChange' // Reference to onChange function
      },
      vectorField: {
        type: NodeDataTypes.STRING,
        description: "Name of the vector field in the index (e.g., 'content_vector')",
        default: "content_vector"
      },
      filter: {
        type: NodeDataTypes.STRING,
        description: "OData filter expression (optional)",
        default: ""
      },
      messageTemplate: {
        type: NodeDataTypes.TEXT_AREA,
        description: "Template for formatting search results",
        default: "",
        ui: {
          component: UIComponents.TEXT_AREA,
          props: {
            rows: 4,
            placeholder: "Generated from selected fields..."
          }
        }
      }
    }
  },
  outputSchema: {
    required: ["results"],
    properties: {
      results: {
        type: NodeDataTypes.ARRAY,
        description: "Array of search results from Azure AI Search"
      }
    }
  },
  executionLogic: {
    implementation: "ai_search_node",
    async: true,
    timeout: 30000
  }
};

// Node Implementation
export async function aiSearchNodeImplementation(inputs, context) {
  // Extract configuration from merged inputs
  const indexName = inputs.indexName || '';
  const nearestNeighbors = inputs.nearestNeighbors || 5;
  const selectFields = inputs.selectFields || [];
  const vectorField = inputs.vectorField || 'content_vector';
  const filter = inputs.filter || '';
  const vectorEmbedding = inputs.vectorEmbedding || null;

  console.log(`🔍 AI Search Node executing search on index: "${indexName}"`);
  console.log(`🔍 Search params:`, {
    indexName,
    nearestNeighbors,
    selectFieldsCount: selectFields.length,
    vectorField,
    filter,
    hasVectorEmbedding: !!vectorEmbedding
  });

  // Validation
  if (!indexName) {
    throw new Error('Index name is required for Azure AI Search');
  }

  if (!vectorEmbedding || !Array.isArray(vectorEmbedding) || vectorEmbedding.length === 0) {
    throw new Error('Vector embedding is required for Azure AI Search. Please connect a vector embedding source.');
  }

  if (!selectFields || selectFields.length === 0) {
    throw new Error('At least one field must be selected for search results');
  }

  try {
    // Call the actual Azure AI Search service
    console.log(`🔍 Calling searchIndexWithVectorField...`);
    const searchResults = await searchIndexWithVectorField({
      searchIndex: indexName,
      selectFields: selectFields,
      searchEmbedding: vectorEmbedding,
      nearestNeighbors: nearestNeighbors,
      filter: filter || undefined,
      vectorField: vectorField
    });

    console.log(`✅ Search completed. Found ${searchResults.length} results`);

    return {
      results: searchResults,
      metadata: {
        nodeId: context.nodeId,
        indexName,
        resultCount: searchResults.length,
        nearestNeighbors,
        vectorField,
        filter: filter || 'none',
        executedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('❌ Azure AI Search error:', error);
    throw new Error(`Azure AI Search failed: ${error.message}`);
  }
}

// onLoad function - called when node is first added to canvas
export async function aiSearchNodeOnLoad(nodeId, nodeData, updateNodeConfig) {
  console.log(`🔵 AI Search Node onLoad called for node: ${nodeId}`);

  try {
    // Fetch all index names
    const indexNames = await getAllIndexNames();
    console.log(`🔵 Retrieved ${indexNames.length} index names:`, indexNames);

    // Transform to options format
    const indexOptions = indexNames.map(name => ({
      value: name,
      label: name
    }));

    console.log(`🔵 Transformed to ${indexOptions.length} options:`, indexOptions);

    // Update the node configuration with the index options
    // Store as _indexNameOptions (follows pattern _${fieldKey}Options where fieldKey = 'indexName')
    const configUpdate = {
      _indexNameOptions: indexOptions, // Changed from _indexOptions to _indexNameOptions
      _selectFieldsOptions: [] // Initialize empty field options (follows pattern for 'selectFields')
    };

    console.log(`🔵 Calling updateNodeConfig with:`, configUpdate);
    updateNodeConfig(nodeId, configUpdate, false); // Don't show notification for onLoad

    console.log(`✅ Successfully loaded ${indexNames.length} indexes for node ${nodeId}`);
    return { success: true, indexCount: indexNames.length };
  } catch (error) {
    console.error('❌ Failed to load index names:', error);
    return { success: false, error: error.message };
  }
}

// onChange handler for indexName
export async function onIndexNameChange(nodeId, newValue, currentConfig, updateNodeConfig) {
  console.log(`🟡 Index name changed to: ${newValue} for node ${nodeId}`);
  console.log(`🟡 Current config:`, currentConfig);

  if (!newValue) {
    // Clear select fields options if no index selected
    console.log(`🟡 Clearing select fields options (no index selected)`);
    updateNodeConfig(nodeId, {
      _selectFieldsOptions: [], // Changed from _fieldOptions to _selectFieldsOptions
      selectFields: []
    });
    return;
  }

  try {
    // Fetch index metadata
    console.log(`🟡 Fetching field names for index: ${newValue}`);
    const fieldNames = await getFieldsNamesForIndex(newValue);
    console.log(`🟡 Retrieved ${fieldNames.length} field names:`, fieldNames);

    // Transform to options format for MultiSelect
    const fieldOptions = fieldNames.map(name => ({
      value: name,
      label: name
    }));
    console.log(`🟡 Transformed to ${fieldOptions.length} options:`, fieldOptions);

    // Update the node configuration with field options (follows pattern _${fieldKey}Options)
    const configUpdate = {
      _selectFieldsOptions: fieldOptions, // Changed from _fieldOptions to _selectFieldsOptions
      selectFields: [] // Reset selected fields when index changes
    };
    console.log(`🟡 Calling updateNodeConfig with:`, configUpdate);
    updateNodeConfig(nodeId, configUpdate);

    console.log(`✅ Successfully loaded ${fieldNames.length} fields for index ${newValue}`);
  } catch (error) {
    console.error('❌ Failed to load index metadata:', error);
    updateNodeConfig(nodeId, {
      _selectFieldsOptions: [], // Changed from _fieldOptions to _selectFieldsOptions
      selectFields: []
    });
  }
}

// onChange handler for selectFields
export function onSelectFieldsChange(nodeId, newValue, currentConfig, updateNodeConfig) {
  console.log(`Select fields changed for node ${nodeId}:`, newValue);

  // Generate message template from selected fields
  const template = generateMessageTemplate(newValue);

  // Update the messageTemplate field
  updateNodeConfig(nodeId, {
    messageTemplate: template
  });
}

// Helper function to generate message template
function generateMessageTemplate(selectedFields) {
  if (!selectedFields || selectedFields.length === 0) {
    return '';
  }

  // Format: field: ${field}
  return selectedFields
    .map(field => `${field}: \${${field}}`)
    .join('\n');
}

// Node Configuration for Execution Engine
export const aiSearchNodeConfig = {
  implementationKey: 'ai_search_node',
  implementation: aiSearchNodeImplementation,
  description: 'Azure AI Search node for querying search indexes',
  async: true,
  timeout: 30000,
  onLoad: aiSearchNodeOnLoad,
  onChange: {
    indexName: onIndexNameChange,
    selectFields: onSelectFieldsChange
  }
};
