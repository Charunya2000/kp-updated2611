import { NextResponse } from 'next/server';
import { initializeGenerationProgress } from '@services/langgraphs/wstpTestCases/testCaseGenerationService';
import { getServerSession } from '@utils/getSession';

const MAX_DIRECTION_LENGTH = 12000;

function normalizeDirection(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.substring(0, MAX_DIRECTION_LENGTH);
}

/**
 * POST handler for alternate QTest test case generation (no uploadedDocumentId or fileDescription)
 */
export async function POST(req, { params }) {
  console.log('Received request to generate test cases (alternate workflow) with params:', params);
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const body = await req.json();
    const prompt = body.prompt;
    const llmDirections = {
      sectioningDirections: normalizeDirection(body?.llmDirections?.sectioningDirections),
      categoryAnalysisDirections: normalizeDirection(body?.llmDirections?.categoryAnalysisDirections)
    };
    // Get current user session
    const { nuid } = await getServerSession();

    // Call the alternate test case generation function
    const result = await initializeGenerationProgress({
      nuid,
      smartNoteId,
      prompt,
      teamName,
      assistantName,
      llmDirections
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate test cases (alternate workflow)' },
        { status: 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error generating test cases (alternate workflow):', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
