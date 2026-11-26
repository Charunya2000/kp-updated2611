import { NextResponse } from 'next/server';
import { DEFAULT_PAGE_SIZE, getRunHistory } from '@/app/medicare-cmp/invoice-compare/services/batchService';
import { deleteRunHistoryRow } from '@/app/medicare-cmp/invoice-compare/services/batchService';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

/**
 * GET /api/medicare/run-history?page=1&pageSize=10
 * Fetch paginated terminal (COMPLETE / ERROR) run history across all Oracle
 * target databases.
 *
 * Query parameters:
 *   page     - 1-based page number (default 1)
 *   pageSize - rows per page (default 10)
 *
 * Response:
 * {
 *   rows: [ { runId, batchNumber, targetDatabase, status, startTs, endTs } ],
 *   totalRows: number,
 *   page: number,
 *   pageSize: number,
 *   totalPages: number,
 * }
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10));
  const targetDatabase = (searchParams.get('targetDatabase') || '').trim();

  const result = await getRunHistory({
    page,
    pageSize,
    targetDatabase: targetDatabase || undefined,
  });
  return NextResponse.json(result);
}

async function deleteHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');
    const batchNumber = searchParams.get('batchNumber');
    const targetDatabase = searchParams.get('targetDatabase');

    const result = await deleteRunHistoryRow({ runId, batchNumber, targetDatabase });
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteRunHistoryRouteSuccess - medicare',
        detail: {
          runId,
          batchNumber,
          targetDatabase,
          method: 'DELETE',
          path: '/api/medicare/run-history',
        },
      },
    }));
    return NextResponse.json(result);
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteRunHistoryRouteFailure - medicare',
        detail: {
          method: 'DELETE',
          path: '/api/medicare/run-history',
          error: error?.message || 'Failed to delete run history.',
        },
      },
    }));
    return NextResponse.json(
      { error: error?.message || 'Failed to delete run history.' },
      { status: error?.status || 500 }
    );
  }
}

export const DELETE = withTeamPermissionGuard(PERMISSIONS.MEDICARE_RUN_HISTORY_DELETE, {
  teamName: 'medicare-cmp',
})(deleteHandler);
