'use server';

import { NextResponse } from 'next/server';
import { saveSharedDealCanvas, selectSharedDealCanvas } from '@services/dealCanvasService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const canvas = await selectSharedDealCanvas({ teamName, assistantName });
    return NextResponse.json(canvas, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getDealCanvas',
        detail: { error: error?.message || 'Unknown error' }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const payload = await req.json();

    if (!Array.isArray(payload?.lanes)) {
      return NextResponse.json({ error: 'Invalid payload. lanes is required.' }, { status: 400 });
    }

    const result = await saveSharedDealCanvas({
      teamName,
      assistantName,
      smartNoteId,
      lanes: payload.lanes,
      expectedUpdatedAt: payload.expectedUpdatedAt,
      scope: payload.scope,
      sharedWith: payload.sharedWith
    });

    if (result?.conflict) {
      return NextResponse.json({
        error: 'The deal canvas has changed since your last load. Please review the latest version and try again.',
        conflict: true,
        canvas: result.canvas || null
      }, { status: 409 });
    }

    return NextResponse.json({ conflict: false, canvas: result.canvas || null }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'saveDealCanvas',
        detail: { error: error?.message || 'Unknown error' }
      }
    }));

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
