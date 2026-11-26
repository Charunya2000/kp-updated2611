'use server'

/**
 * Server-side Graph Validation System
 * Validates workflow graphs for structural integrity and execution readiness
 * Cannot be tampered with on client side
 */

import { sampleNodeDefinitions } from '../schemas/sampleNodeDefinitions.js';

export class GraphValidationError extends Error {
  constructor(message, nodeId = null, type = 'GENERAL') {
    super(message);
    this.name = 'GraphValidationError';
    this.nodeId = nodeId;
    this.type = type;
  }
}

class GraphValidator {
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
}

// Initialize server validator with node definitions
const serverValidator = new GraphValidator(sampleNodeDefinitions);

/**
 * Server action to validate a complete graph
 */
export async function validateGraph(graph) {
  try {
    return serverValidator.validateGraph(graph);
  } catch (error) {
    return {
      isValid: false,
      errors: [new GraphValidationError(`Server validation error: ${error.message}`)],
      warnings: [],
      validationDetails: {
        terminalNodes: [],
        orphanedNodes: [],
        unsatisfiedInputs: [],
        typeConflicts: [],
        circularDependencies: []
      }
    };
  }
}

/**
 * Quick server action to check if graph has terminal nodes
 */
export async function quickValidateTerminal(graph) {
  try {
    if (!graph?.nodes || !Array.isArray(graph.nodes)) {
      return false;
    }

    return graph.nodes.some(node => {
      const definition = serverValidator.nodeDefinitions.get(node.type);
      return definition?.metadata?.isTerminal === true;
    });
  } catch (error) {
    console.error('Terminal validation error:', error);
    return false;
  }
}

/**
 * Quick server action to validate inputs for a specific node
 */
export async function quickValidateNodeInputs(graph, nodeId) {
  try {
    if (!graph?.nodes || !Array.isArray(graph.nodes) || !nodeId) {
      return false;
    }

    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) return false;

    const definition = serverValidator.nodeDefinitions.get(node.type);
    const requiredInputs = definition?.inputSchema?.required || [];

    return requiredInputs.every(inputName =>
      graph.edges.some(edge =>
        edge.target === nodeId && edge.targetHandle === inputName
      )
    );
  } catch (error) {
    console.error('Node input validation error:', error);
    return false;
  }
}

/**
 * Server action to get validation status for UI indicators
 */
export async function getValidationStatus(graph) {
  try {
    const result = await validateGraph(graph);

    return {
      hasTerminalNode: result.validationDetails.terminalNodes.length > 0,
      hasErrors: result.errors.length > 0,
      hasWarnings: result.warnings.length > 0,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      canExecute: result.isValid
    };
  } catch (error) {
    return {
      hasTerminalNode: false,
      hasErrors: true,
      hasWarnings: false,
      errorCount: 1,
      warningCount: 0,
      canExecute: false
    };
  }
}