import { NextResponse } from 'next/server';
import {
  deleteEdiCompanionGuideRunConfig,
  getEdiCompanionGuideRunConfigById,
  updateEdiCompanionGuideRunConfig,
} from '@/app/services/ediCompanionGuideRunConfigService';

export async function GET(_, { params }) {
  try {
    const { teamName, runConfigId } = await params;

    const runConfig = await getEdiCompanionGuideRunConfigById({
      teamName,
      runConfigId,
    });

    if (!runConfig) {
      return NextResponse.json({ error: 'Run config not found' }, { status: 404 });
    }

    return NextResponse.json({ runConfig }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getEdiCompanionGuideRunConfigByIdRoute',
        detail: { error: error?.message || 'Failed to fetch run config' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to fetch run config' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, runConfigId } = await params;
    const payload = await req.json();

    const runConfig = await updateEdiCompanionGuideRunConfig({
      teamName,
      runConfigId,
      updates: payload,
    });

    if (!runConfig) {
      return NextResponse.json({ error: 'Run config not found' }, { status: 404 });
    }

    return NextResponse.json({ runConfig }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'updateEdiCompanionGuideRunConfigRoute',
        detail: { error: error?.message || 'Failed to update run config' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to update run config' }, { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  try {
    const { teamName, runConfigId } = await params;

    const deleted = await deleteEdiCompanionGuideRunConfig({
      teamName,
      runConfigId,
    });

    if (!deleted) {
      return NextResponse.json({ error: 'Run config not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteEdiCompanionGuideRunConfigRoute',
        detail: { error: error?.message || 'Failed to delete run config' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to delete run config' }, { status: 500 });
  }
}
