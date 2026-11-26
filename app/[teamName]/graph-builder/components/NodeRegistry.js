/**
 * Node Registry System
 * Manages registration, discovery, and resolution of node types
 */

class NodeRegistry {
  constructor() {
    this.registeredNodes = new Map();
    this.implementations = new Map();
    this.categories = new Set();
    this.onLoadHandlers = new Map(); // Store onLoad handlers by node type
    this.onChangeHandlers = new Map(); // Store onChange handlers by node type and property
  }

  /**
   * Register a new node type with its schema and implementation
   */
  registerNode(nodeDefinition, implementation = null) {
    const { metadata } = nodeDefinition;
    const nodeType = metadata.type;

    // Store the node definition
    this.registeredNodes.set(nodeType, {
      ...nodeDefinition,
      registeredAt: new Date().toISOString()
    });

    // Store the implementation if provided
    if (implementation) {
      this.implementations.set(nodeType, implementation);

      // Register onLoad handler if provided
      if (implementation.onLoad) {
        this.registerOnLoad(nodeType, implementation.onLoad);
      }

      // Register onChange handlers if provided
      if (implementation.onChange) {
        Object.entries(implementation.onChange).forEach(([propertyKey, handler]) => {
          this.registerOnChange(nodeType, propertyKey, handler);
        });
      }
    }

    // Track categories
    if (metadata.category) {
      this.categories.add(metadata.category);
    }

    console.log(`Registered node type: ${nodeType}`);
    return true;
  }

  /**
   * Get a specific node definition by type
   */
  getNodeDefinition(nodeType) {
    return this.registeredNodes.get(nodeType);
  }

  /**
   * Get all registered node types
   */
  getAllNodeTypes() {
    return Array.from(this.registeredNodes.keys());
  }

  /**
   * Get all node definitions
   */
  getAllNodeDefinitions() {
    return Array.from(this.registeredNodes.values());
  }

  /**
   * Get nodes by category
   */
  getNodesByCategory(category) {
    return Array.from(this.registeredNodes.values())
      .filter(node => node.metadata.category === category);
  }

  /**
   * Get all categories
   */
  getCategories() {
    return Array.from(this.categories);
  }

  /**
   * Get implementation for a node type
   */
  getImplementation(nodeType) {
    return this.implementations.get(nodeType);
  }

  /**
   * Register onLoad handler for a node type
   */
  registerOnLoad(nodeType, handler) {
    this.onLoadHandlers.set(nodeType, handler);
    console.log(`Registered onLoad handler for node type: ${nodeType}`);
  }

  /**
   * Get onLoad handler for a node type
   */
  getOnLoadHandler(nodeType) {
    return this.onLoadHandlers.get(nodeType);
  }

  /**
   * Register onChange handler for a specific property of a node type
   */
  registerOnChange(nodeType, propertyKey, handler) {
    const key = `${nodeType}.${propertyKey}`;
    this.onChangeHandlers.set(key, handler);
    console.log(`Registered onChange handler for ${nodeType}.${propertyKey}`);
  }

  /**
   * Get onChange handler for a specific property of a node type
   */
  getOnChangeHandler(nodeType, propertyKey) {
    const key = `${nodeType}.${propertyKey}`;
    return this.onChangeHandlers.get(key);
  }

  /**
   * Check if a node type is registered
   */
  hasNodeType(nodeType) {
    return this.registeredNodes.has(nodeType);
  }

  /**
   * Unregister a node type
   */
  unregisterNode(nodeType) {
    const removed = this.registeredNodes.delete(nodeType);
    this.implementations.delete(nodeType);
    return removed;
  }

  /**
   * Get compatible target nodes for a given source output
   */
  getCompatibleNodes(sourceNodeType, outputKey) {
    const sourceNode = this.getNodeDefinition(sourceNodeType);
    if (!sourceNode) return [];

    const outputType = sourceNode.outputSchema.properties?.[outputKey]?.type;
    if (!outputType) return [];

    return this.getAllNodeDefinitions().filter(targetNode => {
      return Object.entries(targetNode.inputSchema.properties || {}).some(([inputKey, inputDef]) => {
        return inputDef.type === outputType || inputDef.type === 'any';
      });
    });
  }

  /**
   * Validate connection compatibility
   */
  validateConnection(sourceNodeType, sourceOutput, targetNodeType, targetInput) {
    const sourceNode = this.getNodeDefinition(sourceNodeType);
    const targetNode = this.getNodeDefinition(targetNodeType);

    if (!sourceNode || !targetNode) {
      return { valid: false, error: "Node type not found" };
    }

    const sourceOutputDef = sourceNode.outputSchema.properties?.[sourceOutput];
    const targetInputDef = targetNode.inputSchema.properties?.[targetInput];

    if (!sourceOutputDef) {
      return { valid: false, error: `Output '${sourceOutput}' not found on source node` };
    }

    if (!targetInputDef) {
      return { valid: false, error: `Input '${targetInput}' not found on target node` };
    }

    // Check type compatibility
    if (targetInputDef.type !== 'any' && sourceOutputDef.type !== targetInputDef.type) {
      return {
        valid: false,
        error: `Type mismatch: ${sourceOutputDef.type} cannot connect to ${targetInputDef.type}`
      };
    }

    return { valid: true };
  }

  /**
   * Get node definition with resolved defaults
   */
  getNodeWithDefaults(nodeType) {
    const nodeDef = this.getNodeDefinition(nodeType);
    if (!nodeDef) return null;

    const nodeWithDefaults = { ...nodeDef };

    // Apply input defaults
    if (nodeWithDefaults.inputSchema?.properties) {
      Object.entries(nodeWithDefaults.inputSchema.properties).forEach(([key, prop]) => {
        if (prop.default !== undefined) {
          nodeWithDefaults.inputSchema.properties[key] = { ...prop };
        }
      });
    }

    // Apply state defaults
    if (nodeWithDefaults.stateSchema?.properties) {
      Object.entries(nodeWithDefaults.stateSchema.properties).forEach(([key, prop]) => {
        if (prop.default !== undefined) {
          nodeWithDefaults.stateSchema.properties[key] = { ...prop };
        }
      });
    }

    return nodeWithDefaults;
  }

  /**
   * Export registry state for persistence
   */
  exportRegistry() {
    return {
      nodes: Array.from(this.registeredNodes.entries()),
      categories: Array.from(this.categories),
      version: "1.0.0",
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import registry state
   */
  importRegistry(registryData) {
    try {
      this.registeredNodes.clear();
      this.categories.clear();

      registryData.nodes.forEach(([nodeType, nodeDef]) => {
        this.registeredNodes.set(nodeType, nodeDef);
        if (nodeDef.metadata.category) {
          this.categories.add(nodeDef.metadata.category);
        }
      });

      console.log(`Imported ${registryData.nodes.length} node types`);
      return true;
    } catch (error) {
      console.error("Failed to import registry:", error);
      return false;
    }
  }

  /**
   * Debug helper - Get all registered handlers
   */
  getRegisteredHandlers() {
    return {
      onLoadHandlers: Array.from(this.onLoadHandlers.keys()),
      onChangeHandlers: Array.from(this.onChangeHandlers.keys()),
      implementations: Array.from(this.implementations.keys())
    };
  }
}

// Create singleton instance
const nodeRegistry = new NodeRegistry();

export default nodeRegistry;
export { NodeRegistry };