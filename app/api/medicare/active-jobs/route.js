import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getOracleConnection } from '@/app/services/oracleService';
import { DATABASE_CONFIGS } from '@/app/medicare-cmp/invoice-compare/config/targetDatabasesServer';
import { medicareCompareStatus } from '@/utils/constants';

const TERMINAL_STATUSES = [medicareCompareStatus.COMPLETE, medicareCompareStatus.ERROR, medicareCompareStatus.CANCELED];

/**
 * GET /api/medicare/active-jobs
 * Query all Oracle target databases for any non-terminal Medicare compare jobs.
 *
 * Response: { jobs: [ { runId, batchNumber, targetDatabase, runStatus } ] }
 */
export async function GET() {
  const activeJobs = [];

  for (const { targetDatabase, account } of DATABASE_CONFIGS) {
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
      INVOICES_MED, TOTAL_RECORDS_ORMB, TOTAL_COMPARE_MED,
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
      FROM COMPARE_OWNER.MEDICARE_CMP_RUN_STATUS
      WHERE STATUS NOT IN (${statusPlaceholders.join(', ')})`;

      const result = await connection.execute(query,
        bindVars,
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows && result.rows.length > 0) {
        for (const row of result.rows) {
          const totalRecords = Number(row.TOTAL_COMPARE_MED || 0);
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
              invoicesMed: row.INVOICES_MED,
              totalRecordsOrmb: row.TOTAL_RECORDS_ORMB,
              totalCompareMed: row.TOTAL_COMPARE_MED,
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
          name: 'getActiveJobs - medicare',
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
