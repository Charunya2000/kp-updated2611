import { NextResponse } from 'next/server';
import {
  deleteEdiCompanionGuideTemplate,
  getEdiCompanionGuideTemplateById,
  updateEdiCompanionGuideTemplate,
} from '@/app/services/ediCompanionGuideTemplateService';

export async function GET(_, { params }) {
  try {
    const { teamName, templateId } = await params;

    const template = await getEdiCompanionGuideTemplateById({
      teamName,
      templateId,
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getEdiCompanionGuideTemplateByIdRoute',
        detail: { error: error?.message || 'Failed to fetch template' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to fetch template' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, templateId } = await params;
    const payload = await req.json();

    const template = await updateEdiCompanionGuideTemplate({
      teamName,
      templateId,
      updates: payload,
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'updateEdiCompanionGuideTemplateRoute',
        detail: { error: error?.message || 'Failed to update template' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  try {
    const { teamName, templateId } = await params;

    const deleted = await deleteEdiCompanionGuideTemplate({
      teamName,
      templateId,
    });

    if (!deleted) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteEdiCompanionGuideTemplateRoute',
        detail: { error: error?.message || 'Failed to delete template' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to delete template' }, { status: 500 });
  }
}
