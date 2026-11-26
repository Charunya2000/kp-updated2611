'use server'

import { NextResponse } from "next/server";
import { selectSharePointFile, updateSharePointFile, deleteSharePointFile } from '@/app/services/sharePointService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, fileId } = await params;
    const query = { type: 'SharePointFile', id: fileId }
    const files = await selectSharePointFile(query, teamName);
    return NextResponse.json(files, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, fileId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'SharePointFile') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await updateSharePointFile(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, fileId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'SharePointFile') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await deleteSharePointFile(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}