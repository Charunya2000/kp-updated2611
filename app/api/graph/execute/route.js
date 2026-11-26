import { NextResponse } from 'next/server';
import { GraphExecutor } from '../../../[teamName]/graph-builder/services/execution/graphExecutor.js';

export async function POST(request) {
  try {
    const { graph, options } = await request.json();
    const executor = new GraphExecutor(graph);

    const result = await executor.executeGraph(options);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Graph execution API error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}