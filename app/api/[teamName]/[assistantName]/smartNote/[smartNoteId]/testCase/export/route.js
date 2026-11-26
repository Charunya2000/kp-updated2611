'use server';

import { NextResponse } from 'next/server';
import {
  exportTestCases as exportTestCasesService,
} from '@services/testCaseService';

/**
 * POST handler for exporting test cases as formatted text
 */
export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { testCaseIds } = await req.json();

    const formattedText = await exportTestCasesService(smartNoteId, testCaseIds, teamName);

    // Create the response with the formatted text
    const response = new NextResponse(formattedText, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="QTest_Export_${smartNoteId}.txt"`
      }
    });

    return response;
  } catch (error) {
    console.error('Error exporting test cases:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
