'use server';

import { NextResponse } from 'next/server';
import { selectWebsiteURL, updateWebsiteURL, deleteWebsiteURL } from '@services/websiteURLService';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;

    const smartNotes = await selectWebsiteURL(req, teamName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'WebsiteURL') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = updateWebsiteURL(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;

    const result = await deleteWebsiteURL(id, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
