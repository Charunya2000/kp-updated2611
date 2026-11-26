'use server';

import { NextResponse } from 'next/server';
import {
  importTestCases as importTestCasesService,
} from '@services/testCaseService';

/**
 * POST handler for importing multiple test cases
 */
export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { testCases } = await req.json();

    if (!Array.isArray(testCases) || testCases.length === 0) {
      return NextResponse.json({ error: 'Invalid test cases data' }, { status: 400 });
    }

    // Associate all test cases with the smart note
    const preparedTestCases = testCases.map(testCase => ({
      ...testCase,
      smartNoteId
    }));

    const result = await importTestCasesService(preparedTestCases, teamName);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error importing test cases:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
