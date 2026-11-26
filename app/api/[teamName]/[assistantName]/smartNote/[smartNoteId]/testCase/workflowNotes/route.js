'use server';

import { NextResponse } from 'next/server';
import { saveWorkflowNotes, getWorkflowNotes } from '@services/testCaseService';

/**
 * POST - Save QTest workflow notes
 * Receives workflow notes from the client and delegates to the service layer
 * for database persistence
 * 
 * Request body: {
 *   fullNotes: {
 *     instructions: string,
 *     smartNoteId: string,
 *     parentId: string,
 *     teamName: string,
 *     assistantName: string
 *   }
 * }
 * 
 * @param {Request} req - The request object
 * @param {Object} params - Route parameters containing teamName, assistantName, smartNoteId
 * @returns {Promise<NextResponse>} - JSON response with saved notes or error
 */
export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { fullNotes } = await req.json();

    // Validate required fields
    if (!fullNotes || !fullNotes.content) {
      return NextResponse.json(
        { error: 'Content field is required' },
        { status: 400 }
      );
    }

    if (!smartNoteId || !teamName || !assistantName) {
      return NextResponse.json(
        { error: 'Missing required path parameters: teamName, assistantName, smartNoteId' },
        { status: 400 }
      );
    }
    // Delegate to service layer for database persistence
    const result = await saveWorkflowNotes(teamName, assistantName, smartNoteId, fullNotes);

    return NextResponse.json(
      {
        success: true,
        message: 'Workflow notes saved successfully',
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error saving workflow notes:', {
      error: error.message,
      stack: error.stack,
      details: error,
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to save workflow notes',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Retrieve QTest workflow notes for a smart note
 * Retrieves workflow notes associated with a specific smart note
 * 
 * @param {Request} req - The request object
 * @param {Object} params - Route parameters containing teamName, assistantName, smartNoteId
 * @returns {Promise<NextResponse>} - JSON response with workflow notes or error
 */
export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    if (!smartNoteId || !teamName || !assistantName) {
      return NextResponse.json(
        { error: 'Missing required parameters: teamName, assistantName, smartNoteId' },
        { status: 400 }
      );
    }

    // Delegate to service layer for database retrieval
    const result = await getWorkflowNotes(teamName, assistantName, smartNoteId);

    return NextResponse.json(
      {
        success: true,
        message: 'Workflow notes retrieved successfully',
        data: result || {},
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error retrieving workflow notes:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to retrieve workflow notes',
      },
      { status: 500 }
    );
  }
}
