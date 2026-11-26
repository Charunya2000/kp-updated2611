# Graph Execution System

## Overview

This system provides comprehensive graph validation and execution for your LangGraph Builder. It includes server-side validation, execution engine, and client-side components for a seamless workflow experience.

## Components

### 1. Server-Side Validation (`graphValidator.server.js`)
- **Terminal Node Validation**: Ensures at least one node has `isTerminal: true`
- **Input Satisfaction**: Verifies all required inputs are connected
- **Connectivity**: Checks for orphaned nodes and proper graph flow
- **Type Compatibility**: Validates data types between connections
- **Circular Dependencies**: Detects and prevents infinite loops

### 2. Graph Execution Engine (`graphExecutor.server.js`)
- **Execution Order Generation**: Creates topologically sorted execution sequence
- **Node Implementations**: Built-in implementations for all sample node types
- **Error Handling**: Comprehensive error tracking and reporting
- **Result Collection**: Gathers outputs from terminal nodes

### 3. Client Hooks
- **`useGraphValidation`**: Real-time validation with debouncing
- **`useGraphExecution`**: Full execution control and monitoring

### 4. UI Components
- **`GraphExecutionPanel`**: Complete execution interface
- **`ValidationInfo`**: Validation status display

## Usage

### Setting Up Your Graph

1. **Create a basic workflow**:
   ```
   User Prompt → LLM Node → Response Node
   ```

2. **Configure your nodes**:
   - **User Prompt**: Set the `text_content` in configuration
   - **LLM Node**: Choose model (gpt-4o, llama-2) and set temperature
   - **Response Node**: Select output format (text, json, markdown, html)

3. **Connect the nodes**:
   - User Prompt `text` → LLM Node `prompt`
   - LLM Node `response` → Response Node `final_result`

### Executing Your Graph

1. **Click the Execute button** in the toolbar
2. **The system will**:
   - Validate the graph structure
   - Check for terminal nodes
   - Verify all connections
   - Generate execution order
   - Execute nodes in sequence
   - Collect final results

### Sample Graph Configuration

```javascript
{
  "nodes": [
    {
      "id": "input_1",
      "type": "user_prompt",
      "data": {
        "config": {
          "text_content": "Explain quantum computing in simple terms"
        }
      }
    },
    {
      "id": "llm_1", 
      "type": "llm",
      "data": {
        "config": {
          "model": "gpt-4o",
          "temperature": 0.7,
          "max_tokens": 1000
        }
      }
    },
    {
      "id": "response_1",
      "type": "response",
      "data": {
        "config": {
          "output_format": "markdown"
        }
      }
    }
  ],
  "edges": [
    {
      "source": "input_1",
      "target": "llm_1", 
      "sourceHandle": "text",
      "targetHandle": "prompt"
    },
    {
      "source": "llm_1",
      "target": "response_1",
      "sourceHandle": "response", 
      "targetHandle": "final_result"
    }
  ]
}
```

## Validation Rules

### ✅ Valid Graph Requirements
- At least one terminal node (node with `isTerminal: true`)
- All required inputs connected
- No circular dependencies
- All nodes reachable from entry points
- Compatible data types between connections

### ❌ Common Validation Errors
- **Missing Terminal Node**: Add a Response node
- **Unsatisfied Inputs**: Connect all required node inputs
- **Orphaned Nodes**: Ensure all nodes are connected to the main flow
- **Type Mismatches**: Check data type compatibility
- **Circular Dependencies**: Remove loops in the graph

## Execution Flow

1. **Validation Phase**
   - Structure validation
   - Dependency analysis
   - Type checking

2. **Planning Phase**
   - Topological sort
   - Execution order generation
   - Resource preparation

3. **Execution Phase**
   - Sequential node execution
   - Input/output handling
   - Error monitoring

4. **Collection Phase**
   - Terminal node results
   - Execution metadata
   - Performance metrics

## Node Implementations

### Built-in Node Types
- **User Prompt**: Text content from a user
- **LLM**: Mock language model (easily replaceable with real API)
- **Response**: Output formatting and display
- **Text Processor**: String manipulation operations
- **Conditional**: Branching logic
- **Data Aggregator**: Data combination and analysis

### Adding Custom Nodes
1. Define node schema in `sampleNodeDefinitions.js`
2. Add implementation in `graphExecutor.server.js`
3. Register with node registry

## Error Handling

The system provides detailed error reporting:
- **Validation Errors**: Pre-execution issues
- **Execution Errors**: Runtime failures
- **Node-specific Errors**: Individual node problems
- **System Errors**: Infrastructure issues

## Performance Features

- **Server-side Execution**: Secure and tamper-proof
- **Real-time Validation**: Immediate feedback
- **Debounced Updates**: Optimized performance
- **Execution Caching**: Result persistence
- **Progress Tracking**: Live execution monitoring

## Security

- All validation and execution happens server-side
- Client cannot tamper with validation logic
- Input sanitization and error handling
- Secure node implementations

This system provides a robust foundation for building complex AI workflows with proper validation, execution, and monitoring capabilities.