'use server';

import { NextResponse } from 'next/server';
import { generateTestCaseTemplate } from '@services/testCaseTemplateService';
import { getServerSession } from '@utils/getSession';

/**
 * POST handler for updating the test case template
 */
export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { testCases, documentName } = await req.json();

    if (!Array.isArray(testCases) || testCases.length === 0) {
      return NextResponse.json(
        { error: 'No test cases provided or invalid test case data' },
        { status: 400 }
      );
    }

    // Generate a new template download URL
    const templateDownloadUrl = await generateTestCaseTemplate(
      smartNoteId,
      testCases,
      documentName || 'updated_test_cases'
    );

    if (!templateDownloadUrl) {
      return NextResponse.json(
        { error: 'Failed to generate template download URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templateDownloadUrl,
      message: 'Test case template updated successfully'
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating test case template:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
