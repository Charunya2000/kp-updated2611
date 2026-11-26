import oracledb from 'oracledb';
import fs from 'fs';
import path from 'path';
import { getOracleConnection } from '@/app/services/oracleService';
import { resolveQuery } from '@/app/services/kpifQueryService';
import { kpifCompareStatus } from '@/utils/constants';
import { KPIF_TARGET_DATABASES } from '../config/targetDatabases';
import { KPIF_DATABASE_CONFIGS, KPIF_DATABASE_TO_ACCOUNT } from '../config/targetDatabasesServer';
import { deleteRunHistoryArtifacts } from './resultsBlobService';

export const VALID_TARGET_DATABASES = KPIF_TARGET_DATABASES;

const TERMINAL_STATUSES = [kpifCompareStatus.COMPLETE, kpifCompareStatus.ERROR, kpifCompareStatus.CANCELED];

export const DEFAULT_PAGE_SIZE = 10;

const CA_IPB_RULES = [
  'IPB0001_3',
  'IPB0001_4',
  'IPB0001_6',
  'IPB0001_12',
  'IPB0001_16',
  'IPB0001_17',
  'IPB0001_22',
  'IPB0001_23',
  'IPB0001_24',
  'IPB0001_25',
  'IPB0001_26',
  'IPB0001_27',
  'IPB0001_28',
  'IPB0001_29',
];

const MOC_IPB_RULES = [
  'IPB0001_19',
  'IPB0001_29',
  'IPB0001_8',
  'IPB0001_24',
  'IPB0001_25',
  'IPB0001_30',
  'IPB0001_42',
  'IPB0001_28',
  'IPB0001_31',
  'IPB0001_43',
  'IPB0001_14',
  'IPB0001_18',
  'IPB0001_4',
  'IPB0001_5',
];

const HISTORY_TABLES = {
  ca: 'COMPARE_OWNER.KPIF_CMP_RESULTS_HISTORY',
  moc: 'COMPARE_OWNER.MOC_CMP_RESULTS_HISTORY',
};

let cachedCountQueriesPromise;

function deriveTotalRecordsFromRuleCounts(row, rules) {
  let derivedTotalRecords = 0;

  for (const rule of rules) {
    const pass = Number(row?.[`${rule}_PASS`] ?? row?.[`${rule}_YES`] ?? 0);
    const fail = Number(row?.[`${rule}_FAIL`] ?? row?.[`${rule}_NO`] ?? 0);
    derivedTotalRecords = Math.max(derivedTotalRecords, pass + fail);
  }

  return derivedTotalRecords;
}

function mapIpbCountRow(row, rules) {
  if (!row) {
    return {
      totalRecords: 0,
      ipbCounts: {},
      qualityScore: null,
      qualityPercent: null,
    };
  }

  const ipbCounts = {};
  for (const rule of rules) {
    const pass = Number(row[`${rule}_PASS`] ?? row[`${rule}_YES`] ?? 0);
    const fail = Number(row[`${rule}_FAIL`] ?? row[`${rule}_NO`] ?? 0);

    ipbCounts[rule] = {
      pass,
      fail,
      // Backward compatibility for existing UI consumers.
      yes: pass,
      no: fail,
    };
  }

  const totalRecords = Number(row.TOTAL_RECORDS ?? deriveTotalRecordsFromRuleCounts(row, rules));
  const totalPass = rules.reduce((sum, rule) => sum + Number(row[`${rule}_PASS`] ?? row[`${rule}_YES`] ?? 0), 0);
  const totalFail = rules.reduce((sum, rule) => sum + Number(row[`${rule}_FAIL`] ?? row[`${rule}_NO`] ?? 0), 0);
  const denominator = totalPass + totalFail;

  return {
    totalRecords,
    ipbCounts,
    qualityScore: Number(row.QUALITY_SCORE ?? totalPass),
    qualityPercent: denominator > 0
      ? Number(row.QUALITY_PERCENT ?? ((totalPass / denominator) * 100))
      : null,
  };
}

async function getCountQueries() {
  if (!cachedCountQueriesPromise) {
    cachedCountQueriesPromise = Promise.all([
      resolveQuery('select_final_results_ipb_count_ca'),
      resolveQuery('select_final_results_ipb_count_moc'),
    ]);
  }

  return cachedCountQueriesPromise;
}

function isHistoryTableCompatibilityError(error) {
  return [904, 942].includes(error?.errorNum)
    || /ORA-00904|ORA-00942/i.test(error?.message || '');
}

function buildHistoryResponse({ runId, batchNumber, caRow, mocRow }) {
  if (!caRow && !mocRow) {
    return null;
  }

  const sourceRow = caRow || mocRow;
  const ca = mapIpbCountRow(caRow, CA_IPB_RULES);
  const moc = mapIpbCountRow(mocRow, MOC_IPB_RULES);

  return {
    runId: sourceRow?.RUN_ID ?? Number(runId),
    batchNumber: sourceRow?.BATCH_NBR ?? Number(batchNumber),
    totalRecords: ca.totalRecords,
    ipbCounts: ca.ipbCounts,
    qualityScore: ca.qualityScore,
    qualityPercentCa: ca.qualityPercent,
    qualityPercentMoc: moc.qualityPercent,
    ca,
    moc,
  };
}

async function loadHistoryRows(connection, { runId, batchNumber }) {
  const bindParams = { runId: Number(runId), batchNbr: Number(batchNumber) };

  const caResult = await connection.execute(
    `SELECT *
       FROM ${HISTORY_TABLES.ca}
      WHERE RUN_ID = :runId
        AND BATCH_NBR = :batchNbr`,
    bindParams,
    { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 1 }
  );

  const mocResult = await connection.execute(
    `SELECT *
       FROM ${HISTORY_TABLES.moc}
      WHERE RUN_ID = :runId
        AND BATCH_NBR = :batchNbr`,
    bindParams,
    { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 1 }
  );

  return {
    caRow: caResult.rows?.[0] || null,
    mocRow: mocResult.rows?.[0] || null,
  };
}

async function loadAggregateCountRows(connection, { runId, batchNumber }) {
  const [caSqlQuery, mocSqlQuery] = await getCountQueries();
  if (!caSqlQuery || !mocSqlQuery) {
    throw new Error('Failed to load IPB count SQL queries');
  }

  const bindParams = { runId: Number(runId), batchNbr: Number(batchNumber) };
  const caResult = await connection.execute(caSqlQuery, bindParams, {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
    maxRows: 1,
  });

  const mocResult = await connection.execute(mocSqlQuery, bindParams, {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
    maxRows: 1,
  });

  return {
    caRow: caResult.rows?.[0] || null,
    mocRow: mocResult.rows?.[0] || null,
  };
}

async function upsertHistoryRow(connection, tableName, row, rules) {
  if (!row) {
    return;
  }

  const countColumns = rules.flatMap((rule) => [`${rule}_PASS`, `${rule}_FAIL`]);
  const totalPass = rules.reduce((sum, rule) => {
    return sum + Number(row[`${rule}_PASS`] ?? row[`${rule}_YES`] ?? 0);
  }, 0);
  const totalFail = rules.reduce((sum, rule) => {
    return sum + Number(row[`${rule}_FAIL`] ?? row[`${rule}_NO`] ?? 0);
  }, 0);
  const qualityPercent = (totalPass + totalFail) > 0
    ? (totalPass / (totalPass + totalFail)) * 100
    : null;

  const bindParams = {
    runId: Number(row.RUN_ID),
    batchNbr: Number(row.BATCH_NBR),
    TOTAL_RECORDS: Number(row.TOTAL_RECORDS ?? deriveTotalRecordsFromRuleCounts(row, rules)),
    QUALITY_SCORE: Number(totalPass),
    QUALITY_PERCENT: qualityPercent,
  };

  for (const rule of rules) {
    bindParams[`${rule}_PASS`] = Number(row[`${rule}_PASS`] ?? row[`${rule}_YES`] ?? 0);
    bindParams[`${rule}_FAIL`] = Number(row[`${rule}_FAIL`] ?? row[`${rule}_NO`] ?? 0);
  }

  const updateAssignments = [
    ...countColumns.map((column) => `T.${column} = :${column}`),
    'T.TOTAL_RECORDS = :TOTAL_RECORDS',
    'T.QUALITY_SCORE = :QUALITY_SCORE',
    'T.QUALITY_PERCENT = :QUALITY_PERCENT',
    'T.UPDATED_TS = SYSTIMESTAMP',
  ].join(',\n          ');

  const insertColumns = ['RUN_ID', 'BATCH_NBR', ...countColumns, 'TOTAL_RECORDS', 'QUALITY_SCORE', 'QUALITY_PERCENT', 'CREATED_TS', 'UPDATED_TS'];
  const insertValues = [
    ':runId',
    ':batchNbr',
    ...countColumns.map((column) => `:${column}`),
    ':TOTAL_RECORDS',
    ':QUALITY_SCORE',
    ':QUALITY_PERCENT',
    'SYSTIMESTAMP',
    'SYSTIMESTAMP',
  ];

  await connection.execute(
    `MERGE INTO ${tableName} T
     USING (SELECT :runId AS RUN_ID, :batchNbr AS BATCH_NBR FROM DUAL) S
        ON (T.RUN_ID = S.RUN_ID AND T.BATCH_NBR = S.BATCH_NBR)
     WHEN MATCHED THEN
       UPDATE SET ${updateAssignments}
     WHEN NOT MATCHED THEN
       INSERT (${insertColumns.join(', ')})
       VALUES (${insertValues.join(', ')})`,
    bindParams,
    { autoCommit: false }
  );
}

async function ensureHistoryCounts(connection, { runId, batchNumber }) {
  try {
    const historyRows = await loadHistoryRows(connection, { runId, batchNumber });
    if (historyRows.caRow && historyRows.mocRow) {
      return buildHistoryResponse({ runId, batchNumber, ...historyRows });
    }

    const aggregateRows = await loadAggregateCountRows(connection, { runId, batchNumber });
    if (!aggregateRows.caRow && !aggregateRows.mocRow) {
      return buildHistoryResponse({ runId, batchNumber, ...historyRows });
    }

    await upsertHistoryRow(connection, HISTORY_TABLES.ca, aggregateRows.caRow, CA_IPB_RULES);
    await upsertHistoryRow(connection, HISTORY_TABLES.moc, aggregateRows.mocRow, MOC_IPB_RULES);
    await connection.commit();

    const persistedHistoryRows = await loadHistoryRows(connection, { runId, batchNumber });
    return buildHistoryResponse({ runId, batchNumber, ...persistedHistoryRows });
  } catch (error) {
    if (isHistoryTableCompatibilityError(error)) {
      const aggregateRows = await loadAggregateCountRows(connection, { runId, batchNumber });
      return buildHistoryResponse({ runId, batchNumber, ...aggregateRows });
    }

    throw error;
  }
}

export async function deleteRunHistoryRow({ runId, batchNumber, targetDatabase }) {
  const normalizedRunId = Number(runId);
  const normalizedBatchNumber = Number(batchNumber);

  if (!normalizedRunId || !normalizedBatchNumber) {
    throw new Error('runId and batchNumber are required');
  }

  if (!VALID_TARGET_DATABASES.includes(targetDatabase)) {
    throw new Error(`targetDatabase must be one of: ${VALID_TARGET_DATABASES.join(', ')}`);
  }

  const account = KPIF_DATABASE_TO_ACCOUNT[targetDatabase];
  let connection;

  try {
    connection = await getOracleConnection(account);

    if (!connection) {
      throw new Error('Failed to connect to Oracle database');
    }

    const runStatusResult = await connection.execute(
      `DELETE FROM COMPARE_OWNER.KPIF_CMP_RUN_STATUS
        WHERE RUN_ID = :runId
          AND BATCH_NBR = :batchNumber`,
      { runId: normalizedRunId, batchNumber: normalizedBatchNumber },
      { autoCommit: false }
    );

    if ((runStatusResult.rowsAffected || 0) === 0) {
      await connection.rollback();
      const error = new Error('No run history row found for the supplied identifiers.');
      error.status = 404;
      throw error;
    }

    await connection.execute(
      `DELETE FROM COMPARE_OWNER.KPIF_CMP_RESULTS_HISTORY
        WHERE RUN_ID = :runId
          AND BATCH_NBR = :batchNumber`,
      { runId: normalizedRunId, batchNumber: normalizedBatchNumber },
      { autoCommit: false }
    );

    await connection.execute(
      `DELETE FROM COMPARE_OWNER.MOC_CMP_RESULTS_HISTORY
        WHERE RUN_ID = :runId
          AND BATCH_NBR = :batchNumber`,
      { runId: normalizedRunId, batchNumber: normalizedBatchNumber },
      { autoCommit: false }
    );

    await connection.commit();
  } catch (error) {
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
  } catch (artifactError) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteRunHistoryRowArtifacts',
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
    const account = KPIF_DATABASE_TO_ACCOUNT[targetDatabase];
    connection = await getOracleConnection(account);
    if (!connection) {
      throw new Error('Failed to connect to Oracle database');
    }

    try {
      const historyRows = await loadHistoryRows(connection, { runId, batchNumber });
      return buildHistoryResponse({ runId, batchNumber, ...historyRows });
    } catch (error) {
      if (isHistoryTableCompatibilityError(error)) {
        return null;
      }
      throw error;
    }
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
    const account = KPIF_DATABASE_TO_ACCOUNT[targetDatabase];
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
         FROM COMPARE_OWNER.KPIF_CMP_RUN_STATUS
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

    const account = KPIF_DATABASE_TO_ACCOUNT[targetDatabase];
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
           FROM COMPARE_OWNER.KPIF_CMP_RUN_STATUS
          WHERE STATUS IN (${statusPlaceholders.join(', ')})`,
        statusBindVars,
        { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 1 }
      );

      const totalRows = Number(countResult.rows?.[0]?.TOTAL_ROWS || 0);
      const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
      const offset = (safePage - 1) * safePageSize;

      const result = await connection.execute(
        `SELECT RUN_ID, BATCH_NBR, STATUS,
                INVOICES_CA, INVOICES_ROC, TOTAL_RECORDS_ORMB, TOTAL_COMPARE_CA, TOTAL_COMPARE_ROC,
                START_TS, END_TS
           FROM COMPARE_OWNER.KPIF_CMP_RUN_STATUS
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
          const totalRecords = Number(row.TOTAL_COMPARE_CA || 0) + Number(row.TOTAL_COMPARE_ROC || 0);
          let ipbCount = null;

          try {
            ipbCount = await ensureHistoryCounts(connection, {
              runId: row.RUN_ID,
              batchNumber: row.BATCH_NBR,
            });
          } catch (historyError) {
            console.error(JSON.stringify({
              kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'getRunHistoryHistoryCounts',
                detail: {
                  targetDatabase,
                  runId: row.RUN_ID,
                  batchNumber: row.BATCH_NBR,
                  error: historyError.message,
                },
              },
            }));
          }

          rows.push({
            runId: row.RUN_ID,
            batchNumber: String(row.BATCH_NBR),
            targetDatabase,
            status: row.STATUS,
            invoicesCa: row.INVOICES_CA,
            invoicesRoc: row.INVOICES_ROC,
            totalRecordsOrmb: row.TOTAL_RECORDS_ORMB,
            totalCompareCa: row.TOTAL_COMPARE_CA,
            totalCompareRoc: row.TOTAL_COMPARE_ROC,
            totalRecords,
            startTs: row.START_TS,
            endTs: row.END_TS,
            ipbCount,
            qualityScore: ipbCount?.qualityScore ?? null,
            qualityPercentCa: ipbCount?.qualityPercentCa ?? null,
            qualityPercentMoc: ipbCount?.qualityPercentMoc ?? null,
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
          name: 'getRunHistory',
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

  for (const { targetDatabase, account } of KPIF_DATABASE_CONFIGS) {
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
                  INVOICES_CA, INVOICES_ROC, TOTAL_RECORDS_ORMB, TOTAL_COMPARE_CA, TOTAL_COMPARE_ROC,
                  START_TS, END_TS
					 FROM COMPARE_OWNER.KPIF_CMP_RUN_STATUS
					WHERE STATUS IN (${statusPlaceholders.join(', ')})
					ORDER BY START_TS DESC`,
        bindVars,
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows && result.rows.length > 0) {
        for (const row of result.rows) {
          const totalRecords = Number(row.TOTAL_COMPARE_CA || 0) + Number(row.TOTAL_COMPARE_ROC || 0);
          let ipbCount = null;

          try {
            ipbCount = await ensureHistoryCounts(connection, {
              runId: row.RUN_ID,
              batchNumber: row.BATCH_NBR,
            });
          } catch (historyError) {
            console.error(JSON.stringify({
              kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'getRunHistoryHistoryCounts',
                detail: {
                  targetDatabase,
                  runId: row.RUN_ID,
                  batchNumber: row.BATCH_NBR,
                  error: historyError.message,
                },
              },
            }));
          }

          allRows.push({
            runId: row.RUN_ID,
            batchNumber: String(row.BATCH_NBR),
            targetDatabase,
            status: row.STATUS,
            invoicesCa: row.INVOICES_CA,
            invoicesRoc: row.INVOICES_ROC,
            totalRecordsOrmb: row.TOTAL_RECORDS_ORMB,
            totalCompareCa: row.TOTAL_COMPARE_CA,
            totalCompareRoc: row.TOTAL_COMPARE_ROC,
            totalRecords,
            startTs: row.START_TS,
            endTs: row.END_TS,
            ipbCount,
            qualityScore: ipbCount?.qualityScore ?? null,
            qualityPercentCa: ipbCount?.qualityPercentCa ?? null,
            qualityPercentMoc: ipbCount?.qualityPercentMoc ?? null,
          });
        }
      }
    } catch (error) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'getRunHistory',
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
