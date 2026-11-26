import { NextResponse } from 'next/server';
import { getIpbCountByRun, VALID_TARGET_DATABASES } from '@/app/membership-admin/kpif-compare/services/batchService';

/**
 * GET /api/kpif/ipb-count?runId=&batchNumber=&targetDatabase=
 * Fetch YES/NO counts for all IPB rules for a specific run and batch.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');
    const batchNumber = searchParams.get('batchNumber');
    const targetDatabase = searchParams.get('targetDatabase');

    if (!runId || !batchNumber || !targetDatabase) {
      return NextResponse.json(
        { error: 'runId, batchNumber, and targetDatabase are required query parameters.' },
        { status: 400 }
      );
    }

    if (!VALID_TARGET_DATABASES.includes(targetDatabase)) {
      return NextResponse.json(
        { error: `targetDatabase must be one of: ${VALID_TARGET_DATABASES.join(', ')}` },
        { status: 400 }
      );
    }

    const data = await getIpbCountByRun({ runId, batchNumber, targetDatabase });

    if (!data) {
      return NextResponse.json(
        { error: 'No IPB count data found for the given runId and batchNumber.' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getIpbCount',
        detail: { error: error.message },
      },
    }));

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
