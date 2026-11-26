/**
 * Server-side Graph Execution Engine
 * Executes validated graphs following the correct execution path
 */

import { serverValidator } from '../validation/graphValidator.js';
import { sampleNodeDefinitions } from '../schemas/sampleNodeDefinitions.js';
import { nodeImplementations } from '../../nodes/index.js';
import { version } from 'react';

/**
 * Centralized logging function for GraphExecutor
 * @param {string} functionName - The name of the function calling the log
 * @param {string} action - The action being performed
 * @param {Object} graph - The graph object or graph id
 * @param {Object} additionalDetails - Any additional details to log
 */
function log(functionName, action, graph, additionalDetails = {}) {
  const graphId = typeof graph === 'string' ? graph : (graph?.id || 'unknown');

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: `GraphExecutor.${functionName}`,
      detail: {
        id: graphId,
        graphName: graph?.name || 'unknown',
        nodeCount: graph?.nodes?.length || 0,
        edgeCount: graph?.edges?.length || 0,
        version: graph?.version || 'unknown',
        action,
        ...additionalDetails
      }
    }
  }));
}

// Internal error class - not exported
class GraphExecutionError extends Error {
  constructor(message, nodeId = null, executionContext = null) {
    super(message);
    this.name = 'GraphExecutionError';
    this.nodeId = nodeId;
    this.executionContext = executionContext;
  }
}

class GraphExecutor {
  constructor(graph) {
    log('constructor', 'initializing_executor', graph);

    // Validate graph structure
    if (!graph || typeof graph !== 'object') {
      log('constructor', 'validation_failed', 'unknown', { reason: 'invalid_graph_object' });
      throw new Error('Graph object is required');
    }

    if (!graph.id || !graph.name || !graph.nodes || !graph.edges) {
      log('constructor', 'validation_failed', graph, { reason: 'missing_required_properties' });
      throw new Error('Graph must have id, name, nodes, and edges properties');
    }

    // Store the graph object
    this.graph = {
      id: graph.id,
      name: graph.name,
      description: graph.description || '',
      version: graph.version || '1.0.0',
      nodes: graph.nodes,
      edges: graph.edges
    };

    log('constructor', 'graph_stored', this.graph);

    // Extract node definitions from the graph nodes
    this.nodeDefinitions = new Map();
    graph.nodes.forEach(node => {
      if (node.data?.nodeDefinition) {
        this.nodeDefinitions.set(node.type, node.data.nodeDefinition);
      }
    });

    log('constructor', 'node_definitions_extracted', this.graph, {
      definitionCount: this.nodeDefinitions.size,
      nodeTypes: Array.from(this.nodeDefinitions.keys())
    });

    this.nodeImplementations = new Map();
    this.registerNodeImplementations();

    log('constructor', 'executor_initialized', this.graph);
  }

  /**
   * Register node implementations from extracted files
   */
  registerNodeImplementations() {
    log('registerNodeImplementations', 'registering_implementations', this.graph, {
      availableImplementations: nodeImplementations.length
    });

    nodeImplementations.forEach(nodeConfig => {
      this.nodeImplementations.set(nodeConfig.implementationKey, nodeConfig.implementation);
      log('registerNodeImplementations', 'implementation_registered', this.graph, {
        implementationKey: nodeConfig.implementationKey,
      });
    });

    log('registerNodeImplementations', 'registration_completed', this.graph, {
      totalRegistered: this.nodeImplementations.size,
      registeredKeys: Array.from(this.nodeImplementations.keys())
    });
  }

  /**
   * Get graph information
   */
  getGraphInfo() {
    const graphInfo = {
      id: this.graph.id,
      name: this.graph.name,
      description: this.graph.description,
      version: this.graph.version,
      nodeCount: this.graph.nodes.length,
      edgeCount: this.graph.edges.length,
      nodeTypes: Array.from(this.nodeDefinitions.keys())
    };

    log('getGraphInfo', 'graph_info_requested', this.graph, graphInfo);

    return graphInfo;
  }

  /**
   * Execute the graph stored in this executor instance
   */
  async executeGraph(executionOptions = {}) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    log('executeGraph', 'start', this.graph, {
      executionId,
      options: executionOptions,
      phase: 'start'
    });

    try {
      // Step 1: Validate the graph
      log('executeGraph', 'validating_graph', this.graph, {
        executionId,
        phase: 'validation'
      });

      const validation = serverValidator.validateGraph(this.graph);
      if (!validation.isValid) {
        log('executeGraph', 'validation_failed', this.graph, {
          executionId,
          phase: 'validation',
          result: 'failed',
          errors: validation.errors.map(e => e.message)
        });
        throw new GraphExecutionError(
          `Graph validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        );
      }

      log('executeGraph', 'validation_passed', this.graph, {
        executionId,
        phase: 'validation',
        result: 'passed'
      });

      // Step 2: Generate execution order
      log('executeGraph', 'generating_order', this.graph, {
        executionId,
        phase: 'execution_order'
      });

      const executionOrder = serverValidator.generateExecutionOrder(this.graph);

      log('executeGraph', 'execution_order_generated', this.graph, {
        executionId,
        phase: 'execution_order',
        result: 'generated',
        order: executionOrder,
        nodeSequence: executionOrder.length
      });

      // Step 3: Initialize execution context
      log('executeGraph', 'creating_execution_context', this.graph, {
        executionId,
        phase: 'initialization'
      });

      const executionContext = {
        executionId,
        startTime: new Date().toISOString(),
        nodeOutputs: new Map(),
        executionLog: [],
        options: executionOptions,
        // Add streaming support
        onToken: executionOptions.onToken,
        streaming: executionOptions.streaming || false,
        hadStreamingOutput: false
      };

      // Step 4: Execute nodes in order
      log('executeGraph', 'starting_node_execution', this.graph, {
        executionId,
        phase: 'execution',
        totalNodes: executionOrder.length
      });

      for (const nodeId of executionOrder) {
        log('executeGraph', 'processing_node', this.graph, {
          executionId,
          phase: 'execution',
          nodeId: nodeId,
          currentPosition: executionOrder.indexOf(nodeId) + 1,
          totalNodes: executionOrder.length
        });

        const node = this.graph.nodes.find(n => n.id === nodeId);
        if (!node) {
          log('executeGraph', 'node_lookup_failed', this.graph, {
            executionId,
            phase: 'execution',
            nodeId: nodeId,
            error: 'node_not_found'
          });
          throw new GraphExecutionError(`Node ${nodeId} not found in graph`);
        }

        const nodeDefinition = this.nodeDefinitions.get(node.type);
        if (!nodeDefinition) {
          log('executeGraph', 'definition_lookup_failed', this.graph, {
            executionId,
            phase: 'execution',
            nodeId: nodeId,
            nodeType: node.type,
            error: 'node_definition_not_found'
          });
          throw new GraphExecutionError(`Node definition for type ${node.type} not found`, nodeId);
        }

        // Prepare inputs for this node
        log('executeGraph', 'preparing_node_inputs', this.graph, {
          executionId,
          phase: 'execution',
          nodeId: nodeId,
          nodeType: node.type
        });

        const nodeInputs = this.prepareNodeInputs(node, executionContext);
        const nodeConfig = this.prepareNodeConfig(node);

        // Execute the node
        log('executeGraph', 'executing_node', this.graph, {
          executionId,
          phase: 'execution',
          nodeId: nodeId,
          nodeType: node.type,
          inputKeys: Object.keys(nodeInputs),
          configKeys: Object.keys(nodeConfig)
        });

        const nodeOutput = await this.executeNode(node, nodeDefinition, nodeInputs, nodeConfig, executionContext);

        log('executeGraph', 'node_completed', this.graph, {
          executionId,
          phase: 'execution',
          nodeId: nodeId,
          nodeType: node.type,
          outputKeys: Object.keys(nodeOutput || {}),
          success: true
        });

        // Store the output
        executionContext.nodeOutputs.set(nodeId, nodeOutput);

        // Log execution
        executionContext.executionLog.push({
          nodeId,
          nodeType: node.type,
          executedAt: new Date().toISOString(),
          inputs: nodeInputs,
          outputs: nodeOutput,
          success: true
        });
      }

      // Step 5: Collect final results from terminal nodes
      log('executeGraph', 'collecting_terminal_results', this.graph, {
        executionId,
        phase: 'completion',
        nodesExecuted: executionOrder.length
      });

      const terminalNodes = this.graph.nodes.filter(node => {
        const definition = this.nodeDefinitions.get(node.type);
        return definition?.metadata?.isTerminal === true;
      });

      log('executeGraph', 'terminal_nodes_identified', this.graph, {
        executionId,
        phase: 'completion',
        terminalNodeCount: terminalNodes.length,
        terminalNodeIds: terminalNodes.map(n => n.id)
      });

      const finalResults = terminalNodes.map(node => ({
        nodeId: node.id,
        nodeType: node.type,
        output: executionContext.nodeOutputs.get(node.id)
      }));

      log('executeGraph', 'execution_success', this.graph, {
        executionId,
        phase: 'completion',
        result: 'success',
        totalExecutionTime: new Date().toISOString(),
        hadStreamingOutput: executionContext.hadStreamingOutput,
        finalResultsCount: finalResults.length
      });

      return {
        success: true,
        executionId,
        executionOrder,
        finalResults,
        executionLog: executionContext.executionLog,
        startTime: executionContext.startTime,
        endTime: new Date().toISOString(),
        nodeCount: executionOrder.length,
        hadStreamingOutput: executionContext.hadStreamingOutput,
        graphInfo: {
          id: this.graph.id,
          name: this.graph.name,
          version: this.graph.version
        }
      };

    } catch (error) {
      log('executeGraph', 'execution_error', this.graph, {
        executionId,
        phase: 'error',
        result: 'failed',
        errorMessage: error.message,
        errorType: error.constructor.name,
        nodeId: error.nodeId || null,
        stackTrace: error.stack
      });

      return {
        success: false,
        executionId,
        error: error.message,
        nodeId: error.nodeId || null,
        executionLog: error.executionContext?.executionLog || [],
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        graphInfo: {
          id: this.graph.id,
          name: this.graph.name,
          version: this.graph.version
        }
      };
    }
  }

  /**
   * Prepare inputs for a node based on connected edges
   */
  prepareNodeInputs(node, executionContext) {
    log('prepareNodeInputs', 'starting_input_preparation', this.graph, {
      executionId: executionContext.executionId,
      nodeId: node.id,
      nodeType: node.type
    });

    const inputs = {};

    // Find all edges that target this node
    const incomingEdges = this.graph.edges.filter(edge => edge.target === node.id);

    log('prepareNodeInputs', 'incoming_edges_found', this.graph, {
      executionId: executionContext.executionId,
      nodeId: node.id,
      incomingEdgeCount: incomingEdges.length,
      edgeIds: incomingEdges.map(e => e.id)
    });

    // Map data from connected nodes based on edges
    incomingEdges.forEach(edge => {
      const sourceOutput = executionContext.nodeOutputs.get(edge.source);
      if (sourceOutput && sourceOutput[edge.sourceHandle] !== undefined) {
        inputs[edge.targetHandle] = sourceOutput[edge.sourceHandle];
        log('prepareNodeInputs', 'data_flow_mapped', this.graph, {
          executionId: executionContext.executionId,
          nodeId: node.id,
          sourceNode: edge.source,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          dataType: typeof sourceOutput[edge.sourceHandle],
          dataLength: sourceOutput[edge.sourceHandle]?.toString()?.length || 0
        });
      } else {
        log('prepareNodeInputs', 'data_flow_missing', this.graph, {
          executionId: executionContext.executionId,
          nodeId: node.id,
          edgeId: edge.id,
          sourceNode: edge.source,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          reason: !sourceOutput ? 'no_source_output' : 'missing_handle'
        });
      }
    });

    log('prepareNodeInputs', 'input_preparation_completed', this.graph, {
      executionId: executionContext.executionId,
      nodeId: node.id,
      inputKeys: Object.keys(inputs),
      inputCount: Object.keys(inputs).length
    });

    return inputs;
  }  /**
   * Prepare node configuration (separate from inputs)
   */
  prepareNodeConfig(node) {
    const nodeConfig = node.data?.config || {};
    log('prepareNodeConfig', 'config_prepared', this.graph, {
      nodeId: node.id,
      nodeType: node.type,
      configKeys: Object.keys(nodeConfig),
      configCount: Object.keys(nodeConfig).length
    });
    return nodeConfig;
  }

  /**
   * Execute a single node
   */
  async executeNode(node, nodeDefinition, inputs, config, executionContext) {
    log('executeNode', 'starting_node_execution', this.graph, {
      executionId: executionContext.executionId,
      nodeId: node.id,
      nodeType: node.type,
      implementationKey: nodeDefinition.executionLogic?.implementation
    });

    const implementationKey = nodeDefinition.executionLogic?.implementation;
    const implementation = this.nodeImplementations.get(implementationKey);

    if (!implementation) {
      log('executeNode', 'implementation_not_found', this.graph, {
        executionId: executionContext.executionId,
        nodeId: node.id,
        nodeType: node.type,
        implementationKey: implementationKey,
        availableImplementations: Array.from(this.nodeImplementations.keys())
      });

      throw new GraphExecutionError(
        `No implementation found for node type: ${node.type} (${implementationKey})`,
        node.id,
        executionContext
      );
    }

    const nodeContext = {
      nodeId: node.id,
      nodeType: node.type,
      executionId: executionContext.executionId,
      executionOptions: executionContext.options,
      // Pass streaming capabilities to node implementations
      onToken: executionContext.onToken,
      streaming: executionContext.streaming,
      executionContext: executionContext
    };

    // Merge config and inputs for node execution (config has lower priority)
    const fullInputs = { ...config, ...inputs };

    log('executeNode', 'executing_implementation', this.graph, {
      executionId: executionContext.executionId,
      nodeId: node.id,
      nodeType: node.type,
      configKeys: Object.keys(config),
      inputKeys: Object.keys(inputs),
      finalInputKeys: Object.keys(fullInputs),
      streaming: executionContext.streaming
    });

    try {
      const result = await implementation(fullInputs, nodeContext);

      log('executeNode', 'node_execution_completed', this.graph, {
        executionId: executionContext.executionId,
        nodeId: node.id,
        nodeType: node.type,
        success: true,
        resultKeys: Object.keys(result || {}),
        resultType: typeof result
      });

      return result;
    } catch (error) {
      log('executeNode', 'node_execution_failed', this.graph, {
        executionId: executionContext.executionId,
        nodeId: node.id,
        nodeType: node.type,
        success: false,
        errorMessage: error.message,
        errorType: error.constructor.name,
        stackTrace: error.stack
      });

      throw new GraphExecutionError(
        `Node execution failed: ${error.message}`,
        node.id,
        executionContext
      );
    }
  }
}

// Export the class and error type
export { GraphExecutionError, GraphExecutor };