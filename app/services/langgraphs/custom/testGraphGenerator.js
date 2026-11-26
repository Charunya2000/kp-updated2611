import { generateLangGraphFromConfig, executeGeneratedGraph } from './graphGeneratorService.js';

/**
 * Test the graph generator with a sample configuration
 */
export async function testGraphGenerator() {
  console.log('🚀 Testing LangGraph Generator POC...');

  // Sample configuration based on the graph builder format
  const sampleConfig = {
    nodes: [
      {
        id: '1',
        type: 'start',
        position: { x: 250, y: 25 },
        data: {
          label: 'Start',
          graph_id: 'test_graph_001',
          initialState: '{"user_name": "John", "task_type": "data analysis"}'
        }
      },
      {
        id: '2',
        type: 'systemPrompt',
        position: { x: 200, y: 125 },
        data: {
          label: 'System Prompt',
          template: 'You are a helpful assistant specializing in {task_type}. Your user is {user_name}.',
          variables: '{user_name}, {task_type}',
          defaultValues: '{"user_name": "User", "task_type": "general assistance"}'
        }
      },
      {
        id: '3',
        type: 'llm',
        position: { x: 200, y: 225 },
        data: {
          label: 'LLM',
          model: 'gpt-4o',
          temperature: 0.7,
          maxTokens: 1000,
          systemPrompt: 'You are a helpful assistant.'
        }
      },
      {
        id: '4',
        type: 'conditional',
        position: { x: 175, y: 325 },
        data: {
          label: 'Conditional',
          condition: 'needs_tool',
          operator: '==',
          compareValue: 'true'
        }
      },
      {
        id: '5',
        type: 'tool',
        position: { x: 100, y: 425 },
        data: {
          label: 'Tool',
          tool: 'web_search',
          timeout: 30,
          description: 'Search the web for information',
          parameters: '{"query": "latest information"}'
        }
      },
      {
        id: '6',
        type: 'end',
        position: { x: 300, y: 425 },
        data: {
          label: 'End',
          save_output: true,
          log_level: 'info',
          outputFormat: 'json'
        }
      }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e3-4', source: '3', target: '4' },
      { id: 'e4-5', source: '4', target: '5', sourceHandle: 'true', label: 'needs tool' },
      { id: 'e4-6', source: '4', target: '6', sourceHandle: 'false', label: 'no tool needed' },
      { id: 'e5-6', source: '5', target: '6', label: 'tool complete' }
    ]
  };

  try {
    console.log('📋 Generating graph from configuration...');
    const graph = generateLangGraphFromConfig(sampleConfig);
    console.log('✅ Graph generated successfully!');

    console.log('🏃 Executing graph with test data...');
    const result = await executeGeneratedGraph(graph, {
      userPrompt: 'I need help with data analysis for my project',
      user_name: 'Alice',
      task_type: 'data visualization',
      needs_tool: 'false' // Will skip tool execution
    });

    console.log('✅ Graph execution completed!');
    console.log('📊 Final result:', result.finalResult);

    return {
      success: true,
      graphGenerated: true,
      executionResult: result,
      message: 'Graph generator POC completed successfully!'
    };

  } catch (error) {
    console.error('❌ Error in graph generator test:', error);
    return {
      success: false,
      error: error.message,
      message: 'Graph generator POC failed'
    };
  }
}

/**
 * Test with a simpler linear graph
 */
export async function testSimpleGraph() {
  console.log('🚀 Testing Simple Linear Graph...');

  const simpleConfig = {
    nodes: [
      {
        id: 'start',
        type: 'start',
        data: { graph_id: 'simple_test' }
      },
      {
        id: 'prompt',
        type: 'systemPrompt',
        data: {
          template: 'You are a helpful {role} assistant.',
          variables: '{role}',
          defaultValues: '{"role": "general"}'
        }
      },
      {
        id: 'llm',
        type: 'llm',
        data: {
          model: 'gpt-4o',
          temperature: 0.5
        }
      },
      {
        id: 'end',
        type: 'end',
        data: { outputFormat: 'text' }
      }
    ],
    edges: [
      { source: 'start', target: 'prompt' },
      { source: 'prompt', target: 'llm' },
      { source: 'llm', target: 'end' }
    ]
  };

  try {
    const graph = generateLangGraphFromConfig(simpleConfig);
    const result = await executeGeneratedGraph(graph, {
      userPrompt: 'What is artificial intelligence?',
      role: 'technical'
    });

    console.log('✅ Simple graph test completed!');
    console.log('📄 Result:', result.finalResult);

    return { success: true, result: result.finalResult };

  } catch (error) {
    console.error('❌ Simple graph test failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Export configuration from the current graph builder state
 * This would be used to get JSON from the React Flow graph
 */
export function exportGraphConfiguration(nodes, edges) {
  return {
    nodes: nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label
    })),
    metadata: {
      createdAt: new Date().toISOString(),
      version: '1.0.0',
      generator: 'langgraph-builder'
    }
  };
}
