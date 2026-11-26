import oracledb from 'oracledb';
import { getOracleConnection } from '@/app/services/oracleService';
import { resolveQuery } from '@/app/services/medicareQueryService';
import { medicareCompareStatus } from '@/utils/constants';
import { TARGET_DATABASES } from '../config/targetDatabases';
import { DATABASE_CONFIGS, DATABASE_TO_ACCOUNT } from '../config/targetDatabasesServer';
import { deleteRunHistoryArtifacts } from './resultsBlobService';

export const VALID_TARGET_DATABASES = TARGET_DATABASES;

const TERMINAL_STATUSES = [medicareCompareStatus.COMPLETE, medicareCompareStatus.ERROR, medicareCompareStatus.CANCELED];

export const DEFAULT_PAGE_SIZE = 10;

const MED_IPB_RULES = [
  'INVOICE_TOTAL_AMOUNT',
  'COVERAGE_THROUGH_MONTH',
  'COVERAGE_THROUGH_YEAR',
  'INVOICE_SUMMARY_DUE_DATE',
  'ACTIVITY_START_DATE',
  'ACTIVITY_END_DATE',
  'COVERAGE_THROUGH_MONTH_DETAIL',
  'ORMB_ACCT_ID',
  'PRIMARY_SUB_TOTAL_AMOUNT',
  'SECONDARY_PARENT_BILLING_UNIT',
  'SECONDARY_SUB_TOTAL_AMOUNT',
  'BEGINNING_BALANCE',
  'PAYMENTS_AMOUNT',
  'REMITTANCE_REVERSAL_AMOUNT',
  'MED_NON_SUP_PREM_AMOUNT',
  'ADJUSTMENT_AMOUNT',
  'SUB_TOTAL',
  'MRN_PREFIX',
  'INVOICE_ACI_ACCT_NB',
  'INVOICE_ACI_AUTO_PAY_DATE',
  'PAST_DUE_COVERAGE_PERIOD',
  'PAST_DUE_DUE_DATE',
  'PAST_DUE_AMOUNT',
  'PAYMENTS_30_DATE',
  'PAYMENTS_30_AMOUNT',
  'SECONDARY_FAMILY_ACCOUNT_NO',
  'SECONDARY_MRN_SUFFIX',
  'MRN_SUFFIX',
  'CURRENT_RETIREE_SUBSIDY_AMOUNT',
  'CURRENT_SPDAP_AMOUNT',
  'CURRENT_DUES_LEP_AMOUNT',
  'CURRENT_DUES_LIS_AMOUNT',
  'RETROACTIVE_DUES_LEP_AMOUNT',
  'RETROACTIVE_LIS_AMOUNT',
  'RETROACTIVE_RETIREE_SUBSIDY_AMOUNT',
  'RETROACTIVE_SPDAP_AMOUNT',
  'INVOICE_GENERATED_DATE',
  'SUBSCRIBER_FIRST_NAME',
  'SUBSCRIBER_MID_INTL',
  'SUBSCRIBER_LAST_NAME',
  'SUBSCRIBER_ADDR_CARE_OF_FIRST_NAME',
  'SUBSCRIBER_ADDR_CARE_OF_MID_NAME',
  'SUBSCRIBER_ADDR_CARE_OF_LAST_NAME',
  'SUBSCRIBER_ADDR_ADDR_LN1',
  'SUBSCRIBER_ADDR_ADDR_LN2',
  'SUBSCRIBER_ADDR_ADDR_CITY',
  'SUBSCRIBER_ADDR_ADDR_STATE_CD',
  'SUBSCRIBER_ADDR_ADDR_ZIP_CD',
  'SUBSCRIBER_ADDR_ADDR_ZIP_CD_PLUS4'
];

function mapIpbCountRow(row, rules) {
  if (!row) {
    return {
      totalRecords: 0,
      ipbCounts: {},
    };
  }

  const ipbCounts = {};
  for (const rule of rules) {
    ipbCounts[rule] = {
      yes: row[`${rule}_YES`] ?? 0,
      no: row[`${rule}_NO`] ?? 0,
    };
  }

  return {
    totalRecords: row.TOTAL_RECORDS ?? 0,
    ipbCounts,
  };
}

export async function deleteRunHistoryRow({ runId, batchNumber, targetDatabase }) {
  const normalizedRunId = Number(runId);
  const normalizedBatchNumber = Number(batchNumber);
  const runStatusTable = 'COMPARE_OWNER.MEDICARE_CMP_RUN_STATUS';

  if (!normalizedRunId || !normalizedBatchNumber) {
    throw new Error('runId and batchNumber are required');
  }

  if (!VALID_TARGET_DATABASES.includes(targetDatabase)) {
    throw new Error(`targetDatabase must be one of: ${VALID_TARGET_DATABASES.join(', ')}`);
  }

  const account = DATABASE_TO_ACCOUNT[targetDatabase];
  let connection;

  try {
    connection = await getOracleConnection(account);

    if (!connection) {
      throw new Error('Failed to connect to Oracle database');
    }

    const runStatusResult = await connection.execute(
      `DELETE FROM COMPARE_OWNER.MEDICARE_CMP_RUN_STATUS
        WHERE RUN_ID = :runId
          AND BATCH_NBR = :batchNumber`,
      { runId: normalizedRunId, batchNumber: normalizedBatchNumber },
      { autoCommit: false }
    );

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteRunHistoryRowTableDeleteAttempt - medicare',
        detail: {
          table: runStatusTable,
          runId: normalizedRunId,
          batchNumber: normalizedBatchNumber,
          targetDatabase,
          rowsAffected: runStatusResult.rowsAffected || 0,
        },
      },
    }));

    if ((runStatusResult.rowsAffected || 0) === 0) {
      await connection.rollback();
      const error = new Error('No run history row found for the supplied identifiers.');
      error.status = 404;
      throw error;
    }

    await connection.commit();
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteRunHistoryRowTableDeleteSuccess - medicare',
        detail: {
          table: runStatusTable,
          runId: normalizedRunId,
          batchNumber: normalizedBatchNumber,
          targetDatabase,
        },
      },
    }));
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteRunHistoryRowTableDeleteFailure - medicare',
        detail: {
          table: runStatusTable,
          runId: normalizedRunId,
          batchNumber: normalizedBatchNumber,
          targetDatabase,
          error: error.message,
        },
      },
    }));
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) { /* ignore */ }
    }
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { /* ignore */ }
    }
  }

  try {
    await deleteRunHistoryArtifacts({
      runId: normalizedRunId,
      batchNumber: normalizedBatchNumber,
      targetDatabase,
    });

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteRunHistoryRowArtifactsSuccess - medicare',
        detail: {
          runId: normalizedRunId,
          batchNumber: normalizedBatchNumber,
          targetDatabase,
        },
      },
    }));
  } catch (artifactError) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteRunHistoryRowArtifactsFailure - medicare',
        detail: {
          runId: normalizedRunId,
          batchNumber: normalizedBatchNumber,
          targetDatabase,
          error: artifactError.message,
        },
      },
    }));
  }

  return {
    success: true,
    runId: normalizedRunId,
    batchNumber: normalizedBatchNumber,
    targetDatabase,
  };
}

export async function getIpbCountByRun({ runId, batchNumber, targetDatabase }) {
  if (!runId || !batchNumber) {
    throw new Error('runId and batchNumber are required');
  }

  if (!VALID_TARGET_DATABASES.includes(targetDatabase)) {
    throw new Error(`targetDatabase must be one of: ${VALID_TARGET_DATABASES.join(', ')}`);
  }

  let connection;
  try {
    const account = DATABASE_TO_ACCOUNT[targetDatabase];
    connection = await getOracleConnection(account);
    if (!connection) {
      throw new Error('Failed to connect to Oracle database');
    }

    const [medSqlQuery] = await Promise.all([
      resolveQuery('select_final_results_ipb_count_med'),
    ]);
    if (!medSqlQuery) {
      throw new Error('Failed to load IPB count SQL queries');
    }

    const bindParams = { runId: Number(runId), batchNbr: Number(batchNumber) };
    const medResult = await connection.execute(medSqlQuery, bindParams, { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 1 });

    const medRow = medResult.rows?.[0];
    if (!medRow) {
      return null;
    }

    const sourceRow = medRow;
    const med = mapIpbCountRow(medRow, MED_IPB_RULES);

    return {
      runId: sourceRow.RUN_ID,
      batchNumber: sourceRow.BATCH_NBR,
      totalRecords: med.totalRecords,
      ipbCounts: med.ipbCounts,
      med: med,
    };
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { /* ignore */ }
    }
  }
}

export async function checkRunHistoryBatchExists({ batchNumber, targetDatabase }) {
  const normalizedBatchNumber = String(batchNumber || '').trim();

  if (!normalizedBatchNumber) {
    throw new Error('batchNumber is required');
  }

  if (!VALID_TARGET_DATABASES.includes(targetDatabase)) {
    throw new Error(`targetDatabase must be one of: ${VALID_TARGET_DATABASES.join(', ')}`);
  }

  let connection;
  try {
    const account = DATABASE_TO_ACCOUNT[targetDatabase];
    connection = await getOracleConnection(account);

    if (!connection) {
      throw new Error('Failed to connect to Oracle database');
    }

    const bindVars = { batchNumber: normalizedBatchNumber };
    const statusPlaceholders = TERMINAL_STATUSES.map((status, index) => {
      const key = `s${index}`;
      bindVars[key] = status;
      return `:${key}`;
    });

    const result = await connection.execute(
      `SELECT 1
         FROM COMPARE_OWNER.MEDICARE_CMP_RUN_STATUS
        WHERE TO_CHAR(BATCH_NBR) = :batchNumber
          AND STATUS IN (${statusPlaceholders.join(', ')})
        FETCH FIRST 1 ROWS ONLY`,
      bindVars,
      { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 1 }
    );

    return !!(result.rows && result.rows.length > 0);
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { /* ignore */ }
    }
  }
}

export async function getRunHistory({ page = 1, pageSize = DEFAULT_PAGE_SIZE, targetDatabase } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);

  if (targetDatabase) {
    if (!VALID_TARGET_DATABASES.includes(targetDatabase)) {
      throw new Error(`targetDatabase must be one of: ${VALID_TARGET_DATABASES.join(', ')}`);
    }

    const account = DATABASE_TO_ACCOUNT[targetDatabase];
    let connection;

    try {
      connection = await getOracleConnection(account);
      if (!connection) {
        return {
          rows: [],
          totalRows: 0,
          page: safePage,
          pageSize: safePageSize,
          totalPages: 1,
        };
      }

      const statusBindVars = {};
      const statusPlaceholders = TERMINAL_STATUSES.map((status, index) => {
        const key = `s${index}`;
        statusBindVars[key] = status;
        return `:${key}`;
      });

      const countResult = await connection.execute(
        `SELECT COUNT(1) AS TOTAL_ROWS
           FROM COMPARE_OWNER.MEDICARE_CMP_RUN_STATUS
          WHERE STATUS IN (${statusPlaceholders.join(', ')})`,
        statusBindVars,
        { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 1 }
      );

      const totalRows = Number(countResult.rows?.[0]?.TOTAL_ROWS || 0);
      const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
      const offset = (safePage - 1) * safePageSize;

      const result = await connection.execute(
        `SELECT RUN_ID, BATCH_NBR, STATUS,
                INVOICES_MED, TOTAL_RECORDS_ORMB, TOTAL_COMPARE_MED, START_TS, END_TS
           FROM COMPARE_OWNER.MEDICARE_CMP_RUN_STATUS
          WHERE STATUS IN (${statusPlaceholders.join(', ')})
          ORDER BY START_TS DESC
          OFFSET :offsetRows ROWS FETCH NEXT :fetchRows ROWS ONLY`,
        {
          ...statusBindVars,
          offsetRows: offset,
          fetchRows: safePageSize,
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const rows = [];
      if (result.rows && result.rows.length > 0) {
        for (const row of result.rows) {
          const totalRecords = Number(row.TOTAL_COMPARE_MED || 0);
          rows.push({
            runId: row.RUN_ID,
            batchNumber: String(row.BATCH_NBR),
            targetDatabase,
            status: row.STATUS,
            invoicesMed: row.INVOICES_MED,
            totalRecordsOrmb: row.TOTAL_RECORDS_ORMB,
            totalCompareMed: row.TOTAL_COMPARE_MED,
            totalRecords,
            startTs: row.START_TS,
            endTs: row.END_TS,
          });
        }
      }

      return {
        rows,
        totalRows,
        page: safePage,
        pageSize: safePageSize,
        totalPages,
      };
    } catch (error) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'getRunHistory - medicare',
          detail: { targetDatabase, error: error.message },
        },
      }));
      throw error;
    } finally {
      if (connection) {
        try { await connection.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  const allRows = [];

  for (const { targetDatabase, account } of DATABASE_CONFIGS) {
    let connection;

    try {
      connection = await getOracleConnection(account);
      if (!connection) continue;

      const bindVars = {};
      const statusPlaceholders = TERMINAL_STATUSES.map((status, index) => {
        const key = `s${index}`;
        bindVars[key] = status;
        return `:${key}`;
      });

      const result = await connection.execute(
        `SELECT RUN_ID, BATCH_NBR, STATUS,
                  INVOICES_MED, TOTAL_RECORDS_ORMB, TOTAL_COMPARE_MED, START_TS, END_TS
					 FROM COMPARE_OWNER.MEDICARE_CMP_RUN_STATUS
					WHERE STATUS IN (${statusPlaceholders.join(', ')})
					ORDER BY START_TS DESC`,
        bindVars,
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows && result.rows.length > 0) {
        for (const row of result.rows) {
          const totalRecords = Number(row.TOTAL_COMPARE_MED || 0);
          allRows.push({
            runId: row.RUN_ID,
            batchNumber: String(row.BATCH_NBR),
            targetDatabase,
            status: row.STATUS,
            invoicesMed: row.INVOICES_MED,
            totalRecordsOrmb: row.TOTAL_RECORDS_ORMB,
            totalCompareMed: row.TOTAL_COMPARE_MED,
            totalRecords,
            startTs: row.START_TS,
            endTs: row.END_TS,
          });
        }
      }
    } catch (error) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'getRunHistory - medicare',
          detail: { targetDatabase, error: error.message },
        },
      }));
    } finally {
      if (connection) {
        try { await connection.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  allRows.sort((a, b) => {
    const tsA = a.startTs ? new Date(a.startTs).getTime() : 0;
    const tsB = b.startTs ? new Date(b.startTs).getTime() : 0;
    return tsB - tsA;
  });

  const totalRows = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
  const offset = (safePage - 1) * safePageSize;
  const rows = allRows.slice(offset, offset + safePageSize);

  return {
    rows,
    totalRows,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}
