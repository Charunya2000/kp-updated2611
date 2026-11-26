import { NextResponse } from 'next/server';
import { getOracleConnection } from '@/app/services/oracleService';
import { getFeatureFlag } from '@/app/services/featureFlagService';
import { kpifCompareStatus } from '@/utils/constants';
import { saveRunMetadata } from '@/app/medicare-cmp/invoice-compare/services/resultsBlobService';
import { TARGET_DATABASES } from '@/app/medicare-cmp/invoice-compare/config/targetDatabases';
import { DATABASE_TO_ACCOUNT } from '@/app/medicare-cmp/invoice-compare/config/targetDatabasesServer';
import {
  registerSprocConnection,
  unregisterSprocConnection,
} from '@/app/medicare-cmp/invoice-compare/services/sprocConnectionRegistry';

/**
 * POST /api/medicare/batch-entry
 * Submit a new batch entry for Medicare comparison processing.
 *
 * Creates a BackgroundJob document in MongoDB, starts the Oracle
 * MEDICARE_CMP_RUN_BATCH procedure (fire-and-forget), and returns the job.
 *
 * Request body:
 * {
 *   targetDatabase: 'default' | 'jpt' | 'perf',
 *   batchNumber: string,
 *   processedOn: string (YYYY-MM-DD),
 *   refresh: boolean (optional, defaults to true)
 * }
 *
 * Response: BackgroundJob document
 */
export async function POST(request) {
  try {
    const { targetDatabase, batchNumber, processedOn, refresh: requestedRefresh } = await request.json();
    const refresh = requestedRefresh !== false;

    // --- Validation ---
    if (!batchNumber || typeof batchNumber !== 'string' || !batchNumber.trim()) {
      return NextResponse.json(
        { error: 'batchNumber is required and must be a non-empty string.' },
        { status: 400 }
      );
    }

    if (!processedOn) {
      return NextResponse.json(
        { error: 'processedOn date is required.' },
        { status: 400 }
      );
    }

    if (!TARGET_DATABASES.includes(targetDatabase)) {
      return NextResponse.json(
        { error: `targetDatabase must be one of: ${TARGET_DATABASES.join(', ')}` },
        { status: 400 }
      );
    }

    // --- Create Status Object ---
    const runId = Date.now();
    const job = {
      status: kpifCompareStatus.START,
      currentStep: 'Start',
      nextStep: 'Launch Compare Process',
      runId,
      batchNumber: batchNumber.trim(),
      targetDatabase,
      processedOn,
      refresh: !!refresh,
      errorMessage: '',
    };

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'submitBatchEntry - medicare',
        detail: { runId, batchNumber: batchNumber.trim(), targetDatabase },
      },
    }));

    // --- Persist processedOn so it survives the async gap to Excel generation ---
    saveRunMetadata({ runId, batchNumber: batchNumber.trim(), targetDatabase, processedOn }).catch((err) => {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'saveRunMetadata - medicare',
          detail: { runId, batchNumber: batchNumber.trim(), targetDatabase, error: err.message },
        },
      }));
    });

    // --- Fire-and-forget: start Oracle stored procedure ---
    const usePerformanceSprocFlag = await getFeatureFlag('use-medicare-performance-sproc');
    const sprocName = usePerformanceSprocFlag?.enabled
      ? 'COMPARE_OWNER.MEDICARE_CMP_RUN_BATCH_NEW'
      : 'COMPARE_OWNER.MEDICARE_CMP_RUN_BATCH';

    const account = DATABASE_TO_ACCOUNT[targetDatabase];
    const connection = await getOracleConnection(account);

    if (connection) {
      registerSprocConnection(runId, connection);

      connection.execute(
        `BEGIN ${sprocName}(:runId, :batchNumber, :refreshData); END;`,
        {
          runId,
          batchNumber: batchNumber.trim(),
          refreshData: refresh ? 'Y' : 'N',
        },
        { autoCommit: true }
      ).then(() => {
        console.log(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'medicareCmpRunBatchComplete',
            detail: { runId, batchNumber: batchNumber.trim(), sprocName },
          },
        }));
      }).catch((err) => {
        console.error(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'medicareCmpRunBatchError',
            detail: { runId, batchNumber: batchNumber.trim(), sprocName, error: err.message },
          },
        }));
      }).finally(async () => {
        unregisterSprocConnection(runId);
        try { await connection.close(); } catch (e) { /* ignore */ }
      });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'submitBatchEntry - medicare',
        detail: { error: error.message },
      },
    }));

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
