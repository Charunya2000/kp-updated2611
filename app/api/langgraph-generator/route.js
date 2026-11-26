import { testGraphGenerator, testSimpleGraph } from '@/app/services/langgraphs/custom/testGraphGenerator.js';
import { generateLangGraphFromConfig, executeGeneratedGraph } from '@/app/services/langgraphs/custom/graphGeneratorService.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, config, initialState } = body;

    switch (action) {
      case 'test':
        const testResult = await testGraphGenerator();
        return Response.json(testResult);

      case 'test-simple':
        const simpleResult = await testSimpleGraph();
        return Response.json(simpleResult);

      case 'generate':
        if (!config) {
          return Response.json({ error: 'Configuration is required' }, { status: 400 });
        }

        const graph = generateLangGraphFromConfig(config);
        const result = await executeGeneratedGraph(graph, initialState || {});

        return Response.json({
          success: true,
          result: result,
          message: 'Graph executed successfully'
        });

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Graph generator API error:', error);
    return Response.json({
      error: error.message,
      success: false
    }, { status: 500 });
  }
}

export async function GET(request) {
  return Response.json({
    message: 'LangGraph Generator API',
    endpoints: {
      'POST /': 'Execute graph generation',
      'actions': ['test', 'test-simple', 'generate']
    },
    version: '1.0.0'
  });
}
