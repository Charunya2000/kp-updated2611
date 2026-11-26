'use server';

import { NextResponse } from 'next/server';
import {
  getTestCaseById,
  updateTestCase,
  deleteTestCase
} from '@services/testCaseService';

/**
 * GET handler for retrieving a specific test case by ID
 */
export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, testCaseId } = await params;
    const result = await getTestCaseById(smartNoteId, testCaseId, teamName);

    if (!result) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`Error fetching test case ${params?.testCaseId}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT handler for updating a specific test case
 */
export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, testCaseId } = await params;
    const document = await req.json();

    // Ensure the IDs match the URL parameters
    document.id = testCaseId;
    document.smartNoteId = smartNoteId;

    const result = await updateTestCase(document, teamName);

    if (!result) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`Error updating test case ${params?.testCaseId}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE handler for deleting a specific test case
 */
export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, testCaseId } = await params;
    const result = await deleteTestCase(smartNoteId, testCaseId, teamName);

    if (!result) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Test case deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting test case ${params?.testCaseId}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
