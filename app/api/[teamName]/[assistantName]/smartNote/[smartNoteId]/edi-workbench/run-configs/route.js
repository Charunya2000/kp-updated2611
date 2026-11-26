import { NextResponse } from 'next/server';
import {
  createEdiCompanionGuideRunConfig,
  listEdiCompanionGuideRunConfigs,
} from '@/app/services/ediCompanionGuideRunConfigService';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get('templateId') || null;

    const runConfigs = await listEdiCompanionGuideRunConfigs({
      teamName,
      assistantName,
      smartNoteId,
      templateId,
    });

    return NextResponse.json({ runConfigs }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'listEdiCompanionGuideRunConfigsRoute',
        detail: { error: error?.message || 'Failed to list run configs' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to list run configs' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const payload = await req.json();

    const runConfig = await createEdiCompanionGuideRunConfig({
      teamName,
      assistantName,
      smartNoteId,
      runConfig: payload,
    });

    return NextResponse.json({ runConfig }, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'createEdiCompanionGuideRunConfigRoute',
        detail: { error: error?.message || 'Failed to create run config' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to create run config' }, { status: 500 });
  }
}
