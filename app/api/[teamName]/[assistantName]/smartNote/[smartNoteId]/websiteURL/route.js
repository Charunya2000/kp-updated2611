'use server';

import { NextResponse } from 'next/server';
import { createWebsiteURL, selectWebsiteURLs } from '@services/websiteURLService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const query = { type: 'WebsiteURL', parentId: smartNoteId }
    const websiteURLs = await selectWebsiteURLs(query, teamName);
    return NextResponse.json(websiteURLs, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'WebsiteURL') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await createWebsiteURL(document, teamName, assistantName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
