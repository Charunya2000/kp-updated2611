'use server';

import { NextResponse } from 'next/server';
import {
  deleteInfoSourceFilterSettings,
  selectInfoSourceFilterSettingsById,
  updateInfoSourceFilterSettings,
} from '@services/infoSourceFilterSettingsService';

export async function GET(_, { params }) {
  try {
    const { teamName, smartNoteId, filterSettingsId } = await params;
    const document = await selectInfoSourceFilterSettingsById({
      type: 'InfoSourceFilterSettings',
      parentId: smartNoteId,
      id: filterSettingsId,
    }, teamName);
    return NextResponse.json(document, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, smartNoteId, filterSettingsId } = await params;
    const document = await req.json();
    document.id = filterSettingsId;
    document.parentId = smartNoteId;
    if (!document.type || document.type !== 'InfoSourceFilterSettings') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await updateInfoSourceFilterSettings(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, smartNoteId, filterSettingsId } = await params;
    const document = await req.json();
    document.id = filterSettingsId;
    document.parentId = smartNoteId;
    if (!document.type || document.type !== 'InfoSourceFilterSettings') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await deleteInfoSourceFilterSettings(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}