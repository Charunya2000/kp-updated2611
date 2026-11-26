import { NextResponse } from 'next/server';
import {
  listSavedEditableCompanionGuides,
  persistEditableCompanionGuide,
} from '@/app/services/ediEditableCompanionGuideService';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const guides = await listSavedEditableCompanionGuides({
      teamName,
      assistantName,
      smartNoteId,
    });

    return NextResponse.json({ guides }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'listSavedEditableCompanionGuidesRoute',
        detail: { error: error?.message || 'Failed to list saved companion guides' },
      },
    }));

    return NextResponse.json(
      { error: error?.message || 'Failed to list saved companion guides' },
      { status: 500 },
    );
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { companion, editableGuide, efssPackageVersion = null } = await req.json();
    const guide = await persistEditableCompanionGuide({
      teamName,
      assistantName,
      smartNoteId,
      companion,
      editableGuide,
      efssPackageVersion,
    });

    return NextResponse.json({ guide }, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'saveEditableCompanionGuideRoute',
        detail: { error: error?.message || 'Failed to save companion guide' },
      },
    }));

    return NextResponse.json(
      { error: error?.message || 'Failed to save companion guide' },
      { status: 500 },
    );
  }
}