'use server';

import { NextResponse } from 'next/server';
import { getTestCaseGenerationProgress } from '@services/testCaseService';

export async function GET(request, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, progressId } = await params;

    // Validate required parameters
    if (!teamName || !assistantName || !smartNoteId) {
      return NextResponse.json(
        { error: 'Missing required parameters: teamName, assistantName, smartNoteId' },
        { status: 400 }
      );
    }

    // Fetch the current progress from the database
    const progress = await getTestCaseGenerationProgress(teamName, smartNoteId, progressId);

    // If no progress document found, return a "not started" response
    if (!progress) {
      return NextResponse.json(
        {
          status: 'not_started',
          message: 'No test case generation in progress for this smart note',
          sections: [],
          totalSectionsCount: 0,
          completedSectionsCount: 0,
          totalTestCasesCount: 0
        },
        { status: 200 }
      );
    }

    // Return the progress document
    return NextResponse.json(
      {
        status: progress.status,
        sections: progress.sections || [],
        totalSectionsCount: progress.totalSectionsCount,
        completedSectionsCount: progress.completedSectionsCount,
        totalTestCasesCount: progress.totalTestCasesCount,
        startedAt: progress.startedAt,
        ...(progress.status === 'completed' && {
          completedAt: progress.completedAt,
          finalMessage: progress.finalMessage,
          templateDownloadUrl: progress.templateDownloadUrl
        }),
        ...(progress.status === 'failed' && {
          error: progress.error,
          failedAt: progress.failedAt
        })
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching test case generation progress:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch progress',
        message: error.message
      },
      { status: 500 }
    );
  }
}