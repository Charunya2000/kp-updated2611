import { NextResponse } from 'next/server';
import { createEdiCompanionGuideTemplate } from '@/app/services/ediCompanionGuideTemplateService';

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const payload = await req.json();

    const template = await createEdiCompanionGuideTemplate({
      teamName,
      assistantName,
      smartNoteId,
      template: {
        ...payload,
        source: {
          ...(payload?.source || {}),
          kind: 'csv',
        },
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'importEdiCompanionGuideTemplateFromCsvRoute',
        detail: { error: error?.message || 'Failed to import template from CSV' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to import template from CSV' }, { status: 500 });
  }
}
