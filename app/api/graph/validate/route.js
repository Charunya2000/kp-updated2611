import { NextResponse } from 'next/server';
import { serverValidator } from '../../../[teamName]/graph-builder/services/validation/graphValidator.js';

export async function POST(request) {
  try {
    const { graph, action } = await request.json();

    switch (action) {
      case 'validate':
        const validation = serverValidator.validateGraph(graph);
        return NextResponse.json(validation);

      case 'generateExecutionOrder':
        const executionOrder = serverValidator.generateExecutionOrder(graph);
        return NextResponse.json({
          success: true,
          executionOrder,
          error: null
        });

      case 'getValidationStatus':
        const validation2 = serverValidator.validateGraph(graph);
        const status = {
          hasTerminalNode: validation2.validationDetails.terminalNodes.length > 0,
          hasErrors: validation2.errors.length > 0,
          hasWarnings: validation2.warnings.length > 0,
          errorCount: validation2.errors.length,
          warningCount: validation2.warnings.length,
          canExecute: validation2.isValid
        };
        return NextResponse.json(status);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Graph validation API error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}