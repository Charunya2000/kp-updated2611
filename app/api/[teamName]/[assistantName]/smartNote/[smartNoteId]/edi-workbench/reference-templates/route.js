import { NextResponse } from 'next/server';
import {
  createEdiCompanionGuideTemplate,
  listEdiCompanionGuideTemplates,
} from '@/app/services/ediCompanionGuideTemplateService';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === '1';

    const templates = await listEdiCompanionGuideTemplates({
      teamName,
      assistantName,
      smartNoteId,
      includeInactive,
    });

    return NextResponse.json({ templates }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'listEdiCompanionGuideTemplatesRoute',
        detail: { error: error?.message || 'Failed to list templates' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to list templates' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const payload = await req.json();

    const template = await createEdiCompanionGuideTemplate({
      teamName,
      assistantName,
      smartNoteId,
      template: payload,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'createEdiCompanionGuideTemplateRoute',
        detail: { error: error?.message || 'Failed to create template' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to create template' }, { status: 500 });
  }
}
