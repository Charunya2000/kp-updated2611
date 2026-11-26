import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import {
  getQueryContent,
  saveQueryContent,
  QUERY_REGISTRY,
} from '@/app/services/medicareQueryService';

export const GET = withTeamPermissionGuard(PERMISSIONS.MEDICARE_QUERY_CONFIG_MANAGE)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.MEDICARE_QUERY_CONFIG_MANAGE)(putHandler);

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const queryKey = searchParams.get('queryKey');
    const source = searchParams.get('source') || 'db';

    if (!queryKey || !QUERY_REGISTRY[queryKey]) {
      return NextResponse.json(
        { error: `Invalid queryKey. Must be one of: ${Object.keys(QUERY_REGISTRY).join(', ')}` },
        { status: 400 },
      );
    }

    if (source && !['db', 'file'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be either "db" or "file".' },
        { status: 400 },
      );
    }

    const result = await getQueryContent(queryKey, source);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET: MedicareQuery',
        detail: { error: error.message },
      },
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(req) {
  try {
    const body = await req.json();
    const { queryKey, content } = body;

    if (!queryKey || !QUERY_REGISTRY[queryKey]) {
      return NextResponse.json(
        { error: `Invalid queryKey. Must be one of: ${Object.keys(QUERY_REGISTRY).join(', ')}` },
        { status: 400 },
      );
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'content is required and must be a non-empty string.' },
        { status: 400 },
      );
    }

    const saved = await saveQueryContent(queryKey, content);
    if (!saved) {
      return NextResponse.json({ error: 'Failed to save query.' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'PUT: MedicareQuery',
        detail: { error: error.message },
      },
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
