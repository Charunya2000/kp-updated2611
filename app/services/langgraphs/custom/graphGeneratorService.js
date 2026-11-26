import { Annotation, StateGraph, START, END } from "../langgraph-light.js";

/**
 * Generates a LangGraph from JSON configuration
 * @param {Object} config - Graph configuration object
 * @returns {Object} - Compiled LangGraph
 */
export function generateLangGraphFromConfig(config) {
  const { nodes, edges } = config;

  // Create state annotation based on all node data
  const stateFields = createStateAnnotation(nodes);
  const StateAnnotation = Annotation.Root(stateFields);

  // Create graph builder
  const graphBuilder = new StateGraph(StateAnnotation);

  // Find the final nodes that connect to end
  const endEdges = edges.filter(e => {
    const targetNode = nodes.find(n => n.id === e.target);
    return targetNode?.type === 'end';
  });
  const finalNodeIds = endEdges.map(e => e.source);

  // Add nodes to graph (skip start and end nodes as they are handled by START/END constants)
  nodes.forEach(node => {
    if (node.type !== 'start' && node.type !== 'end') {
      const isFinalNode = finalNodeIds.includes(node.id);
      const nodeFunction = createNodeFunction(node, isFinalNode ? nodes.find(n => n.type === 'end') : null);
      console.log(`Adding node: ${node.id} (${node.type})${isFinalNode ? ' [FINAL]' : ''}`);
      graphBuilder.addNode(node.id, nodeFunction);
    }
  });

  // Add edges to graph
  addEdgesToGraph(graphBuilder, edges, nodes);  // Compile and return the graph
  return graphBuilder.compile();
}

/**
 * Creates state annotation fields based on node configurations
 * @param {Array} nodes - Array of node configurations
 * @returns {Object} - State annotation fields
 */
function createStateAnnotation(nodes) {
  const stateFields = {
    // Common fields that most graphs need
    userPrompt: Annotation,
    userMessage: Annotation,
    context: Annotation,
    sendEvent: Annotation, // For streaming support
  };

  // Add fields based on node types and their data
  nodes.forEach(node => {
    switch (node.type) {
      case 'llm':
        stateFields.llmResponse = Annotation;
        stateFields.messages = Annotation;
        stateFields.temperature = Annotation;
        stateFields.maxTokens = Annotation;
        break;
      case 'tool':
        stateFields.toolResults = Annotation;
        stateFields.toolParameters = Annotation;
        break;
      case 'conditional':
        stateFields.conditionResult = Annotation;
        stateFields.conditionValue = Annotation;
        break;
      case 'systemPrompt':
        stateFields.systemPrompt = Annotation;
        stateFields.templateVariables = Annotation;
        break;
      case 'start':
        stateFields.graphId = Annotation;
        stateFields.initialState = Annotation;
        break;
      case 'end':
        stateFields.finalResult = Annotation;
        stateFields.outputFormat = Annotation;
        break;
    }

    // Add any custom fields from node data
    if (node.data) {
      Object.keys(node.data).forEach(key => {
        if (!stateFields[key]) {
          stateFields[key] = Annotation;
        }
      });
    }
  });

  return stateFields;
}

/**
 * Creates a node function based on node configuration
 * @param {Object} nodeConfig - Node configuration
 * @param {Object} endNodeConfig - End node configuration (if this is a final node)
 * @returns {Function} - Node function
 */
function createNodeFunction(nodeConfig, endNodeConfig = null) {
  const { type, data } = nodeConfig;

  const baseFunction = (() => {
    switch (type) {
      case 'start':
        return async (state) => {
          console.log(`[${nodeConfig.id}] Starting graph execution`);
          return {
            graphId: data?.graph_id || 'generated_graph',
            initialState: data?.initialState ? JSON.parse(data.initialState) : {},
            ...state
          };
        };

      case 'systemPrompt':
        return async (state) => {
          console.log(`[${nodeConfig.id}] Processing system prompt`);
          let processedTemplate = data?.template || 'You are a helpful assistant.';

          // Replace variables in template
          if (data?.variables) {
            const variables = data.variables.split(',').map(v => v.trim().replace(/[{}]/g, ''));
            variables.forEach(variable => {
              const placeholder = `{${variable}}`;
              const value = state[variable] || (data?.defaultValues ? JSON.parse(data.defaultValues)[variable] : variable);
              processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), value);
            });
          }

          return {
            systemPrompt: processedTemplate,
            templateVariables: data?.variables || ''
          };
        };

      case 'llm':
        return async (state) => {
          console.log(`[${nodeConfig.id}] Processing LLM request`);

          // Simulate LLM call (in real implementation, you'd call your LLM service)
          const messages = [
            { role: 'system', content: state.systemPrompt || 'You are a helpful assistant.' },
            { role: 'user', content: state.userPrompt || state.userMessage || 'Hello' }
          ];

          // Mock response for POC
          const mockResponse = `This is a simulated response from ${data?.model || 'gpt-4o'} model. ` +
            `Processing: "${state.userPrompt || state.userMessage || 'No input'}" ` +
            `with temperature ${data?.temperature || 0.7}`;

          // Stream the response if sendEvent is available
          if (state.sendEvent) {
            state.sendEvent({ type: 'data', data: mockResponse });
          }

          return {
            llmResponse: mockResponse,
            messages: messages
          };
        };

      case 'tool':
        return async (state) => {
          console.log(`[${nodeConfig.id}] Executing tool: ${data?.tool || 'unknown'}`);

          // Simulate tool execution
          const toolResult = {
            tool: data?.tool || 'unknown_tool',
            parameters: data?.parameters ? JSON.parse(data.parameters) : {},
            result: `Tool ${data?.tool || 'unknown'} executed successfully`,
            timestamp: new Date().toISOString()
          };

          return {
            toolResults: toolResult,
            toolParameters: data?.parameters || '{}'
          };
        };

      case 'conditional':
        return async (state) => {
          console.log(`[${nodeConfig.id}] Evaluating condition: ${data?.condition || 'unknown'}`);

          const condition = data?.condition || 'true';
          const operator = data?.operator || '==';
          const compareValue = data?.compareValue || 'true';

          // Simple condition evaluation for POC
          let result = false;
          try {
            const stateValue = state[condition] || condition;
            switch (operator) {
              case '==':
                result = stateValue == compareValue;
                break;
              case '!=':
                result = stateValue != compareValue;
                break;
              case '>':
                result = Number(stateValue) > Number(compareValue);
                break;
              case '<':
                result = Number(stateValue) < Number(compareValue);
                break;
              default:
                result = Boolean(stateValue);
            }
          } catch (error) {
            console.error('Condition evaluation error:', error);
            result = false;
          }

          return {
            conditionResult: result,
            conditionValue: condition
          };
        };

      case 'end':
        return async (state) => {
          console.log(`[${nodeConfig.id}] Completing graph execution`);

          const outputFormat = data?.outputFormat || 'json';
          let finalResult;

          switch (outputFormat.toLowerCase()) {
            case 'json':
              finalResult = {
                result: state.llmResponse || state.toolResults || 'Graph completed',
                timestamp: new Date().toISOString(),
                graphId: state.graphId
              };
              break;
            case 'text':
              finalResult = String(state.llmResponse || state.toolResults || 'Graph completed');
              break;
            default:
              finalResult = state.llmResponse || state.toolResults || 'Graph completed';
          }

          if (data?.save_output !== false && state.sendEvent) {
            state.sendEvent({
              type: 'data',
              data: typeof finalResult === 'string' ? finalResult : JSON.stringify(finalResult)
            });
          }

          return {
            finalResult: finalResult,
            outputFormat: outputFormat
          };
        };

      default:
        return async (state) => {
          console.log(`[${nodeConfig.id}] Unknown node type: ${type}`);
          return state;
        };
    }
  })();

  // If this is a final node (connects to end), enhance it with final result logic
  if (endNodeConfig) {
    return async (state) => {
      const result = await baseFunction(state);

      // Set the final result based on the end node configuration
      const outputFormat = endNodeConfig?.data?.outputFormat || 'json';

      let finalResult;
      switch (outputFormat.toLowerCase()) {
        case 'json':
          finalResult = {
            result: result.llmResponse || result.toolResults || result.systemPrompt || 'Graph completed',
            timestamp: new Date().toISOString(),
            graphId: state.graphId || 'generated_graph',
            nodeData: result
          };
          break;
        case 'text':
          finalResult = String(result.llmResponse || result.toolResults || result.systemPrompt || 'Graph completed');
          break;
        default:
          finalResult = result.llmResponse || result.toolResults || result.systemPrompt || 'Graph completed';
      }

      console.log(`[${nodeConfig.id}] Setting final result:`, finalResult);
      return {
        ...result,
        finalResult: finalResult
      };
    };
  }

  return baseFunction;
}/**
 * Adds edges to the graph builder
 * @param {StateGraph} graphBuilder - Graph builder instance
 * @param {Array} edges - Array of edge configurations
 * @param {Array} nodes - Array of node configurations (for conditional logic)
 */
function addEdgesToGraph(graphBuilder, edges, nodes) {
  // Find start and end nodes
  const startNode = nodes.find(n => n.type === 'start');
  const endNodes = nodes.filter(n => n.type === 'end');

  // Group edges by source to handle conditional routing
  const edgesBySource = {};

  edges.forEach(edge => {
    if (!edgesBySource[edge.source]) {
      edgesBySource[edge.source] = [];
    }
    edgesBySource[edge.source].push(edge);
  });

  // Add edges to graph
  Object.entries(edgesBySource).forEach(([sourceId, sourceEdges]) => {
    const sourceNode = nodes.find(n => n.id === sourceId);

    if (sourceEdges.length === 1) {
      // Simple edge
      const edge = sourceEdges[0];
      let sourceIdForGraph, targetId;

      // Handle START mapping
      if (sourceNode?.type === 'start') {
        sourceIdForGraph = START;
      } else {
        sourceIdForGraph = sourceId;
      }

      // Handle END mapping
      const targetNode = nodes.find(n => n.id === edge.target);
      if (targetNode?.type === 'end') {
        targetId = END;
      } else {
        targetId = edge.target;
      }

      console.log(`Adding edge: ${sourceIdForGraph} -> ${targetId}`);
      graphBuilder.addEdge(sourceIdForGraph, targetId);
    } else {
      // Multiple edges from same source - create conditional routing
      if (sourceNode?.type === 'conditional') {
        const routingFunction = (state) => {
          const conditionResult = state.conditionResult;

          // Find appropriate edge based on condition result
          for (const edge of sourceEdges) {
            if (edge.sourceHandle === 'true' && conditionResult) {
              const targetNode = nodes.find(n => n.id === edge.target);
              return targetNode?.type === 'end' ? END : edge.target;
            } else if (edge.sourceHandle === 'false' && !conditionResult) {
              const targetNode = nodes.find(n => n.id === edge.target);
              return targetNode?.type === 'end' ? END : edge.target;
            }
          }

          // Default to first edge if no match
          const defaultEdge = sourceEdges[0];
          const targetNode = nodes.find(n => n.id === defaultEdge.target);
          return targetNode?.type === 'end' ? END : defaultEdge.target;
        };

        console.log(`Adding conditional edges from: ${sourceId}`);
        graphBuilder.addConditionalEdges(sourceId, routingFunction);
      } else {
        // Non-conditional node with multiple edges - add all as simple edges
        sourceEdges.forEach(edge => {
          let sourceIdForGraph, targetId;

          // Handle START mapping
          if (sourceNode?.type === 'start') {
            sourceIdForGraph = START;
          } else {
            sourceIdForGraph = sourceId;
          }

          // Handle END mapping
          const targetNode = nodes.find(n => n.id === edge.target);
          if (targetNode?.type === 'end') {
            targetId = END;
          } else {
            targetId = edge.target;
          }

          console.log(`Adding edge: ${sourceIdForGraph} -> ${targetId}`);
          graphBuilder.addEdge(sourceIdForGraph, targetId);
        });
      }
    }
  });
}

/**
 * Execute a generated graph with initial state
 * @param {Object} graph - Compiled LangGraph
 * @param {Object} initialState - Initial state for execution
 * @returns {Promise} - Graph execution result
 */
export async function executeGeneratedGraph(graph, initialState = {}) {
  const defaultState = {
    userPrompt: 'Hello, world!',
    sendEvent: (event) => {
      if (event.type === 'data') {
        console.log('Graph output:', event.data);
      }
    },
    ...initialState
  };

  return await graph.invoke(defaultState);
}
