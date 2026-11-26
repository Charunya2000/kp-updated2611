import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getOracleConnection } from '@/app/services/oracleService';
import { KPIF_TARGET_DATABASES } from '@/app/membership-admin/kpif-compare/config/targetDatabases';
import { KPIF_DATABASE_TO_ACCOUNT } from '@/app/membership-admin/kpif-compare/config/targetDatabasesServer';
import {
  checkFinalResultsBlobExists,
  uploadFinalResultsToBlob,
} from '@/app/membership-admin/kpif-compare/services/resultsBlobService';
import { breakSprocConnection } from '@/app/membership-admin/kpif-compare/services/sprocConnectionRegistry';

/**
 * GET /api/kpif/run-status?runId=&batchNumber=&targetDatabase=
 * Poll the current run status from the Oracle KPIF_CMP_RUN_STATUS table.
 *
 * Query parameters:
 *   runId          - The numeric run ID
 *   batchNumber    - The batch number
 *   targetDatabase - 'jpt' | 'perf' | 'rbc2'
 *
 * Response:
 * {
 *   runId, batchNumber, status, currentStep, nextStep,
 *   errorMessage, startTs, lastUpdateTs, endTs
 * }
 */
export async function GET(request) {
  let connection;

  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');
    const batchNumber = searchParams.get('batchNumber');
    const targetDatabase = searchParams.get('targetDatabase');

    if (!runId || !batchNumber) {
      return NextResponse.json(
        { error: 'runId and batchNumber are required query parameters.' },
        { status: 400 }
      );
    }

    if (!KPIF_TARGET_DATABASES.includes(targetDatabase)) {
      return NextResponse.json(
        { error: `targetDatabase must be one of: ${KPIF_TARGET_DATABASES.join(', ')}` },
        { status: 400 }
      );
    }

    const account = KPIF_DATABASE_TO_ACCOUNT[targetDatabase];
    connection = await getOracleConnection(account);

    if (!connection) {
      return NextResponse.json(
        { error: 'Failed to connect to Oracle database.' },
        { status: 503 }
      );
    }

    const result = await connection.execute(
      `SELECT RUN_ID, BATCH_NBR, STATUS, CURRENT_STEP, NEXT_STEP,
              ERROR_MESSAGE,
              INVOICES_CA, INVOICES_ROC, TOTAL_RECORDS_ORMB,
              TOTAL_COMPARE_CA, TOTAL_COMPARE_ROC,
              CASE
                WHEN START_TS IS NULL THEN NULL
                ELSE GREATEST(
                  0,
                  TRUNC(
                    EXTRACT(DAY FROM (COALESCE(END_TS, CASE WHEN STATUS IN ('COMPLETE', 'ERROR', 'CANCELED') THEN LAST_UPDATE_TS END, SYSTIMESTAMP) - START_TS)) * 86400 +
                    EXTRACT(HOUR FROM (COALESCE(END_TS, CASE WHEN STATUS IN ('COMPLETE', 'ERROR', 'CANCELED') THEN LAST_UPDATE_TS END, SYSTIMESTAMP) - START_TS)) * 3600 +
                    EXTRACT(MINUTE FROM (COALESCE(END_TS, CASE WHEN STATUS IN ('COMPLETE', 'ERROR', 'CANCELED') THEN LAST_UPDATE_TS END, SYSTIMESTAMP) - START_TS)) * 60 +
                    EXTRACT(SECOND FROM (COALESCE(END_TS, CASE WHEN STATUS IN ('COMPLETE', 'ERROR', 'CANCELED') THEN LAST_UPDATE_TS END, SYSTIMESTAMP) - START_TS))
                  )
                )
              END AS ELAPSED_SECONDS,
              TO_CHAR(START_TS, 'DD-MON-YY HH.MI.SS.FF9 AM', 'NLS_DATE_LANGUAGE=ENGLISH') AS START_TS_TXT,
              TO_CHAR(LAST_UPDATE_TS, 'DD-MON-YY HH.MI.SS.FF9 AM', 'NLS_DATE_LANGUAGE=ENGLISH') AS LAST_UPDATE_TS_TXT,
              TO_CHAR(END_TS, 'DD-MON-YY HH.MI.SS.FF9 AM', 'NLS_DATE_LANGUAGE=ENGLISH') AS END_TS_TXT
         FROM COMPARE_OWNER.KPIF_CMP_RUN_STATUS
        WHERE RUN_ID = :runId AND BATCH_NBR = :batchNumber`,
      { runId: Number(runId), batchNumber: Number(batchNumber) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 1 }
    );

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No run status found for the given runId and batchNumber.' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    const totalCompareCa = Number(row.TOTAL_COMPARE_CA || 0);
    const totalCompareMoc = Number(row.TOTAL_COMPARE_ROC || 0);
    const totalRecords = totalCompareCa + totalCompareMoc;

    // Server-side trigger for report upload/generation.
    // This replaces client-triggered upload on completion.
    if (row.STATUS === 'COMPLETE' && totalRecords > 0) {
      const invoiceTypesToEnsure = [];
      if (totalCompareCa > 0) {
        invoiceTypesToEnsure.push('ca');
      }
      if (totalCompareMoc > 0) {
        invoiceTypesToEnsure.push('moc');
      }

      for (const invoiceType of invoiceTypesToEnsure) {
        checkFinalResultsBlobExists({
          runId: row.RUN_ID,
          batchNumber: row.BATCH_NBR,
          targetDatabase,
          invoiceType,
        }).then((blobState) => {
          if (!blobState.exists && !blobState.uploading) {
            uploadFinalResultsToBlob({
              runId: row.RUN_ID,
              batchNumber: row.BATCH_NBR,
              targetDatabase,
              invoiceType,
            }).catch((uploadError) => {
              console.error(JSON.stringify({
                kpmsg: {
                  id: 'AI_PORTAL_NOTEBOOK',
                  name: 'runStatusAutoUploadFinalResults',
                  detail: {
                    runId: row.RUN_ID,
                    batchNumber: row.BATCH_NBR,
                    targetDatabase,
                    invoiceType,
                    error: uploadError.message,
                  },
                },
              }));
            });
          }
        }).catch((stateError) => {
          console.error(JSON.stringify({
            kpmsg: {
              id: 'AI_PORTAL_NOTEBOOK',
              name: 'runStatusAutoUploadFinalResults',
              detail: {
                runId: row.RUN_ID,
                batchNumber: row.BATCH_NBR,
                targetDatabase,
                invoiceType,
                error: stateError.message,
              },
            },
          }));
        });
      }
    }

    return NextResponse.json({
      runId: row.RUN_ID,
      batchNumber: row.BATCH_NBR,
      status: row.STATUS,
      currentStep: row.CURRENT_STEP,
      nextStep: row.NEXT_STEP,
      errorMessage: row.ERROR_MESSAGE,
      invoicesCa: row.INVOICES_CA,
      invoicesRoc: row.INVOICES_ROC,
      totalRecordsOrmb: row.TOTAL_RECORDS_ORMB,
      totalCompareCa: row.TOTAL_COMPARE_CA,
      totalCompareRoc: row.TOTAL_COMPARE_ROC,
      totalRecords,
      elapsedSeconds: row.ELAPSED_SECONDS,
      startTs: row.START_TS_TXT,
      lastUpdateTs: row.LAST_UPDATE_TS_TXT,
      endTs: row.END_TS_TXT,
    });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getRunStatus',
        detail: { error: error.message },
      },
    }));

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { /* ignore */ }
    }
  }
}

/**
 * PATCH /api/kpif/run-status
 * Cancel a running job by setting its status to ERROR with a cancellation message.
 *
 * Body: { runId, batchNumber, targetDatabase }
 */
export async function PATCH(request) {
  let connection;

  try {
    const body = await request.json();
    const { runId, batchNumber, targetDatabase } = body;

    if (!runId || !batchNumber) {
      return NextResponse.json(
        { error: 'runId and batchNumber are required.' },
        { status: 400 }
      );
    }

    if (!KPIF_TARGET_DATABASES.includes(targetDatabase)) {
      return NextResponse.json(
        { error: `targetDatabase must be one of: ${KPIF_TARGET_DATABASES.join(', ')}` },
        { status: 400 }
      );
    }

    const account = KPIF_DATABASE_TO_ACCOUNT[targetDatabase];

    // 1. Mark the job as CANCELED first so the sproc's CHECK_CANCELED sees it.
    connection = await getOracleConnection(account);

    if (!connection) {
      return NextResponse.json(
        { error: 'Failed to connect to Oracle database.' },
        { status: 503 }
      );
    }

    const result = await connection.execute(
      `UPDATE COMPARE_OWNER.KPIF_CMP_RUN_STATUS
          SET STATUS = 'CANCELED',
              CURRENT_STEP = 'CANCELED',
              NEXT_STEP = NULL,
              ERROR_MESSAGE = 'Job canceled by user',
              LAST_UPDATE_TS = SYSTIMESTAMP,
              END_TS = SYSTIMESTAMP
        WHERE RUN_ID = :runId
          AND BATCH_NBR = :batchNumber
          AND STATUS NOT IN ('COMPLETE', 'ERROR', 'CANCELED')`,
      { runId: Number(runId), batchNumber: Number(batchNumber) },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: 'No active job found to cancel. It may have already completed or errored.' },
        { status: 404 }
      );
    }

    // 2. Best-effort: interrupt the running sproc connection to speed up cancellation.
    const wasBroken = await breakSprocConnection(Number(runId));

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'cancelRunStatus',
        detail: { runId, batchNumber, targetDatabase, sprocInterrupted: wasBroken },
      },
    }));

    return NextResponse.json({ success: true, sprocInterrupted: wasBroken });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'cancelRunStatus',
        detail: { error: error.message },
      },
    }));

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { /* ignore */ }
    }
  }
}
