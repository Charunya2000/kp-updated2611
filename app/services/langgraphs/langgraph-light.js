/**
 * Lightweight LangGraph Implementation
 * 
 * Custom implementation of LangGraph's core functionality:
 * - Annotation: Define state schema
 * - StateGraph: Build and execute graphs with nodes and edges
 * - START/END: Special node identifiers
 */

// Special node identifiers
export const START = "__START__";
export const END = "__END__";

/**
 * Annotation class for defining state schema
 * Usage: Annotation.Root({ field1: Annotation, field2: Annotation, ... })
 */
export class Annotation {
  constructor() {
    // Placeholder - in real usage, each field is just marked as Annotation
  }

  /**
   * Create a root annotation (state schema)
   * @param {Object} schema - Object with field names and Annotation types
   * @returns {Object} The schema definition
   */
  static Root(schema) {
    // Return the schema as-is - we'll use it for state initialization
    return schema;
  }
}

/**
 * StateGraph class for building and executing graphs
 */
export class StateGraph {
  constructor(stateAnnotation) {
    this.stateAnnotation = stateAnnotation;
    this.nodes = new Map();
    this.edges = new Map(); // Regular edges: Map<from, to>
    this.conditionalEdges = new Map(); // Conditional edges: Map<from, { condition, mapping }>
  }

  /**
   * Add a node to the graph
   * @param {string} name - Node identifier
   * @param {Function} nodeFunction - Async function that processes state
   * @returns {StateGraph} This instance for chaining
   */
  addNode(name, nodeFunction) {
    this.nodes.set(name, nodeFunction);
    return this;
  }

  /**
   * Add a direct edge between two nodes
   * @param {string} from - Source node (or START)
   * @param {string} to - Target node (or END)
   * @returns {StateGraph} This instance for chaining
   */
  addEdge(from, to) {
    if (!this.edges.has(from)) {
      this.edges.set(from, []);
    }
    this.edges.get(from).push(to);
    return this;
  }

  /**
   * Add conditional edges based on state
   * @param {string} from - Source node
   * @param {Function} condition - Function that evaluates state and returns next node name or key
   * @param {Object} mapping - Optional mapping of condition results to node names
   * @returns {StateGraph} This instance for chaining
   */
  addConditionalEdges(from, condition, mapping = null) {
    this.conditionalEdges.set(from, { condition, mapping });
    return this;
  }

  /**
   * Compile the graph into an executable form
   * @returns {Object} Compiled graph with invoke method
   */
  compile() {
    const nodes = this.nodes;
    const edges = this.edges;
    const conditionalEdges = this.conditionalEdges;

    return {
      /**
       * Execute the graph with initial state
       * @param {Object} initialState - Starting state
       * @returns {Promise<Object>} Final state after execution
       */
      async invoke(initialState) {
        // Initialize state with all fields from annotation
        const state = { ...initialState };

        // Start execution from START node
        let currentNode = START;
        const visited = new Set();
        const maxIterations = 1000; // Prevent infinite loops
        let iterations = 0;

        while (currentNode !== END && iterations < maxIterations) {
          iterations++;

          // Get next node(s) to execute
          let nextNodes = [];

          // Check for conditional edges first
          if (conditionalEdges.has(currentNode)) {
            const { condition, mapping } = conditionalEdges.get(currentNode);
            const result = await condition(state);

            if (mapping) {
              // If mapping provided, use it to determine next node
              const nextNode = mapping[result];
              if (nextNode) {
                nextNodes = [nextNode];
              } else {
                throw new Error(`Conditional edge result "${result}" not found in mapping for node "${currentNode}"`);
              }
            } else {
              // If no mapping, result should be the next node name
              nextNodes = [result];
            }
          }
          // Check for regular edges
          else if (edges.has(currentNode)) {
            nextNodes = edges.get(currentNode);
          }
          // No outgoing edges
          else if (currentNode !== START) {
            // If we're at a node with no outgoing edges (and not START), end execution
            break;
          }

          // Execute the next node(s)
          if (nextNodes.length === 0) {
            break;
          }

          // For simplicity, execute nodes sequentially (could be parallelized)
          for (const nextNode of nextNodes) {
            if (nextNode === END) {
              currentNode = END;
              break;
            }

            // Execute the node function
            if (nodes.has(nextNode)) {
              const nodeFunction = nodes.get(nextNode);
              try {
                // Execute node and merge results into state
                const result = await nodeFunction(state);
                if (result && typeof result === 'object') {
                  Object.assign(state, result);
                }
              } catch (error) {
                console.error(`Error executing node "${nextNode}":`, error);
                throw error;
              }
            }

            currentNode = nextNode;
          }

          // Prevent infinite loops
          const stateKey = JSON.stringify({ node: currentNode, stateHash: Object.keys(state).join(',') });
          if (visited.has(stateKey)) {
            console.warn(`Potential infinite loop detected at node "${currentNode}"`);
            break;
          }
          visited.add(stateKey);
        }

        if (iterations >= maxIterations) {
          console.warn(`Graph execution stopped after ${maxIterations} iterations`);
        }

        return state;
      },

      /**
       * Stream execution of the graph (for future implementation)
       * @param {Object} initialState - Starting state
       * @returns {AsyncGenerator<Object>} Stream of state updates
       */
      async *stream(initialState) {
        // Future implementation for streaming support
        const finalState = await this.invoke(initialState);
        yield finalState;
      }
    };
  }
}
