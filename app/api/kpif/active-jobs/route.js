import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getOracleConnection } from '@/app/services/oracleService';
import { KPIF_DATABASE_CONFIGS } from '@/app/membership-admin/kpif-compare/config/targetDatabasesServer';
import { kpifCompareStatus } from '@/utils/constants';

const TERMINAL_STATUSES = [kpifCompareStatus.COMPLETE, kpifCompareStatus.ERROR, kpifCompareStatus.CANCELED];

/**
 * GET /api/kpif/active-jobs
 * Query all Oracle target databases for any non-terminal KPIF compare jobs.
 *
 * Response: { jobs: [ { runId, batchNumber, targetDatabase, runStatus } ] }
 */
export async function GET() {
  const activeJobs = [];

  for (const { targetDatabase, account } of KPIF_DATABASE_CONFIGS) {
    let connection;

    try {
      connection = await getOracleConnection(account);

      if (!connection) continue;

      const bindVars = {};
      const statusPlaceholders = TERMINAL_STATUSES.map((s, i) => {
        const key = `s${i}`;
        bindVars[key] = s;
        return `:${key}`;
      });

      const query = `SELECT RUN_ID, BATCH_NBR, STATUS, CURRENT_STEP, NEXT_STEP, ERROR_MESSAGE,
      INVOICES_CA, INVOICES_ROC, TOTAL_RECORDS_ORMB, TOTAL_COMPARE_CA, TOTAL_COMPARE_ROC,
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
      WHERE STATUS NOT IN (${statusPlaceholders.join(', ')})`;

      const result = await connection.execute(query,
        bindVars,
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows && result.rows.length > 0) {
        for (const row of result.rows) {
          const totalRecords = Number(row.TOTAL_COMPARE_CA || 0) + Number(row.TOTAL_COMPARE_ROC || 0);
          activeJobs.push({
            runId: row.RUN_ID,
            batchNumber: String(row.BATCH_NBR),
            targetDatabase,
            runStatus: {
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
            },
          });
        }
      }
    } catch (error) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'getActiveJobs',
          detail: { targetDatabase, error: error.message },
        },
      }));
    } finally {
      if (connection) {
        try { await connection.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  return NextResponse.json({ jobs: activeJobs });
}
