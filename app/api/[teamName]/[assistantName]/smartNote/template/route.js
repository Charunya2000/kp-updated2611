'use server';

import { upsertSmartNoteTemplate, getSmartNoteTemplates } from '@/app/services/smartNoteTemplateService';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName } = await params;

    const templates = await getSmartNoteTemplates(teamName, assistantName);
    return NextResponse.json(templates, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const { smartNoteId, templateData } = await req.json();

    if (!smartNoteId || !templateData) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    const template = await upsertSmartNoteTemplate(smartNoteId, templateData, teamName);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
