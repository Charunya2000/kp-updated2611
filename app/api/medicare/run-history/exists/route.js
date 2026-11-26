import { NextResponse } from 'next/server';
import { checkRunHistoryBatchExists } from '@/app/medicare-cmp/invoice-compare/services/batchService';

/**
 * GET /api/medicare/run-history/exists?targetDatabase=jpt&batchNumber=3274
 * Check whether a terminal run-history row already exists for one batch in one
 * target database.
 *
 * Response:
 * { exists: boolean }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDatabase = searchParams.get('targetDatabase');
    const batchNumber = searchParams.get('batchNumber');

    if (!targetDatabase || !batchNumber) {
      return NextResponse.json(
        { error: 'targetDatabase and batchNumber are required query parameters.' },
        { status: 400 }
      );
    }

    const exists = await checkRunHistoryBatchExists({ targetDatabase, batchNumber });
    return NextResponse.json({ exists });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'checkRunHistoryBatchExistsRoute - medicare',
        detail: { error: error.message },
      },
    }));

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
