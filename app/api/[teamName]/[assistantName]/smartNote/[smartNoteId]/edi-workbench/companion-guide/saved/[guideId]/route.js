import { NextResponse } from 'next/server';
import { getSavedEditableCompanionGuide } from '@/app/services/ediEditableCompanionGuideService';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, guideId } = await params;
    const guide = await getSavedEditableCompanionGuide({
      teamName,
      assistantName,
      smartNoteId,
      guideId,
    });

    if (!guide) {
      return NextResponse.json({ error: 'Saved companion guide not found' }, { status: 404 });
    }

    return NextResponse.json({ guide }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getSavedEditableCompanionGuideRoute',
        detail: { error: error?.message || 'Failed to load saved companion guide' },
      },
    }));

    return NextResponse.json(
      { error: error?.message || 'Failed to load saved companion guide' },
      { status: 500 },
    );
  }
}