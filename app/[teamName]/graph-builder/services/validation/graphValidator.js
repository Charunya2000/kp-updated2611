/**
 * Server-side Graph Validation System
 * Validates workflow graphs for structural integrity and execution readiness
 * Cannot be tampered with on client side
 */

import { sampleNodeDefinitions } from '../schemas/sampleNodeDefinitions.js';

// Internal error class - not exported
class GraphValidationError extends Error {
  constructor(message, nodeId = null, type = 'GENERAL') {
    super(message);
    this.name = 'GraphValidationError';
    this.nodeId = nodeId;
    this.type = type;
  }
}

class ServerGraphValidator {
  constructor(nodeDefinitions) {
    this.nodeDefinitions = new Map(
      nodeDefinitions.map(def => [def.metadata.type, def])
    );
  }

  /**
   * Validate complete graph structure
   * @param {Object} graph - Graph object with nodes and edges
   * @returns {Object} Validation result with errors and warnings
   */
  validateGraph(graph) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      validationDetails: {
        terminalNodes: [],
        orphanedNodes: [],
        unsatisfiedInputs: [],
        typeConflicts: [],
        circularDependencies: []
      }
    };

    try {
      // Input sanitization
      if (!graph || typeof graph !== 'object') {
        throw new Error('Invalid graph object provided');
      }

      if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
        throw new Error('Graph must contain nodes and edges arrays');
      }

      // 1. Validate terminal nodes
      this.validateTerminalNodes(graph, result);

      // 2. Validate input satisfaction
      this.validateInputSatisfaction(graph, result);

      // 3. Validate graph connectivity
      this.validateConnectivity(graph, result);

      // 4. Validate type compatibility
      this.validateTypeCompatibility(graph, result);

      // 5. Check for circular dependencies
      this.validateNoCycles(graph, result);

    } catch (error) {
      result.errors.push(new GraphValidationError(error.message));
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate terminal node requirements
   */
  validateTerminalNodes(graph, result) {
    const terminalNodes = graph.nodes.filter(node => {
      const definition = this.nodeDefinitions.get(node.type);
      return definition?.metadata?.isTerminal === true;
    });

    result.validationDetails.terminalNodes = terminalNodes.map(n => n.id);

    if (terminalNodes.length === 0) {
      result.errors.push(new GraphValidationError(
        'Graph must have at least one terminal node',
        null,
        'MISSING_TERMINAL'
      ));
      return;
    }

    // Check that terminal nodes have no outgoing connections
    terminalNodes.forEach(node => {
      const outgoingEdges = graph.edges.filter(edge => edge.source === node.id);
      if (outgoingEdges.length > 0) {
        result.errors.push(new GraphValidationError(
          `Terminal node '${node.id}' cannot have outgoing connections`,
          node.id,
          'TERMINAL_WITH_OUTPUTS'
        ));
      }
    });
  }

  /**
   * Validate that all required inputs are satisfied
   */
  validateInputSatisfaction(graph, result) {
    graph.nodes.forEach(node => {
      const definition = this.nodeDefinitions.get(node.type);
      if (!definition) {
        result.errors.push(new GraphValidationError(
          `Unknown node type: ${node.type}`,
          node.id,
          'UNKNOWN_NODE_TYPE'
        ));
        return;
      }

      const requiredInputs = definition.inputSchema?.required || [];

      requiredInputs.forEach(inputName => {
        const hasConnection = graph.edges.some(edge =>
          edge.target === node.id && edge.targetHandle === inputName
        );

        if (!hasConnection) {
          result.validationDetails.unsatisfiedInputs.push({
            nodeId: node.id,
            inputName,
            nodeType: node.type
          });

          result.errors.push(new GraphValidationError(
            `Required input '${inputName}' not connected for node '${node.id}'`,
            node.id,
            'UNSATISFIED_INPUT'
          ));
        }
      });
    });
  }

  /**
   * Validate graph connectivity and find orphaned nodes
   */
  validateConnectivity(graph, result) {
    // Find nodes with no incoming edges (potential entry points)
    const entryNodes = graph.nodes.filter(node =>
      !graph.edges.some(edge => edge.target === node.id)
    );

    if (entryNodes.length === 0) {
      result.errors.push(new GraphValidationError(
        'Graph must have at least one entry point (node with no incoming connections)',
        null,
        'NO_ENTRY_POINT'
      ));
      return;
    }

    // Perform DFS to find all reachable nodes
    const reachableNodes = new Set();
    const visited = new Set();

    const dfs = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      reachableNodes.add(nodeId);

      graph.edges
        .filter(edge => edge.source === nodeId)
        .forEach(edge => dfs(edge.target));
    };

    entryNodes.forEach(node => dfs(node.id));

    // Find orphaned nodes
    const orphanedNodes = graph.nodes
      .filter(node => !reachableNodes.has(node.id))
      .map(node => node.id);

    result.validationDetails.orphanedNodes = orphanedNodes;

    if (orphanedNodes.length > 0) {
      result.warnings.push(new GraphValidationError(
        `Found ${orphanedNodes.length} orphaned nodes: ${orphanedNodes.join(', ')}`,
        null,
        'ORPHANED_NODES'
      ));
    }
  }

  /**
   * Validate type compatibility between connected nodes
   */
  validateTypeCompatibility(graph, result) {
    graph.edges.forEach(edge => {
      const sourceNode = graph.nodes.find(n => n.id === edge.source);
      const targetNode = graph.nodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) return;

      const sourceDefinition = this.nodeDefinitions.get(sourceNode.type);
      const targetDefinition = this.nodeDefinitions.get(targetNode.type);

      if (!sourceDefinition || !targetDefinition) return;

      const outputProperty = sourceDefinition.outputSchema?.properties?.[edge.sourceHandle];
      const inputProperty = targetDefinition.inputSchema?.properties?.[edge.targetHandle];

      if (outputProperty && inputProperty) {
        if (outputProperty.type !== inputProperty.type) {
          result.validationDetails.typeConflicts.push({
            edge,
            sourceType: outputProperty.type,
            targetType: inputProperty.type
          });

          result.warnings.push(new GraphValidationError(
            `Type mismatch: ${sourceNode.id}.${edge.sourceHandle} (${outputProperty.type}) -> ${targetNode.id}.${edge.targetHandle} (${inputProperty.type})`,
            targetNode.id,
            'TYPE_MISMATCH'
          ));
        }
      }
    });
  }

  /**
   * Check for circular dependencies using DFS
   */
  validateNoCycles(graph, result) {
    const visiting = new Set();
    const visited = new Set();

    const hasCycle = (nodeId, path = []) => {
      if (visiting.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart).concat(nodeId);
        result.validationDetails.circularDependencies.push(cycle);
        return true;
      }

      if (visited.has(nodeId)) return false;

      visiting.add(nodeId);
      path.push(nodeId);

      const neighbors = graph.edges
        .filter(edge => edge.source === nodeId)
        .map(edge => edge.target);

      for (const neighbor of neighbors) {
        if (hasCycle(neighbor, [...path])) return true;
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      path.pop();
      return false;
    };

    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) {
          result.errors.push(new GraphValidationError(
            'Circular dependency detected in graph',
            null,
            'CIRCULAR_DEPENDENCY'
          ));
        }
      }
    });
  }

  /**
   * Generate execution order for the graph
   */
  generateExecutionOrder(graph) {
    const result = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected involving node ${nodeId}`);
      }

      visiting.add(nodeId);

      // Find all nodes that this node depends on (incoming edges)
      const dependencies = graph.edges
        .filter(edge => edge.target === nodeId)
        .map(edge => edge.source);

      // Visit dependencies first
      dependencies.forEach(depId => visit(depId));

      visiting.delete(nodeId);
      visited.add(nodeId);
      result.push(nodeId);
    };

    // Start with entry nodes (nodes with no incoming edges)
    const entryNodes = graph.nodes
      .filter(node => !graph.edges.some(edge => edge.target === node.id))
      .map(node => node.id);

    entryNodes.forEach(nodeId => visit(nodeId));

    // Visit any remaining nodes (shouldn't happen in a valid graph)
    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        visit(node.id);
      }
    });

    return result;
  }
}

// Export the class and initialized instance
export { GraphValidationError, ServerGraphValidator };

// Initialize and export server validator with node definitions
export const serverValidator = new ServerGraphValidator(sampleNodeDefinitions);