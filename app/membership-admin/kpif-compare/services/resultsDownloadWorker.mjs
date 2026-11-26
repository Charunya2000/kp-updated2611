/**
 * Worker thread script that generates Excel files from Oracle data using
 * streaming for both the database fetch and the Excel write, to minimize
 * memory usage.
 *
 * Runs off the main event loop so that CPU-intensive ExcelJS work
 * does not block the Next.js server.
 *
 * Receives via workerData:
 *   { runId, batchNumber, targetDatabase, invoiceType, oracleConnectionConfig }
 *
 * Posts incremental messages back to the parent:
 *   { type: 'part',     partNumber, arrayBuffer, byteOffset, byteLength }
 *   { type: 'complete', totalParts, totalRows }
 *   { type: 'noData' }
 *   { type: 'error',    status, error, details? }
 */
import { workerData, parentPort } from 'worker_threads';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';
import { KPIF_TARGET_DATABASES } from '../config/targetDatabases.js';
import { DEFAULT_RESULT_CONFIG_BY_INVOICE_TYPE } from '../config/defaultResultConfig.js';
import pkg from 'exceljs-hardened';
const { stream: { xlsx: { WorkbookWriter } } } = pkg;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VALID_DATABASES = KPIF_TARGET_DATABASES;
const VALID_INVOICE_TYPES = ['ca', 'moc'];

/** Maximum data rows per Excel file. Splits into parts when exceeded. */
const MAX_ROWS_PER_FILE = 70_000;

/** Rows fetched per Oracle ResultSet.getRows() call. */
const FETCH_BATCH_SIZE = 5_000;

/** Log memory usage every this many rows. */
const MEMORY_LOG_INTERVAL = 10_000;

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeInvoiceType(invoiceType = 'ca') {
  return String(invoiceType || 'ca').toLowerCase();
}

function getResultConfig(invoiceType) {
  // Prefer the config passed from the parent (fetched from MongoDB).
  if (workerData.resultConfig) {
    return workerData.resultConfig;
  }
  // Fall back to the hardcoded default.
  const normalized = normalizeInvoiceType(invoiceType);
  return DEFAULT_RESULT_CONFIG_BY_INVOICE_TYPE[normalized];
}

function buildFinalResultsFilename({ runId, batchNumber, invoiceType = 'ca', partNumber }) {
  const config = getResultConfig(invoiceType);
  const label = config?.filenameLabel || 'Non-Consolidated';
  const partSuffix = partNumber ? ` Part-${partNumber}` : '';
  return `IPB0001 Run-${runId} ${label} Results Batch-${batchNumber}${partSuffix}.xlsx`;
}

/**
 * Build an index mapping from config column positions to SQL result positions
 * using the ResultSet metadata. Each config header is matched to the SQL column
 * by sqlAlias (if provided) or name. Throws if any expected column is missing.
 */
function buildColumnMapping(resultConfig, metaData) {
  const sqlColumns = metaData.map(m => m.name);
  return resultConfig.columnHeaders.map((col) => {
    const sqlName = col.sqlAlias || col.name;
    const idx = sqlColumns.indexOf(sqlName);
    if (idx === -1) {
      throw new Error(
        `Column "${sqlName}" (header: "${col.name}") not found in SQL result. ` +
        `Available columns: ${sqlColumns.join(', ')}`
      );
    }
    return idx;
  });
}

/** Post a message with zero-copy ArrayBuffer transfer when possible. */
function postTransferable(msg) {
  if (msg.arrayBuffer instanceof ArrayBuffer) {
    parentPort.postMessage(msg, [msg.arrayBuffer]);
  } else {
    parentPort.postMessage(msg);
  }
}

/** Log process.memoryUsage() in kpmsg format. */
function logMemoryUsage(operation, extra = {}) {
  const mem = process.memoryUsage();
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'excelExportMemory',
      detail: {
        operation,
        heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
        rssMB: (mem.rss / 1024 / 1024).toFixed(1),
        externalMB: (mem.external / 1024 / 1024).toFixed(1),
        ...extra,
      },
    },
  }));
}

// ---------------------------------------------------------------------------
// Streaming Excel builder
// ---------------------------------------------------------------------------

/**
 * Create a new WorkbookWriter that streams into a PassThrough, collecting
 * the compressed XLSX bytes into an array of Buffer chunks. Returns an
 * object with helpers to add rows, finalize, and retrieve the buffer.
 */
function createStreamingWorkbook(resultConfig) {
  const chunks = [];
  const passthrough = new PassThrough();
  passthrough.on('data', (chunk) => chunks.push(chunk));

  const workbook = new WorkbookWriter({ stream: passthrough, useStyles: true });
  const worksheet = workbook.addWorksheet(resultConfig.worksheetName);

  // Column widths must be set before any rows are committed.
  worksheet.columns = resultConfig.columnHeaders.map((col) => ({
    header: col.name,
    width: Math.max(col.name.length + 2, 12),
  }));

  // Style the header row (row 1 is auto-created by the columns definition).
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };
  headerRow.commit();

  // Add 3 sub-header note rows (rows 2–4) beneath the column headers.
  // Columns with a notes array get their configured values;
  // columns without notes get '-' and are vertically merged into one cell.

  // Build the 3 rows but do NOT commit yet (mergeCells requires uncommitted rows).
  const noteRows = [];
  for (let r = 0; r < 3; r++) {
    const rowValues = resultConfig.columnHeaders.map((col) => {
      if (col.notes) {
        return col.notes[r];
      }
      // First note row gets the placeholder; rows 2-3 are empty (will be merged away).
      return r === 0 ? '-' : null;
    });
    noteRows.push(worksheet.addRow(rowValues));
  }

  // Merge rows 2–4 for every column that has no dedicated notes.
  resultConfig.columnHeaders.forEach((col, colIdx) => {
    if (!col.notes) {
      // mergeCells(topRow, leftCol, bottomRow, rightCol) — 1-based
      worksheet.mergeCells(2, colIdx + 1, 4, colIdx + 1);
    }
  });

  // Now commit all three note rows with a fixed 20px (15pt) height.
  for (const row of noteRows) {
    row.height = 15;
    row.alignment = { vertical: 'top' };
    row.commit();
  }

  return {
    worksheet,
    workbook,
    addRow(rowData) {
      worksheet.addRow(rowData).commit();
    },
    async finalize() {
      // Register the finish/error listeners BEFORE committing so we
      // never miss the event if the stream ends synchronously.
      const streamDone = new Promise((resolve, reject) => {
        passthrough.on('finish', resolve);
        passthrough.on('error', reject);
      });
      await worksheet.commit();
      await workbook.commit();
      await streamDone;
      return Buffer.concat(chunks);
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const {
    runId,
    batchNumber,
    targetDatabase,
    invoiceType = 'ca',
    processedOn = null,
    oracleConnectionConfig,
  } = workerData;

  if (!runId || !batchNumber) {
    postTransferable({ type: 'error', status: 400, error: 'runId and batchNumber are required query parameters.' });
    return;
  }

  if (!VALID_DATABASES.includes(targetDatabase)) {
    postTransferable({ type: 'error', status: 400, error: `targetDatabase must be one of: ${VALID_DATABASES.join(', ')}` });
    return;
  }

  const normalizedInvoiceType = normalizeInvoiceType(invoiceType);
  if (!VALID_INVOICE_TYPES.includes(normalizedInvoiceType)) {
    postTransferable({ type: 'error', status: 400, error: `invoiceType must be one of: ${VALID_INVOICE_TYPES.join(', ')}` });
    return;
  }

  const resultConfig = getResultConfig(normalizedInvoiceType);

  let connection;
  let rs; // Oracle ResultSet

  try {
    // Prefer the SQL query resolved by the parent (DB-first, file-fallback).
    // Only read from the file inside the worker as a last resort.
    let sqlQuery = workerData.sqlQuery;
    if (!sqlQuery) {
      const sqlPath = path.join(
        process.cwd(),
        `app/membership-admin/kpif-compare/queries/${resultConfig.sqlFile}`,
      );
      sqlQuery = fs.readFileSync(sqlPath, 'utf8');
    }

    connection = await oracledb.getConnection(oracleConnectionConfig);

    if (!connection) {
      postTransferable({ type: 'error', status: 503, error: 'Unable to connect to the database.' });
      return;
    }

    logMemoryUsage('afterOracleConnect', { runId, batchNumber });

    // ---- Phase 1: Stream rows from Oracle via ResultSet ----
    const result = await connection.execute(
      sqlQuery,
      { BATCH_NUMBER: batchNumber, RUN_ID: Number(runId), PROCESS_DATE: processedOn || null },
      {
        resultSet: true,
        outFormat: oracledb.OUT_FORMAT_ARRAY,
        fetchTypeHandler: (metaData) => {
          if (metaData.dbType === oracledb.DB_TYPE_NUMBER) {
            return { type: oracledb.STRING };
          }
        },
      },
    );
    rs = result.resultSet;
    const columnMapping = buildColumnMapping(resultConfig, result.metaData);

    let totalRows = 0;
    let currentPart = 1;
    let rowsInCurrentPart = 0;
    let excel = createStreamingWorkbook(resultConfig);

    // Consume rows in small batches from the ResultSet.
    let batch = await rs.getRows(FETCH_BATCH_SIZE);

    // No report should be generated for empty result sets.
    if (batch.length === 0) {
      // Discard the unused workbook.
      try { await excel.finalize(); } catch { /* ignore */ }
      postTransferable({ type: 'noData' });
      return;
    }

    while (batch.length > 0) {
      for (const row of batch) {
        excel.addRow(columnMapping.map(idx => row[idx]));
        rowsInCurrentPart++;
        totalRows++;

        // Memory telemetry at regular intervals.
        if (totalRows % MEMORY_LOG_INTERVAL === 0) {
          logMemoryUsage('rowProgress', { totalRows, currentPart, rowsInCurrentPart });
        }

        // ---- Part boundary: finalize current workbook, post it, start new one ----
        if (rowsInCurrentPart >= MAX_ROWS_PER_FILE) {
          const buf = await excel.finalize();
          logMemoryUsage('partFinalized', { currentPart, rowsInCurrentPart });

          postTransferable({
            type: 'part',
            partNumber: currentPart,
            arrayBuffer: buf.buffer,
            byteOffset: buf.byteOffset,
            byteLength: buf.byteLength,
          });

          currentPart++;
          rowsInCurrentPart = 0;
          excel = createStreamingWorkbook(resultConfig);
        }
      }

      batch = await rs.getRows(FETCH_BATCH_SIZE);
    }

    // ---- Finalize the last (or only) part ----
    const buf = await excel.finalize();
    logMemoryUsage('lastPartFinalized', { currentPart, rowsInCurrentPart, totalRows });

    if (currentPart === 1) {
      // Single file — backward-compatible message shape.
      const filename = buildFinalResultsFilename({
        runId,
        batchNumber,
        invoiceType: normalizedInvoiceType,
      });
      postTransferable({
        type: 'single',
        arrayBuffer: buf.buffer,
        byteOffset: buf.byteOffset,
        byteLength: buf.byteLength,
        filename,
        contentType: XLSX_CONTENT_TYPE,
      });
      postTransferable({ type: 'complete', totalParts: 1, totalRows });
    } else {
      // Last part of a multi-part set.
      postTransferable({
        type: 'part',
        partNumber: currentPart,
        arrayBuffer: buf.buffer,
        byteOffset: buf.byteOffset,
        byteLength: buf.byteLength,
      });
      postTransferable({ type: 'complete', totalParts: currentPart, totalRows });
    }
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'generateFinalResultsWorker',
        detail: {
          runId,
          batchNumber,
          targetDatabase,
          invoiceType: normalizeInvoiceType(invoiceType),
          error: error.message,
        },
      },
    }));

    postTransferable({ type: 'error', status: 500, error: 'Failed to generate download.', details: error.message });
  } finally {
    if (rs) {
      try { await rs.close(); } catch { /* ignore */ }
    }
    if (connection) {
      try { await connection.close(); } catch { /* ignore */ }
    }
    logMemoryUsage('workerCleanup');
  }
}

run();
