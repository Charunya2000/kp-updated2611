'use server';

import { deleteSmartNoteTemplate, getSmartNoteTemplate, updateSmartNoteTemplate } from '@/app/services/smartNoteTemplateService';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, templateId } = await params;

    if (!templateId) {
      return NextResponse.json({ error: 'Missing required parameter: templateId' }, { status: 400 });
    }

    const template = await getSmartNoteTemplate(templateId, teamName);
    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName, templateId } = await params;
    if (!templateId) {
      return NextResponse.json({ error: 'Missing required path parameter: templateId' }, { status: 400 });
    }
    const deleted = await deleteSmartNoteTemplate(templateId, teamName);
    if (!deleted) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Template deleted successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, templateId } = await params;
    const templateData = await req.json();

    if (!templateId) {
      return NextResponse.json({ error: 'Missing required path parameter: templateId' }, { status: 400 });
    }
    const template = await updateSmartNoteTemplate(templateId, templateData, teamName);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
