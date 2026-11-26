/**
 * Core Node Definition Schema
 * Defines the standardized structure for node definitions
 */

export const NodeSchemaDefinition = {
  // Schema version for backward compatibility
  version: "1.0.0",

  // Base node schema structure
  schema: {
    type: "object",
    required: ["metadata", "inputSchema", "outputSchema"],
    properties: {
      metadata: {
        type: "object",
        required: ["type", "version", "description"],
        properties: {
          type: { type: "string" },
          version: { type: "string" },
          description: { type: "string" },
          category: { type: "string" },
          icon: { type: "string" },
          color: { type: "string" }
        }
      },
      inputSchema: {
        type: "object",
        properties: {
          required: {
            type: "array",
            items: { type: "string" }
          },
          properties: {
            type: "object",
            patternProperties: {
              ".*": {
                type: "object",
                properties: {
                  type: { type: "string" },
                  description: { type: "string" },
                  default: {},
                  validation: { type: "object" },
                  ui: {
                    type: "object",
                    properties: {
                      component: { type: "string" },
                      props: { type: "object" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      stateSchema: {
        type: "object",
        properties: {
          properties: {
            type: "object",
            patternProperties: {
              ".*": {
                type: "object",
                properties: {
                  type: { type: "string" },
                  default: {},
                  persistent: { type: "boolean" },
                  description: { type: "string" }
                }
              }
            }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          required: {
            type: "array",
            items: { type: "string" }
          },
          properties: {
            type: "object",
            patternProperties: {
              ".*": {
                type: "object",
                properties: {
                  type: { type: "string" },
                  description: { type: "string" }
                }
              }
            }
          }
        }
      },
      executionLogic: {
        type: "object",
        properties: {
          implementation: { type: "string" },
          async: { type: "boolean" },
          timeout: { type: "number" }
        }
      }
    }
  }
};

/**
 * Validates a node definition against the schema
 */
export function validateNodeDefinition(nodeDefinition) {
  try {
    // Basic structure validation
    if (!nodeDefinition.metadata || !nodeDefinition.inputSchema || !nodeDefinition.outputSchema) {
      return {
        valid: false,
        errors: ["Missing required fields: metadata, inputSchema, or outputSchema"]
      };
    }

    // Validate metadata
    const metadata = nodeDefinition.metadata;
    if (!metadata.type || !metadata.version || !metadata.description) {
      return {
        valid: false,
        errors: ["Metadata must include type, version, and description"]
      };
    }

    // Validate input/output schemas have proper structure
    const validateSchema = (schema, schemaName) => {
      if (!schema.properties) {
        return `${schemaName} must have properties defined`;
      }
      return null;
    };

    const inputError = validateSchema(nodeDefinition.inputSchema, "inputSchema");
    if (inputError) {
      return { valid: false, errors: [inputError] };
    }

    const outputError = validateSchema(nodeDefinition.outputSchema, "outputSchema");
    if (outputError) {
      return { valid: false, errors: [outputError] };
    }

    return { valid: true, errors: [] };
  } catch (error) {
    return {
      valid: false,
      errors: [`Validation error: ${error.message}`]
    };
  }
}

/**
 * Type definitions for better IDE support
 */
export const NodeDataTypes = {
  STRING: "string",
  NUMBER: "number",
  BOOLEAN: "boolean",
  ARRAY: "array",
  OBJECT: "object",
  FILE: "file",
  JSON: "json",
  CODE: "code",
  SELECT: "select",
  MULTI_SELECT: "multiSelect"
};

export const UIComponents = {
  TEXT_FIELD: "textField",
  NUMBER_FIELD: "numberField",
  CHECKBOX: "checkbox",
  SELECT: "select",
  MULTI_SELECT: "multiSelect",
  TEXT_AREA: "textArea",
  CODE_EDITOR: "codeEditor",
  FILE_UPLOAD: "fileUpload",
  JSON_EDITOR: "jsonEditor",
  SLIDER: "slider",
  COLOR_PICKER: "colorPicker"
};