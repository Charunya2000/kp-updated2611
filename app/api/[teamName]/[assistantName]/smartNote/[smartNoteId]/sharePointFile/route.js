'use server'

import { NextResponse } from "next/server";
import { createSharePointFile, selectSharePointFiles } from '@/app/services/sharePointService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const query = { type: 'SharePointFile', parentId: smartNoteId }
    const smartNotes = await selectSharePointFiles(query, teamName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'SharePointFile') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = createSharePointFile(document, teamName, assistantName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}