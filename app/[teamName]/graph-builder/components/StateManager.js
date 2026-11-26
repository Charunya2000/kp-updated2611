/**
 * State Management System
 * Handles different types of state in the graph builder
 */

export class StateManager {
  constructor() {
    this.nodeStates = new Map(); // Node-local state
    this.flowState = new Map(); // Data flowing between nodes
    this.configurationState = new Map(); // Static configuration
    this.runtimeState = new Map(); // Dynamic runtime values
    this.globalState = {}; // Global workflow state
  }

  /**
   * Node-local state management
   */
  setNodeState(nodeId, state) {
    this.nodeStates.set(nodeId, { ...this.getNodeState(nodeId), ...state });
  }

  getNodeState(nodeId) {
    return this.nodeStates.get(nodeId) || {};
  }

  clearNodeState(nodeId) {
    this.nodeStates.delete(nodeId);
  }

  /**
   * Flow state management (data between nodes)
   */
  setFlowData(connectionId, data) {
    this.flowState.set(connectionId, data);
  }

  getFlowData(connectionId) {
    return this.flowState.get(connectionId);
  }

  clearFlowData(connectionId) {
    this.flowState.delete(connectionId);
  }

  /**
   * Configuration state management
   */
  setNodeConfiguration(nodeId, config) {
    this.configurationState.set(nodeId, { ...this.getNodeConfiguration(nodeId), ...config });
  }

  getNodeConfiguration(nodeId) {
    return this.configurationState.get(nodeId) || {};
  }

  /**
   * Runtime state management
   */
  setRuntimeValue(key, value) {
    this.runtimeState.set(key, value);
  }

  getRuntimeValue(key) {
    return this.runtimeState.get(key);
  }

  /**
   * Global state management
   */
  setGlobalState(key, value) {
    this.globalState[key] = value;
  }

  getGlobalState(key) {
    return this.globalState[key];
  }

  getAllGlobalState() {
    return { ...this.globalState };
  }

  /**
   * Initialize state for a new node based on its schema
   */
  initializeNodeState(nodeId, nodeDefinition) {
    const { stateSchema } = nodeDefinition;

    if (stateSchema?.properties) {
      const initialState = {};
      Object.entries(stateSchema.properties).forEach(([key, definition]) => {
        if (definition.default !== undefined) {
          initialState[key] = definition.default;
        }
      });
      this.setNodeState(nodeId, initialState);
    }
  }

  /**
   * Validate state against schema
   */
  validateNodeState(nodeId, nodeDefinition) {
    const currentState = this.getNodeState(nodeId);
    const { stateSchema } = nodeDefinition;

    if (!stateSchema?.properties) {
      return { valid: true, errors: [] };
    }

    const errors = [];
    const properties = stateSchema.properties;

    Object.entries(properties).forEach(([key, definition]) => {
      const value = currentState[key];

      // Check if required (assuming all state properties are optional by default)
      if (definition.required && (value === undefined || value === null)) {
        errors.push(`State property '${key}' is required`);
        return;
      }

      // Type validation
      if (value !== undefined && value !== null) {
        if (!this.validateStateType(value, definition.type)) {
          errors.push(`State property '${key}' has invalid type`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateStateType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Export state for persistence
   */
  exportState() {
    return {
      nodeStates: Object.fromEntries(this.nodeStates),
      flowState: Object.fromEntries(this.flowState),
      configurationState: Object.fromEntries(this.configurationState),
      runtimeState: Object.fromEntries(this.runtimeState),
      globalState: this.globalState,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import state from persistence
   */
  importState(stateData) {
    try {
      if (stateData.nodeStates) {
        this.nodeStates = new Map(Object.entries(stateData.nodeStates));
      }
      if (stateData.flowState) {
        this.flowState = new Map(Object.entries(stateData.flowState));
      }
      if (stateData.configurationState) {
        this.configurationState = new Map(Object.entries(stateData.configurationState));
      }
      if (stateData.runtimeState) {
        this.runtimeState = new Map(Object.entries(stateData.runtimeState));
      }
      if (stateData.globalState) {
        this.globalState = { ...stateData.globalState };
      }
      return true;
    } catch (error) {
      console.error('Failed to import state:', error);
      return false;
    }
  }

  /**
   * Clear all state
   */
  clearAllState() {
    this.nodeStates.clear();
    this.flowState.clear();
    this.configurationState.clear();
    this.runtimeState.clear();
    this.globalState = {};
  }

  /**
   * Get state summary for debugging
   */
  getStateSummary() {
    return {
      nodeStatesCount: this.nodeStates.size,
      flowStatesCount: this.flowState.size,
      configurationStatesCount: this.configurationState.size,
      runtimeStatesCount: this.runtimeState.size,
      globalStateKeys: Object.keys(this.globalState).length,
      nodeIds: Array.from(this.nodeStates.keys()),
      connectionIds: Array.from(this.flowState.keys())
    };
  }

  /**
   * Update node configuration and merge with existing
   */
  updateNodeConfiguration(nodeId, updates) {
    const currentConfig = this.getNodeConfiguration(nodeId);
    const newConfig = { ...currentConfig, ...updates };
    this.setNodeConfiguration(nodeId, newConfig);
    return newConfig;
  }

  /**
   * Get all state for a specific node
   */
  getAllNodeData(nodeId) {
    return {
      state: this.getNodeState(nodeId),
      configuration: this.getNodeConfiguration(nodeId),
      runtime: this.getRuntimeValue(nodeId)
    };
  }

  /**
   * Remove all data for a specific node
   */
  removeNodeData(nodeId) {
    this.clearNodeState(nodeId);
    this.configurationState.delete(nodeId);
    this.runtimeState.delete(nodeId);

    // Clean up flow data related to this node
    const keysToDelete = [];
    for (const [key] of this.flowState) {
      if (key.includes(nodeId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.flowState.delete(key));
  }
}

// Create singleton instance
const stateManager = new StateManager();

export default stateManager;