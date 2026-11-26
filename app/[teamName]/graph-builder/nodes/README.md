# Graph Builder Nodes

This directory contains individual node implementations for the graph execution system. Each node is extracted into its own file for better organization, maintainability, and extensibility.

## Node Structure

Each node file follows this pattern:

```javascript
'use server'

/**
 * Node Implementation
 * Description of what the node does
 */

export async function nodeImplementation(nodeConfig, inputs, context) {
  // Implementation logic here
  return {
    // Output properties
  };
}

export const nodeConfig = {
  implementationKey: 'node_key',
  implementation: nodeImplementation,
  description: 'Node description',
  async: false, // or true
  timeout: null // or number in milliseconds
};
```

## Available Nodes

### 1. User Prompt Node (`userPromptNode.js`)
- **Purpose**: Provides static text content as output
- **Implementation Key**: `user_prompt_node`
- **Async**: No
- **Inputs**: None (uses configuration)
- **Outputs**: 
  - `text`: The configured text content
  - `metadata`: Execution information

### 2. LLM Node (`llmNode.js`)
- **Purpose**: Processes text prompts using language models
- **Implementation Key**: `llm_node`
- **Async**: Yes (30s timeout)
- **Inputs**:
  - `prompt`: Text prompt to process
- **Configuration**:
  - `model`: Model to use (gpt-4o, llama-2)
  - `temperature`: Randomness control (0-1)
  - `max_tokens`: Maximum tokens to generate
- **Outputs**:
  - `response`: Generated text response
  - `token_count`: Number of tokens used
  - `metadata`: Model and execution information

### 3. Response Node (`responseNode.js`)
- **Purpose**: Formats and outputs final workflow results (Terminal Node)
- **Implementation Key**: `response_node`
- **Async**: No
- **Inputs**:
  - `final_result`: The result to format and output
- **Configuration**:
  - `output_format`: Format type (text, json, markdown, html)
  - `save_to_file`: Whether to save to file (boolean)
- **Outputs**:
  - `formatted_output`: Formatted final result
  - `metadata`: Format and execution information

### 4. Text Processor Node (`textProcessorNode.js`)
- **Purpose**: Processes and transforms text content
- **Implementation Key**: `text_processor_node`
- **Async**: No
- **Inputs**:
  - `input_text`: Text to process
  - `operation`: Processing operation to perform
  - `custom_regex`: Custom regex pattern (optional)
- **Supported Operations**:
  - `uppercase`: Convert to uppercase
  - `lowercase`: Convert to lowercase
  - `title`: Convert to title case
  - `reverse`: Reverse text
  - `word_count`: Count words
  - `extract_emails`: Extract email addresses
- **Outputs**:
  - `processed_text`: Processed text result
  - `metadata`: Processing statistics

### 5. Conditional Node (`conditionalNode.js`)
- **Purpose**: Provides conditional logic for branching workflows
- **Implementation Key**: `conditional_node`
- **Async**: No
- **Inputs**:
  - `condition_value`: Value to evaluate
  - `condition_type`: Type of condition
  - `comparison_value`: Value to compare against
  - `case_sensitive`: Whether comparison is case sensitive
- **Condition Types**:
  - `equals`: Exact match
  - `not_equals`: Not equal
  - `contains`: Contains substring
  - `starts_with`: Starts with substring
  - `ends_with`: Ends with substring
  - `regex`: Regular expression match
  - `is_empty`: Is empty string
  - `is_not_empty`: Is not empty string
- **Outputs**:
  - `result`: Boolean evaluation result
  - `true_path`: Output for true condition
  - `false_path`: Output for false condition
  - `metadata`: Condition evaluation information

### 6. Data Aggregator Node (`dataAggregatorNode.js`)
- **Purpose**: Aggregates and combines multiple data inputs
- **Implementation Key**: `data_aggregator_node`
- **Async**: No
- **Inputs**:
  - `input_data`: Array of data to aggregate
  - `aggregation_method`: Method for aggregation
  - `separator`: Separator for concatenation
- **Aggregation Methods**:
  - `concatenate`: Join with separator
  - `merge_objects`: Merge object properties
  - `sum_numbers`: Sum numeric values
  - `average_numbers`: Calculate average
  - `count_items`: Count total items
  - `unique_values`: Get unique values only
- **Outputs**:
  - `aggregated_result`: Result of aggregation
  - `item_count`: Number of items processed
  - `metadata`: Aggregation information

## Adding New Nodes

1. **Create a new file** in this directory following the naming pattern: `{nodeName}Node.js`

2. **Implement the node function**:
   ```javascript
   export async function myCustomNodeImplementation(nodeConfig, inputs, context) {
     // Access inputs
     const inputValue = inputs.my_input || '';
     
     // Access configuration
     const configValue = nodeConfig.my_config || 'default';
     
     // Perform logic
     const result = processData(inputValue, configValue);
     
     // Return outputs
     return {
       my_output: result,
       metadata: {
         nodeId: context.nodeId,
         executedAt: new Date().toISOString()
       }
     };
   }
   ```

3. **Export the configuration**:
   ```javascript
   export const myCustomNodeConfig = {
     implementationKey: 'my_custom_node',
     implementation: myCustomNodeImplementation,
     description: 'Description of what the node does',
     async: false, // or true if async
     timeout: null // or timeout in milliseconds
   };
   ```

4. **Add to index.js**:
   ```javascript
   import { myCustomNodeConfig } from './myCustomNode.js';
   
   export const nodeImplementations = [
     // ... existing nodes
     myCustomNodeConfig
   ];
   ```

5. **Define the schema** in `sampleNodeDefinitions.js` with matching `executionLogic.implementation`

## Context Object

Each node receives a context object with:
- `nodeId`: Unique identifier for the node instance
- `nodeType`: Type of the node
- `executionId`: Unique identifier for the execution session
- `executionOptions`: Options passed to the execution engine

## Error Handling

Nodes can throw `GraphExecutionError` for execution-specific errors:

```javascript
throw new GraphExecutionError(
  'Error message', 
  context.nodeId
);
```

## Best Practices

1. **Always return metadata** with at least `nodeId` and `executedAt`
2. **Validate inputs** and provide sensible defaults
3. **Handle errors gracefully** with descriptive messages
4. **Use async only when necessary** for performance
5. **Document your nodes** thoroughly
6. **Test edge cases** like empty inputs or invalid configurations
7. **Keep implementations focused** - one responsibility per node

## Testing

Each node can be tested independently:

```javascript
import { myCustomNodeImplementation } from './myCustomNode.js';

const result = await myCustomNodeImplementation(
  { my_config: 'test' }, // nodeConfig
  { my_input: 'test input' }, // inputs
  { nodeId: 'test_node', executionId: 'test_exec' } // context
);

console.log(result);
```

This modular approach makes the system more maintainable, testable, and extensible.