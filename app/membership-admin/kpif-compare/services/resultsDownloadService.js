import path from 'path';
import { Worker } from 'worker_threads';
import { getOracleConnectionConfig } from '@/app/services/oracleService';
import { KPIF_TARGET_DATABASES } from '../config/targetDatabases';
import { KPIF_DATABASE_TO_ACCOUNT } from '../config/targetDatabasesServer';
import { DEFAULT_RESULT_CONFIG_BY_INVOICE_TYPE } from '../config/defaultResultConfig';
import { getKpifCompareResultConfig } from '@/app/services/kpifCompareResultConfigService';
import { resolveQuery } from '@/app/services/kpifQueryService';

export const VALID_DATABASES = KPIF_TARGET_DATABASES;
export const VALID_INVOICE_TYPES = ['ca', 'moc'];

function normalizeInvoiceType(invoiceType = 'ca') {
  return String(invoiceType || 'ca').toLowerCase();
}

async function getResultConfig(invoiceType) {
  const normalized = normalizeInvoiceType(invoiceType);
  try {
    const doc = await getKpifCompareResultConfig();
    if (doc?.[normalized]) {
      return doc[normalized];
    }
  } catch (err) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getResultConfig',
        detail: { invoiceType: normalized, error: err.message },
      },
    }));
  }
  return DEFAULT_RESULT_CONFIG_BY_INVOICE_TYPE[normalized];
}

export async function buildFinalResultsFilename({ runId, batchNumber, invoiceType = 'ca', partNumber }) {
  const config = await getResultConfig(invoiceType);
  const label = config?.filenameLabel || 'Non-Consolidated';
  const partSuffix = partNumber ? ` Part-${partNumber}` : '';
  return `IPB0001 Run-${runId} ${label} Results Batch-${batchNumber}${partSuffix}.xlsx`;
}

/**
 * Generate the final-results Excel file(s) inside a Worker Thread so the
 * CPU-intensive ExcelJS work does not block the main event loop.
 *
 * The worker streams rows from Oracle and posts incremental messages.
 * Each completed part buffer is delivered via the `onPart` callback so
 * the caller can upload (and release) it immediately instead of
 * accumulating all parts in memory.
 *
 * @param {object} params
 * @param {string|number} params.runId
 * @param {string|number} params.batchNumber
 * @param {string} params.targetDatabase
 * @param {string} [params.invoiceType='ca']
 * @param {string|null} [params.processedOn=null] - YYYY-MM-DD date for PROCESS_DATE column
 * @param {function} [params.onPart] - async ({ partNumber, buffer }) => void
 * @returns {Promise<{ status, totalParts?, totalRows?, error?, details?, noData?, buffer?, filename?, contentType? }>}
 */
export async function generateFinalResultsInWorker({ runId, batchNumber, targetDatabase, invoiceType = 'ca', processedOn = null, onPart }) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'generateFinalResultsInWorker',
      detail: { runId, batchNumber, targetDatabase, invoiceType, processedOn },
    },
  }));

  if (!VALID_DATABASES.includes(targetDatabase)) {
    return { status: 400, error: `targetDatabase must be one of: ${VALID_DATABASES.join(', ')}` };
  }
  const account = KPIF_DATABASE_TO_ACCOUNT[targetDatabase];

  const normalizedInvoiceType = normalizeInvoiceType(invoiceType);
  if (!VALID_INVOICE_TYPES.includes(normalizedInvoiceType)) {
    return { status: 400, error: `invoiceType must be one of: ${VALID_INVOICE_TYPES.join(', ')}` };
  }

  const savedResultConfig = await getResultConfig(normalizedInvoiceType);

  // Resolve the SQL query from MongoDB (if overridden) or file.
  const sqlFileKey = (savedResultConfig.sqlFile || '').replace(/\.sql$/, '');
  const resolvedSqlQuery = await resolveQuery(sqlFileKey);

  const oracleConnectionConfig = getOracleConnectionConfig(account);

  const workerPath = path.join(
    process.cwd(),
    'app/membership-admin/kpif-compare/services/resultsDownloadWorker.mjs',
  );

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'generateFinalResultsInWorker',
      detail: { workerPath, runId, batchNumber, targetDatabase, invoiceType, processedOn },
    },
  }));

  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: {
        runId,
        batchNumber,
        targetDatabase,
        invoiceType: normalizedInvoiceType,
        processedOn,
        oracleConnectionConfig,
        resultConfig: savedResultConfig,
        sqlQuery: resolvedSqlQuery,
      },
      resourceLimits: {
        maxOldGenerationSizeMb: 1200,
      },
    });

    let settled = false;

    // Queue for serializing async onPart calls so we process one at a time.
    let partChain = Promise.resolve();

    worker.on('message', (msg) => {
      if (settled) return;

      switch (msg.type) {
        case 'part': {
          const buffer = Buffer.from(
            msg.arrayBuffer,
            msg.byteOffset || 0,
            msg.byteLength || msg.arrayBuffer.byteLength,
          );
          if (onPart) {
            partChain = partChain
              .then(() => onPart({ partNumber: msg.partNumber, buffer }))
              .catch((err) => {
                if (!settled) {
                  settled = true;
                  worker.terminate();
                  resolve({ status: 500, error: 'Failed to process part.', details: err.message });
                }
              });
          }
          break;
        }

        case 'single': {
          const buffer = Buffer.from(
            msg.arrayBuffer,
            msg.byteOffset || 0,
            msg.byteLength || msg.arrayBuffer.byteLength,
          );
          if (onPart) {
            partChain = partChain
              .then(() => onPart({ partNumber: 1, buffer }))
              .catch((err) => {
                if (!settled) {
                  settled = true;
                  worker.terminate();
                  resolve({ status: 500, error: 'Failed to process part.', details: err.message });
                }
              });
          } else {
            // Backward-compatible: return buffer directly when no onPart callback.
            partChain = partChain.then(() => {
              if (!settled) {
                settled = true;
                resolve({
                  status: 200,
                  buffer,
                  filename: msg.filename,
                  contentType: msg.contentType,
                });
              }
            });
          }
          break;
        }

        case 'complete': {
          partChain.then(() => {
            if (!settled) {
              settled = true;
              resolve({
                status: 200,
                totalParts: msg.totalParts,
                totalRows: msg.totalRows,
              });
            }
          });
          break;
        }

        case 'noData': {
          if (!settled) {
            settled = true;
            resolve({ status: 204, noData: true, totalRows: 0 });
          }
          break;
        }

        case 'error': {
          if (!settled) {
            settled = true;
            resolve({ status: msg.status || 500, error: msg.error, details: msg.details });
          }
          break;
        }

        default:
          break;
      }
    });

    worker.on('error', (err) => {
      if (settled) return;
      settled = true;

      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'generateFinalResultsWorker',
          detail: { runId, batchNumber, targetDatabase, invoiceType: normalizedInvoiceType, error: err.message },
        },
      }));

      resolve({ status: 500, error: 'Failed to generate download.', details: err.message });
    });

    worker.on('exit', (code) => {
      if (settled) return;
      // The worker has exited, but async onPart uploads (partChain) may
      // still be in flight.  Wait for them to finish before deciding that
      // the worker failed to produce results.
      partChain.then(() => {
        if (settled) return;
        settled = true;
        console.error(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'generateFinalResultsWorker',
            detail: {
              runId,
              batchNumber,
              targetDatabase,
              invoiceType: normalizedInvoiceType,
              error: `Worker exited with code ${code} without producing results`,
            },
          },
        }));

        resolve({
          status: 500,
          error: 'Failed to generate download.',
          details: `Worker exited with code ${code} without producing results.`,
        });
      });
    });
  });
}
