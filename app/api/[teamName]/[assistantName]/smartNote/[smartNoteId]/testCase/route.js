'use server';

import { NextResponse } from 'next/server';
import {
  createTestCase as createTestCaseService,
  getTestCases as getTestCasesService
} from '@services/testCaseService';

/**
 * GET handler for retrieving all test cases for a smart note
 */

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const result = await getTestCasesService(smartNoteId, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error fetching test cases:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST handler for creating a new test case
 */
export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const document = await req.json();

    // Associate the test case with the smart note
    document.smartNoteId = smartNoteId;

    const result = await createTestCaseService(document, teamName);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating test case:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
