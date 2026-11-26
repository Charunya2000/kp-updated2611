# Schema-Driven Graph Builder

A visual graph builder similar to Langflow that allows developers to build nodes purely from JSON schemas. The system automatically interprets how input, state, and output forms should be displayed and validates connections between nodes.

## Core Architecture

### 1. Node Definition Schema
Each node is defined by a JSON schema containing:
- **Metadata**: Node type, version, description, category, icon, color
- **Input Schema**: Required/optional inputs with types and validation rules
- **State Schema**: Internal node state structure and default values  
- **Output Schema**: Required outputs with types
- **Execution Logic**: Reference to implementation with async/timeout settings

### 2. Component Registry Pattern
- Developers register node types with their schemas
- Visual builder dynamically discovers available node types
- Runtime resolves node types to their implementations
- Versioning supports backward compatibility

### 3. Schema-Driven UI Generation
- Automatically generates visual node representations
- Creates input/output handles dynamically based on schema
- Generates configuration forms for state management
- Validates connections between compatible types

### 4. State Management Strategy
- **Node-local state**: Internal variables that don't flow between nodes
- **Flow state**: Data that passes through graph execution
- **Configuration state**: Static parameters set at design time
- **Runtime state**: Dynamic values during execution

## Getting Started

### Basic Node Definition

```javascript
const myNodeDefinition = {
  metadata: {
    type: "my_custom_node",
    version: "1.0.0", 
    description: "Description of what this node does",
    category: "My Category",
    icon: "🔧",
    color: "#e3f2fd"
  },
  inputSchema: {
    required: ["required_input"],
    properties: {
      required_input: {
        type: "string",
        description: "This input is required"
      },
      optional_input: {
        type: "number", 
        description: "This input is optional",
        default: 42,
        validation: { min: 0, max: 100 }
      }
    }
  },
  stateSchema: {
    properties: {
      internal_counter: {
        type: "number",
        default: 0,
        persistent: true,
        description: "Tracks internal state"
      }
    }
  },
  outputSchema: {
    required: ["result"],
    properties: {
      result: {
        type: "string",
        description: "The processed result"
      }
    }
  },
  executionLogic: {
    implementation: "my_custom_implementation",
    async: true,
    timeout: 5000
  }
};
```

### Registering Your Node

```javascript
import nodeRegistry from './components/NodeRegistry.js';

// Register the node definition
nodeRegistry.registerNode(myNodeDefinition, myImplementationFunction);

// Implementation function
async function myImplementationFunction(inputs, state, context) {
  const { required_input, optional_input } = inputs;
  const { internal_counter } = state;
  
  // Your logic here
  const result = `Processed: ${required_input} with ${optional_input}`;
  
  // Return outputs and updated state
  return {
    outputs: {
      result: result
    },
    newState: {
      ...state,
      internal_counter: internal_counter + 1
    }
  };
}
```

## Supported Data Types

- `string` - Text input
- `number` - Numeric input  
- `boolean` - Checkbox
- `array` - Multi-select
- `object` - JSON editor
- `text` - Text area
- `code` - Code editor
- `select` - Dropdown selection
- `multiSelect` - Multiple selection

## UI Components

The system automatically chooses appropriate UI components based on data types, but you can override:

```javascript
my_field: {
  type: "string",
  ui: {
    component: "textArea", // Override default
    props: { rows: 4 }     // Component-specific props
  }
}
```

Available UI components:
- `textField` - Single line text
- `textArea` - Multi-line text  
- `numberField` - Number input
- `checkbox` - Boolean checkbox
- `select` - Dropdown
- `multiSelect` - Multi-selection
- `slider` - Numeric slider
- `jsonEditor` - JSON object editor
- `codeEditor` - Code syntax editor

## Validation Rules

Add validation to input fields:

```javascript
my_field: {
  type: "string",
  validation: {
    pattern: "^[a-zA-Z0-9]+$",     // Regex pattern
    minLength: 3,                  // Minimum length
    maxLength: 50,                 // Maximum length
    options: [                     // For select fields
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" }
    ]
  }
}
```

For numbers:
```javascript
numeric_field: {
  type: "number",
  validation: {
    min: 0,      // Minimum value
    max: 100,    // Maximum value  
    step: 0.1    // Step increment
  }
}
```

## Connection Validation

The system automatically validates connections between nodes:
- Type compatibility between source outputs and target inputs
- Required vs optional connections
- Prevents invalid connections with helpful error messages

## State Persistence

Control which state properties persist:

```javascript
stateSchema: {
  properties: {
    persistent_data: {
      type: "object",
      persistent: true,    // Saved between sessions
      description: "Data that persists"
    },
    temporary_cache: {
      type: "object", 
      persistent: false,   // Cleared on restart
      description: "Temporary cache data"
    }
  }
}
```

## Categories and Organization

Organize nodes by category:

```javascript
metadata: {
  category: "AI/ML",        // Groups in node palette
  icon: "🤖",              // Visual identifier
  color: "#e3f2fd"         // Node background color
}
```

## Example Workflow

1. Define your node schema
2. Implement the execution function
3. Register with the node registry
4. Nodes appear automatically in the builder
5. Users can drag, configure, and connect nodes
6. System validates connections and configurations
7. Execute the graph with proper data flow

## Advanced Features

### Custom Validation
```javascript
// Custom validation in your implementation
function validateCustomLogic(inputs) {
  if (inputs.field1 > inputs.field2) {
    throw new Error("Field1 cannot be greater than Field2");
  }
}
```

### Async Operations
```javascript
executionLogic: {
  async: true,      // Supports async operations
  timeout: 30000    // 30 second timeout
}
```

### Error Handling
```javascript
async function myImplementation(inputs, state, context) {
  try {
    // Your logic
    return { outputs: {...} };
  } catch (error) {
    return { 
      outputs: {...},
      error: error.message 
    };
  }
}
```

## File Structure

```
langgraph-builder/
├── components/
│   ├── NodeRegistry.js          # Node registration system
│   ├── DynamicNode.js          # Visual node component  
│   ├── SchemaUIGenerator.js    # Form generation
│   └── StateManager.js         # State management
├── schemas/
│   ├── nodeSchema.js           # Core schema definitions
│   └── sampleNodeDefinitions.js # Example nodes
├── examples/
│   └── customNodeExamples.js   # Usage examples
└── page.js                     # Main builder interface
```

## Best Practices

1. **Use descriptive names** for inputs, outputs, and states
2. **Provide helpful descriptions** for all fields
3. **Set sensible defaults** for optional inputs
4. **Use appropriate data types** for better UX
5. **Add validation rules** to prevent errors
6. **Test your implementations** thoroughly
7. **Document your custom nodes** for other developers

## Contributing

To add new UI components or extend the system:

1. Add component to `UIComponents` enum
2. Implement in `SchemaUIGenerator.js`
3. Update type mappings as needed
4. Test with various node definitions

The system is designed to be extensible - you can add new data types, UI components, and validation rules as needed.