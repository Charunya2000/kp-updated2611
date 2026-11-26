# LangGraph Generator Service

## Overview

The LangGraph Generator Service is a powerful tool that converts JSON configuration objects into executable LangGraph workflows. It enables dynamic creation of complex AI workflows by defining nodes and edges in a simple JSON format, which are then compiled into fully functional LangGraph state machines.

## Table of Contents

- [Core Concepts](#core-concepts)
- [Architecture](#architecture)
- [Node Types](#node-types)
- [Configuration Format](#configuration-format)
- [Usage Examples](#usage-examples)
- [API Reference](#api-reference)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)

## Core Concepts

### What is LangGraph?

LangGraph is a library for building stateful, multi-actor applications with language models. It extends LangChain's expression language with the ability to coordinate multiple chains (or actors) across multiple steps of computation in a cyclic manner.

### Graph Generator Purpose

The Graph Generator Service bridges the gap between visual graph design and executable code by:

1. **Converting JSON to Code**: Takes a visual graph configuration and generates executable LangGraph code
2. **Dynamic State Management**: Automatically creates appropriate state annotations based on node types
3. **Edge Routing**: Handles both simple sequential flows and complex conditional routing
4. **Node Function Creation**: Generates appropriate node functions based on node type and configuration

## Architecture

```
JSON Configuration → State Analysis → Node Generation → Edge Routing → Compiled Graph
```

### Key Components

1. **`generateLangGraphFromConfig(config)`** - Main entry point
2. **`createStateAnnotation(nodes)`** - Analyzes nodes to create state fields
3. **`createNodeFunction(nodeConfig, endNodeConfig)`** - Generates node execution functions
4. **`addEdgesToGraph(graphBuilder, edges, nodes)`** - Handles edge routing logic
5. **`executeGeneratedGraph(graph, initialState)`** - Executes compiled graphs

## Node Types

### Start Node
Initializes the graph execution with initial state and configuration.

```javascript
{
  id: 'start',
  type: 'start',
  data: {
    graph_id: 'my_graph_001',
    initialState: '{"user_name": "John", "task_type": "analysis"}'
  }
}
```

### System Prompt Node
Processes prompt templates with variable substitution.

```javascript
{
  id: 'system',
  type: 'systemPrompt',
  data: {
    template: 'You are a helpful {role} assistant. Help with {task_type}.',
    variables: '{role}, {task_type}',
    defaultValues: '{"role": "general", "task_type": "questions"}'
  }
}
```

### LLM Node
Simulates or executes language model calls.

```javascript
{
  id: 'llm',
  type: 'llm',
  data: {
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 1000
  }
}
```

### Tool Node
Executes external tool or API calls.

```javascript
{
  id: 'search',
  type: 'tool',
  data: {
    tool: 'web_search',
    timeout: 30,
    parameters: '{"query": "latest AI developments"}'
  }
}
```

### Conditional Node
Provides branching logic based on state conditions.

```javascript
{
  id: 'condition',
  type: 'conditional',
  data: {
    condition: 'needs_search',
    operator: '==',
    compareValue: 'true'
  }
}
```

### End Node
Finalizes execution and formats output.

```javascript
{
  id: 'end',
  type: 'end',
  data: {
    outputFormat: 'json',
    save_output: true
  }
}
```

## Configuration Format

### Basic Structure

```javascript
{
  nodes: [
    // Array of node configurations
  ],
  edges: [
    // Array of edge configurations
  ]
}
```

### Node Configuration

```javascript
{
  id: 'unique_node_id',           // Unique identifier
  type: 'node_type',              // One of: start, systemPrompt, llm, tool, conditional, end
  position: { x: 100, y: 50 },    // Optional: UI positioning
  data: {                         // Node-specific configuration
    label: 'Display Name',
    // ... type-specific properties
  }
}
```

### Edge Configuration

```javascript
{
  id: 'edge_id',                  // Unique identifier
  source: 'source_node_id',       // Source node ID
  target: 'target_node_id',       // Target node ID
  sourceHandle: 'true',           // Optional: for conditional routing
  targetHandle: 'input',          // Optional: target connection point
  label: 'Edge Label'             // Optional: edge description
}
```

## Usage Examples

### Example 1: Simple Linear Workflow

```javascript
import { generateLangGraphFromConfig, executeGeneratedGraph } from './graphGeneratorService.js';

const simpleConfig = {
  nodes: [
    {
      id: 'start',
      type: 'start',
      data: { graph_id: 'simple_chat' }
    },
    {
      id: 'prompt',
      type: 'systemPrompt',
      data: { 
        template: 'You are a helpful {role} assistant.',
        variables: '{role}',
        defaultValues: '{"role": "general"}'
      }
    },
    {
      id: 'llm',
      type: 'llm',
      data: { 
        model: 'gpt-4o',
        temperature: 0.7
      }
    },
    {
      id: 'end',
      type: 'end',
      data: { outputFormat: 'text' }
    }
  ],
  edges: [
    { source: 'start', target: 'prompt' },
    { source: 'prompt', target: 'llm' },
    { source: 'llm', target: 'end' }
  ]
};

// Generate and execute
const graph = generateLangGraphFromConfig(simpleConfig);
const result = await executeGeneratedGraph(graph, {
  userPrompt: 'What is machine learning?',
  role: 'technical expert'
});

console.log('Result:', result.finalResult);
```

### Example 2: Conditional Workflow

```javascript
const conditionalConfig = {
  nodes: [
    {
      id: 'start',
      type: 'start',
      data: { graph_id: 'conditional_flow' }
    },
    {
      id: 'llm',
      type: 'llm',
      data: { model: 'gpt-4o' }
    },
    {
      id: 'decision',
      type: 'conditional',
      data: {
        condition: 'needs_search',
        operator: '==',
        compareValue: 'true'
      }
    },
    {
      id: 'search',
      type: 'tool',
      data: {
        tool: 'web_search',
        parameters: '{"query": "current information"}'
      }
    },
    {
      id: 'end',
      type: 'end',
      data: { outputFormat: 'json' }
    }
  ],
  edges: [
    { source: 'start', target: 'llm' },
    { source: 'llm', target: 'decision' },
    { source: 'decision', target: 'search', sourceHandle: 'true' },
    { source: 'decision', target: 'end', sourceHandle: 'false' },
    { source: 'search', target: 'end' }
  ]
};

const graph = generateLangGraphFromConfig(conditionalConfig);
const result = await executeGeneratedGraph(graph, {
  userPrompt: 'Tell me about recent AI developments',
  needs_search: 'true'  // This will trigger the search tool
});
```

### Example 3: Multi-Step AI Assistant

```javascript
const assistantConfig = {
  nodes: [
    {
      id: '1',
      type: 'start',
      data: {
        graph_id: 'ai_assistant',
        initialState: '{"user_name": "User", "expertise_level": "beginner"}'
      }
    },
    {
      id: '2',
      type: 'systemPrompt',
      data: {
        template: 'You are an AI assistant helping {user_name}. Adjust your explanations for a {expertise_level} level.',
        variables: '{user_name}, {expertise_level}',
        defaultValues: '{"user_name": "User", "expertise_level": "intermediate"}'
      }
    },
    {
      id: '3',
      type: 'llm',
      data: {
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 500
      }
    },
    {
      id: '4',
      type: 'conditional',
      data: {
        condition: 'complex_query',
        operator: '==',
        compareValue: 'true'
      }
    },
    {
      id: '5',
      type: 'tool',
      data: {
        tool: 'research_assistant',
        description: 'Provides detailed research on complex topics',
        parameters: '{"depth": "comprehensive"}'
      }
    },
    {
      id: '6',
      type: 'end',
      data: {
        outputFormat: 'json',
        save_output: true
      }
    }
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3' },
    { id: 'e3-4', source: '3', target: '4' },
    { id: 'e4-5', source: '4', target: '5', sourceHandle: 'true', label: 'complex' },
    { id: 'e4-6', source: '4', target: '6', sourceHandle: 'false', label: 'simple' },
    { id: 'e5-6', source: '5', target: '6', label: 'research complete' }
  ]
};
```

## API Reference

### `generateLangGraphFromConfig(config)`

Generates a compiled LangGraph from JSON configuration.

**Parameters:**
- `config` (Object): Graph configuration with nodes and edges

**Returns:**
- Compiled LangGraph ready for execution

**Example:**
```javascript
const graph = generateLangGraphFromConfig({
  nodes: [...],
  edges: [...]
});
```

### `executeGeneratedGraph(graph, initialState)`

Executes a compiled graph with provided initial state.

**Parameters:**
- `graph` (Object): Compiled LangGraph
- `initialState` (Object): Initial state for execution

**Returns:**
- Promise resolving to execution result

**Example:**
```javascript
const result = await executeGeneratedGraph(graph, {
  userPrompt: 'Hello',
  customData: 'value'
});
```

### `createStateAnnotation(nodes)`

Creates LangGraph state annotation based on node configurations.

**Parameters:**
- `nodes` (Array): Array of node configurations

**Returns:**
- Object with state field definitions

### `createNodeFunction(nodeConfig, endNodeConfig)`

Creates an executable function for a node.

**Parameters:**
- `nodeConfig` (Object): Node configuration
- `endNodeConfig` (Object): Optional end node configuration for final nodes

**Returns:**
- Async function for node execution

## Advanced Features

### Variable Substitution

System prompt nodes support dynamic variable substitution:

```javascript
{
  template: 'You are a {role} helping with {task}. User level: {level}',
  variables: '{role}, {task}, {level}',
  defaultValues: '{"role": "assistant", "task": "general help", "level": "beginner"}'
}
```

### Conditional Routing

Complex conditional logic with multiple operators:

```javascript
{
  condition: 'user_score',
  operator: '>',
  compareValue: '80'
}
```

Supported operators: `==`, `!=`, `>`, `<`, `>=`, `<=`

### Streaming Support

Built-in streaming support through `sendEvent` handlers:

```javascript
const result = await executeGeneratedGraph(graph, {
  userPrompt: 'Question',
  sendEvent: (event) => {
    if (event.type === 'data') {
      console.log('Streaming data:', event.data);
    }
  }
});
```

### Output Formatting

Multiple output formats supported:

- `json`: Structured JSON output with metadata
- `text`: Plain text output
- Custom formats can be added

## Best Practices

### 1. Node Naming
Use descriptive, unique node IDs:
```javascript
// Good
{ id: 'user_intent_analysis', type: 'llm' }

// Avoid
{ id: 'node1', type: 'llm' }
```

### 2. State Management
Keep state fields consistent across nodes:
```javascript
// Use consistent naming
userPrompt, systemPrompt, llmResponse
```

### 3. Error Handling
Always provide fallback values:
```javascript
{
  defaultValues: '{"role": "general", "task": "assistance"}'
}
```

### 4. Graph Validation
Validate configuration before generation:
```javascript
function validateConfig(config) {
  // Check for required start and end nodes
  const hasStart = config.nodes.some(n => n.type === 'start');
  const hasEnd = config.nodes.some(n => n.type === 'end');
  
  if (!hasStart || !hasEnd) {
    throw new Error('Graph must have start and end nodes');
  }
}
```

### 5. Testing
Test graphs with various input scenarios:
```javascript
// Test with minimal input
await executeGeneratedGraph(graph, { userPrompt: 'test' });

// Test with full state
await executeGeneratedGraph(graph, {
  userPrompt: 'complex question',
  user_name: 'John',
  needs_search: 'true'
});
```

## Troubleshooting

### Common Issues

1. **"Node X is not reachable"**
   - Ensure all nodes except start/end are properly connected
   - Check edge source/target IDs match node IDs

2. **"Condition evaluation error"**
   - Verify condition field exists in state
   - Check operator and compareValue are valid

3. **"Invalid JSON format"**
   - Validate JSON in data fields (parameters, defaultValues, initialState)

### Debug Mode

Enable debug logging by setting console outputs:
```javascript
const graph = generateLangGraphFromConfig(config);
// Check console for node addition and edge routing logs
```

## Integration Examples

### With React Flow Graph Builder

```javascript
// Export from React Flow
const graphConfig = {
  nodes: reactFlowNodes.map(node => ({
    id: node.id,
    type: node.type,
    data: node.data
  })),
  edges: reactFlowEdges.map(edge => ({
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle
  }))
};

// Generate executable graph
const executableGraph = generateLangGraphFromConfig(graphConfig);
```

### With API Endpoints

```javascript
// POST /api/execute-graph
export async function POST(request) {
  const { config, initialState } = await request.json();
  
  try {
    const graph = generateLangGraphFromConfig(config);
    const result = await executeGeneratedGraph(graph, initialState);
    
    return Response.json({ success: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

## Future Enhancements

- **Custom Node Types**: Support for user-defined node types
- **Graph Validation**: Built-in configuration validation
- **Performance Optimization**: Caching and optimization for large graphs
- **Real LLM Integration**: Built-in support for various LLM providers
- **Visual Debugging**: Tools for visualizing graph execution flow

---

*This documentation covers the core functionality of the LangGraph Generator Service. For specific implementation details or custom use cases, refer to the source code or create additional examples based on your needs.*
