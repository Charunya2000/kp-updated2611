/**
 * Sample Node Definitions
 * Example schemas to demonstrate the system
 */

import { is } from 'date-fns/locale/is';
import { NodeDataTypes, UIComponents } from './nodeSchema.js';

export const sampleNodeDefinitions = [
  // type: "llm",
  {
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
          ui: {
            component: UIComponents.TEXT_FIELD,
          }
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
              { value: "gpt-4o", label: "GPT-4o" },
              { value: "llama-2", label: "Llama 2" }
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
  },

  // type: "user_prompt",
  {
    metadata: {
      displayName: "User Prompt",
      type: "user_prompt",
      version: "1.0.0",
      description: "User prompt input node",
      category: "Input",
      icon: "📝",
      color: "#490180"
    },
    inputSchema: {
      properties: {}
    },
    stateSchema: {
      properties: {
      }
    },
    outputSchema: {
      required: ["text_content"],
      properties: {
        text_content: {
          type: NodeDataTypes.STRING,
          description: "Text content",
          default: "",
          persistent: true,
          editable: true, // Allow users to edit this output field
          ui: {
            component: UIComponents.TEXT_AREA,
          }
        }
      }
    },
    executionLogic: {
      implementation: "user_prompt_node",
      async: false
    }
  },

  // type: "text_processor",
  {
    metadata: {
      displayName: "Text Processor",
      type: "text_processor",
      version: "1.0.0",
      description: "Process and transform text content",
      category: "Processing",
      icon: "⚙️",
      color: "#024a51"
    },
    inputSchema: {
      required: ["input_text"],
      properties: {
        input_text: {
          type: NodeDataTypes.STRING,
          description: "Text to process"
        },
        operation: {
          type: NodeDataTypes.SELECT,
          description: "Text processing operation",
          default: "uppercase",
          validation: {
            options: [
              { value: "uppercase", label: "Convert to Uppercase" },
              { value: "lowercase", label: "Convert to Lowercase" },
              { value: "title", label: "Title Case" },
              { value: "reverse", label: "Reverse Text" },
              { value: "word_count", label: "Count Words" },
              { value: "extract_emails", label: "Extract Email Addresses" }
            ]
          }
        },
        custom_regex: {
          type: NodeDataTypes.STRING,
          description: "Custom regex pattern (for advanced operations)",
          validation: {
            pattern: "^.*$"
          }
        }
      }
    },
    stateSchema: {
      properties: {
        processing_stats: {
          type: NodeDataTypes.OBJECT,
          description: "Statistics about processed text",
          default: {},
          persistent: false
        }
      }
    },
    outputSchema: {
      required: ["processed_text"],
      properties: {
        processed_text: {
          type: NodeDataTypes.STRING,
          description: "Processed text output"
        },
        metadata: {
          type: NodeDataTypes.OBJECT,
          description: "Processing metadata and statistics"
        }
      }
    },
    executionLogic: {
      implementation: "text_processor_node",
      async: false
    }
  },

  // type: "conditional",
  {
    metadata: {
      displayName: "Conditional",
      type: "conditional",
      version: "1.0.0",
      description: "Conditional logic node for branching workflows",
      category: "Logic",
      icon: "🔀",
      color: "#025102"
    },
    inputSchema: {
      required: ["condition_value"],
      properties: {
        condition_value: {
          type: NodeDataTypes.STRING,
          description: "Value to evaluate"
        },
        condition_type: {
          type: NodeDataTypes.SELECT,
          description: "Type of condition to evaluate",
          default: "equals",
          validation: {
            options: [
              { value: "equals", label: "Equals" },
              { value: "not_equals", label: "Not Equals" },
              { value: "contains", label: "Contains" },
              { value: "starts_with", label: "Starts With" },
              { value: "ends_with", label: "Ends With" },
              { value: "regex", label: "Regex Match" },
              { value: "is_empty", label: "Is Empty" },
              { value: "is_not_empty", label: "Is Not Empty" }
            ]
          }
        },
        comparison_value: {
          type: NodeDataTypes.STRING,
          description: "Value to compare against"
        },
        case_sensitive: {
          type: NodeDataTypes.BOOLEAN,
          description: "Whether comparison should be case sensitive",
          default: false
        }
      }
    },
    stateSchema: {
      properties: {
        last_evaluation: {
          type: NodeDataTypes.BOOLEAN,
          description: "Result of the last condition evaluation",
          persistent: false
        }
      }
    },
    outputSchema: {
      required: ["result"],
      properties: {
        result: {
          type: NodeDataTypes.BOOLEAN,
          description: "Boolean result of the condition evaluation"
        },
        true_path: {
          type: NodeDataTypes.STRING,
          description: "Output for true condition path"
        },
        false_path: {
          type: NodeDataTypes.STRING,
          description: "Output for false condition path"
        }
      }
    },
    executionLogic: {
      implementation: "conditional_node",
      async: false
    }
  },

  // type: "data_aggregator",
  {
    metadata: {
      displayName: "Data Aggregator",
      type: "data_aggregator",
      version: "1.0.0",
      description: "Aggregate and combine multiple data inputs",
      category: "Processing",
      icon: "📊",
      color: "#655000"
    },
    inputSchema: {
      properties: {
        input_data: {
          type: NodeDataTypes.ARRAY,
          description: "Array of data to aggregate"
        },
        aggregation_method: {
          type: NodeDataTypes.SELECT,
          description: "Method for aggregating data",
          default: "concatenate",
          validation: {
            options: [
              { value: "concatenate", label: "Concatenate" },
              { value: "merge_objects", label: "Merge Objects" },
              { value: "sum_numbers", label: "Sum Numbers" },
              { value: "average_numbers", label: "Average Numbers" },
              { value: "count_items", label: "Count Items" },
              { value: "unique_values", label: "Unique Values Only" }
            ]
          }
        },
        separator: {
          type: NodeDataTypes.STRING,
          description: "Separator for concatenation",
          default: ", "
        }
      }
    },
    stateSchema: {
      properties: {
        aggregation_cache: {
          type: NodeDataTypes.OBJECT,
          description: "Cache for aggregated results",
          default: {},
          persistent: false
        }
      }
    },
    outputSchema: {
      required: ["aggregated_result"],
      properties: {
        aggregated_result: {
          type: NodeDataTypes.STRING,
          description: "Result of the aggregation operation"
        },
        item_count: {
          type: NodeDataTypes.NUMBER,
          description: "Number of items that were aggregated"
        }
      }
    },
    executionLogic: {
      implementation: "data_aggregator_node",
      async: false
    }
  },

  // type: "response",
  {
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
      properties: {
        save_to_file: {
          type: NodeDataTypes.BOOLEAN,
          description: "Whether to save response to a file",
          default: false
        }
      }
    },
    outputSchema: {
      properties: {
        formatted_output: {
          type: NodeDataTypes.STRING,
          description: "Formatted final response"
        }
      }
    },
    executionLogic: {
      implementation: "response_node",
      async: false
    }
  }
];

export default sampleNodeDefinitions;