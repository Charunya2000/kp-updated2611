import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getOracleConnection } from '@/app/services/oracleService';
import { kpifCompareStatus } from '@/utils/constants';
import { saveRunMetadata } from '@/app/membership-admin/kpif-compare/services/resultsBlobService';
import { KPIF_TARGET_DATABASES } from '@/app/membership-admin/kpif-compare/config/targetDatabases';
import { KPIF_DATABASE_TO_ACCOUNT } from '@/app/membership-admin/kpif-compare/config/targetDatabasesServer';
import {
  registerSprocConnection,
  unregisterSprocConnection,
} from '@/app/membership-admin/kpif-compare/services/sprocConnectionRegistry';

const TERMINAL_STATUSES = [kpifCompareStatus.COMPLETE, kpifCompareStatus.ERROR, kpifCompareStatus.CANCELED];

/**
 * POST /api/kpif/batch-entry
 * Submit a new batch entry for KPIF comparison processing.
 *
 * Creates a BackgroundJob document in MongoDB, starts the Oracle
 * KPIF_CMP_RUN_BATCH procedure (fire-and-forget), and returns the job.
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

    if (!KPIF_TARGET_DATABASES.includes(targetDatabase)) {
      return NextResponse.json(
        { error: `targetDatabase must be one of: ${KPIF_TARGET_DATABASES.join(', ')}` },
        { status: 400 }
      );
    }

    const normalizedBatchNumber = batchNumber.trim();

    // --- Validate against active run for same batch in same target DB ---
    const account = KPIF_DATABASE_TO_ACCOUNT[targetDatabase];
    const connection = await getOracleConnection(account);

    if (!connection) {
      return NextResponse.json(
        { error: 'Unable to connect to the database.' },
        { status: 503 }
      );
    }

    const bindVars = { batchNumber: normalizedBatchNumber };
    const statusPlaceholders = TERMINAL_STATUSES.map((status, index) => {
      const key = `s${index}`;
      bindVars[key] = status;
      return `:${key}`;
    });

    try {
      const activeRunResult = await connection.execute(
        `SELECT RUN_ID, STATUS
           FROM COMPARE_OWNER.KPIF_CMP_RUN_STATUS
          WHERE TO_CHAR(BATCH_NBR) = :batchNumber
            AND STATUS NOT IN (${statusPlaceholders.join(', ')})
          FETCH FIRST 1 ROWS ONLY`,
        bindVars,
        { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 1 }
      );

      const activeRun = activeRunResult.rows?.[0] || null;
      if (activeRun) {
        await connection.close();
        return NextResponse.json(
          {
            error: `Batch ${normalizedBatchNumber} is already running. Please cancel the running batch and run again.`,
            runId: activeRun.RUN_ID,
            status: activeRun.STATUS,
          },
          { status: 409 }
        );
      }
    } catch (queryError) {
      await connection.close();
      throw queryError;
    }

    // --- Create Status Object ---
    const runId = Date.now();
    const job = {
      status: kpifCompareStatus.START,
      currentStep: 'Start',
      nextStep: 'Launch Compare Process',
      runId,
      batchNumber: normalizedBatchNumber,
      targetDatabase,
      processedOn,
      refresh: !!refresh,
      errorMessage: '',
    };

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'submitBatchEntry',
        detail: { runId, batchNumber: normalizedBatchNumber, targetDatabase },
      },
    }));

    // --- Persist processedOn so it survives the async gap to Excel generation ---
    saveRunMetadata({ runId, batchNumber: normalizedBatchNumber, targetDatabase, processedOn }).catch((err) => {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'saveRunMetadata',
          detail: { runId, batchNumber: normalizedBatchNumber, targetDatabase, error: err.message },
        },
      }));
    });

    // --- Fire-and-forget: start Oracle stored procedure ---
    registerSprocConnection(runId, connection);

    connection.execute(
      `BEGIN COMPARE_OWNER.KPIF_CMP_RUN_BATCH(:runId, :batchNumber, :refreshData); END;`,
      {
        runId,
        batchNumber: normalizedBatchNumber,
        refreshData: refresh ? 'Y' : 'N',
      },
      { autoCommit: true }
    ).then(() => {
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'kpifCmpRunBatchComplete',
          detail: { runId, batchNumber: normalizedBatchNumber },
        },
      }));
    }).catch((err) => {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'kpifCmpRunBatchError',
          detail: { runId, batchNumber: normalizedBatchNumber, error: err.message },
        },
      }));
    }).finally(async () => {
      unregisterSprocConnection(runId);
      try { await connection.close(); } catch (e) { /* ignore */ }
    });

    return NextResponse.json(job);
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'submitBatchEntry',
        detail: { error: error.message },
      },
    }));

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
