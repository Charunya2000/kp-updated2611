import path from 'node:path';
import { Worker } from 'node:worker_threads';

const RCNO_COLUMN_COUNT = 73;
const OUTBOUND_RCNA_COLUMN_COUNT = 76;
const WORKING_RCNA_COLUMN_COUNT = 78;
const RCNOA_FILE_DELIMITER = '|';
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const RCNO_TRANSFER_FILE_PATTERN = '^(?:TST_)?(?:PSHB|FEHB)_[A-Z0-9]{4}_RCNO_\\d{8}_\\d{8}_\\d{8}\\.txt\\.pgp$';
const RCNO_TRANSFER_FILE_PARTS = /^(TST_)?([^_]+)_([^_]+)_RCNO_(\d{8})_(\d{8})_\d{8}\.txt\.pgp$/;

// Built at runtime from process.cwd() (not import.meta.url) so this file resolves
// correctly whether it is loaded as plain ESM in production or transpiled to
// CommonJS by babel-jest under the test suite. See rcnoaTransformWorker.cjs for
// why the worker itself is CommonJS.
const RCNOA_TRANSFORM_WORKER_PATH = path.join(
  process.cwd(),
  'app',
  'services',
  'rcnoa',
  'rcnoaTransformWorker.cjs',
);

const DEFAULT_ROW_BLOCK_TIMEOUT_MS = 60_000;
const DEFAULT_PROGRESS_FLUSH_EVERY_ROWS = 10;
const DEFAULT_PROGRESS_FLUSH_EVERY_MS = 5_000;
const DEFAULT_MAX_BLOCKED_ROWS = 0;
const DEFAULT_MAX_BLOCKED_PERCENT = 0; // means zero tolerance — the run will immediately fail if any row times out (blocked > 0%), regardless of the maxBlockedRows threshold.

export const RCNOA_SCOPE = Object.freeze({
  teamName: 'reconciliation-notice-processing',
  assistantName: 'rcno-rcna-834',
});

export const RCNOA_DEFAULTS = Object.freeze({
  encoding: 'utf-8',
  inboundFilePattern: RCNO_TRANSFER_FILE_PATTERN,
  maxUploadBytes: MAX_UPLOAD_BYTES,
  sasExpiryMinutes: 15,
  timeZone: 'America/Los_Angeles',
});

const REQUIRED_PROCESSING_PROPERTIES = Object.freeze([
  'RCNOA_EPDS_JDBC_URL',
  'RCNOA_EPDS_USERNAME',
  'RCNOA_EPDS_PASSWORD',
  'RCNOA_MDW_JDBC_URL',
  'RCNOA_MDW_USERNAME',
  'RCNOA_MDW_PASSWORD',
]);

const REQUIRED_SCHEDULED_PROPERTIES = Object.freeze([
  'RCNOA_REMOTE_SERVER',
  'RCNOA_REMOTE_FOLDER',
  'RCNOA_USERNAME',
  'RCNOA_PASSWORD',
  'RCNOA_SFTP_HOST_KEY_SHA256',
  'RCNOA_SCHEDULER_TOKEN',
]);

function normalizedText(value) {
  return String(value ?? '').trim();
}

function sanitizeErrorMessage(error) {
  const message = normalizedText(error?.message) || 'RCNO row processing failed';
  return message
    .replace(/\b\d{9}\b/g, '[REDACTED]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500);
}

export function assertRcnoaScope(teamName, assistantName) {
  if (teamName !== RCNOA_SCOPE.teamName || assistantName !== RCNOA_SCOPE.assistantName) {
    const error = new Error('RCNOA route scope not found');
    error.code = 'RCNOA_SCOPE_NOT_FOUND';
    throw error;
  }
}

export function sanitizeFileName(fileName) {
  const value = normalizedText(fileName);
  if (!value || value === '.' || value === '..' || value.length > 180) {
    throw new Error('A valid file name is required');
  }
  if (value.includes('/') || value.includes('\\') || value.includes('..')) {
    throw new Error('File name cannot contain path segments');
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._ -]*$/.test(value)) {
    throw new Error('File name contains unsupported characters');
  }
  return value;
}

export function buildRcnaFileName(inputFileName, transferDate) {
  const safeInputFileName = sanitizeFileName(inputFileName);
  const match = safeInputFileName.match(RCNO_TRANSFER_FILE_PARTS);
  if (!match) {
    const base = safeInputFileName.replace(/\.[^.]+$/, '');
    return `${base}.rcna.txt`;
  }

  const [, testPrefix = '', programId, carrierId, reportingStart, reportingEnd] = match;
  return `${testPrefix}${programId}_${carrierId}_RCNA_${reportingStart}_${reportingEnd}_${transferDate}.txt.pgp`;
}

export function buildRcnoaCompanionFileName(inputFileName, suffix, extension) {
  const base = sanitizeFileName(inputFileName)
    .replace(/\.txt\.pgp$/, '')
    .replace(/\.[^.]+$/, '');
  return `${base}.${suffix}.${extension}`;
}

export function buildRcnoaBlobName({ mode, nuid, runId, direction, fileName }) {
  if (!['scheduled', 'adhoc'].includes(mode)) {
    throw new Error('RCNOA mode must be scheduled or adhoc');
  }
  if (!['input', 'output'].includes(direction)) {
    throw new Error('RCNOA artifact direction must be input or output');
  }

  const normalizedRunId = normalizedText(runId);
  if (!/^[0-9a-f-]{36}$/i.test(normalizedRunId)) {
    throw new Error('A valid run ID is required');
  }

  const parts = ['rcnoa-processing', mode];
  if (mode === 'adhoc') {
    const owner = normalizedText(nuid).toUpperCase();
    if (!/^[A-Z0-9_-]{1,32}$/.test(owner)) {
      throw new Error('A valid owner NUID is required for ad hoc artifacts');
    }
    parts.push(owner);
  }
  parts.push(normalizedRunId, direction, sanitizeFileName(fileName));
  return parts.join('/');
}

// Record_Type (RCNO column 1) value of the data rows that RCNOA processes.
// Files carry it as `1` or `01` (and the other row type as `2` or `02`), so
// values are compared after trimming and removing leading zeroes.
export const RCNO_DATA_RECORD_TYPE = '01';

function normalizeRecordType(value) {
  return String(value ?? '').trim().replace(/^0+(?=.)/, '');
}

// When keepRecordType is supplied, rows whose Record_Type differs are ignored
// before the column-count check, so an ignored row of any width never fails
// the file. Without it every row is parsed and validated.
export function parseRcnoText(text, {
  ignoreFirstColumn = false,
  ignoreLastColumn = false,
  keepRecordType = null,
} = {}) {
  if (typeof text !== 'string') {
    throw new TypeError('RCNO file content must be text');
  }
  if (text.includes('\u0000')) {
    throw new Error('RCNO file contains null bytes');
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (!lines.length) {
    throw new Error('RCNO file does not contain data rows');
  }

  const start = ignoreFirstColumn ? 1 : 0;
  const keepType = keepRecordType === null ? null : normalizeRecordType(keepRecordType);
  const expectedColumnCount = RCNO_COLUMN_COUNT
    + (ignoreFirstColumn ? 1 : 0)
    + (ignoreLastColumn ? 1 : 0);
  const records = [];
  lines.forEach((line, index) => {
    const record = line.split(RCNOA_FILE_DELIMITER);
    if (keepType !== null && normalizeRecordType(record[start]) !== keepType) {
      return;
    }
    if (record.length !== expectedColumnCount) {
      throw new Error(`RCNO row ${index + 1} must contain exactly ${expectedColumnCount} columns`);
    }
    const end = ignoreLastColumn ? record.length - 1 : record.length;
    records.push(record.slice(start, end));
  });

  if (keepRecordType !== null && !records.length) {
    throw new Error(`RCNO file does not contain any Record_Type ${keepRecordType} rows`);
  }
  return records;
}

export function parseRcnaText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('RCNA file content must be text');
  }
  if (text.includes('\u0000')) {
    throw new Error('RCNA file contains null bytes');
  }

  const lines = text.split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (!lines.length) throw new Error('RCNA file does not contain data rows');

  return lines.map((line, index) => {
    const record = line.split(RCNOA_FILE_DELIMITER);
    if (![OUTBOUND_RCNA_COLUMN_COUNT, WORKING_RCNA_COLUMN_COUNT].includes(record.length)) {
      throw new Error(
        `RCNA row ${index + 1} must contain exactly ${OUTBOUND_RCNA_COLUMN_COUNT} or ${WORKING_RCNA_COLUMN_COUNT} columns`,
      );
    }
    return record.length === OUTBOUND_RCNA_COLUMN_COUNT ? [...record, '', ''] : record;
  });
}

export function validateReconciliationCycle(value) {
  const reconciliationCycle = normalizedText(value);
  if (!/^\d{6}$/.test(reconciliationCycle)) {
    throw new Error('Reconciliation cycle must use YYYYMM format');
  }
  const month = Number(reconciliationCycle.slice(4));
  if (month < 1 || month > 12) {
    throw new Error('Reconciliation cycle must contain a valid month');
  }
  return reconciliationCycle;
}

export function prepareUploadedRcnaPriorRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Uploaded RCNA must contain at least one record');
  }
  return records.map((record, index) => {
    if (!Array.isArray(record) || record.length !== WORKING_RCNA_COLUMN_COUNT) {
      throw new Error(`Uploaded RCNA row ${index + 1} must contain exactly ${WORKING_RCNA_COLUMN_COUNT} working columns`);
    }
    if ([73, 74, 75].some((column) => normalizedText(record[column]) === '')) {
      throw new Error(`Uploaded RCNA row ${index + 1} must contain priority, PSHB code, and description`);
    }
    const agingMonths = normalizedText(record[77]);
    if (agingMonths !== '' && !/^\d+$/.test(agingMonths)) {
      throw new Error(`Uploaded RCNA row ${index + 1} Aging Months must be a nonnegative integer`);
    }
    return [...record.slice(0, 77), agingMonths || '0'];
  });
}

export function serializeRcnoaRecords(records) {
  if (!Array.isArray(records)) {
    throw new TypeError('RCNOA records must be an array');
  }
  return records.map((record, index) => {
    if (!Array.isArray(record)) {
      throw new TypeError(`RCNOA row ${index + 1} must be an array`);
    }
    if (record.some((value) => String(value ?? '').includes(RCNOA_FILE_DELIMITER))) {
      throw new Error(`RCNOA row ${index + 1} contains the pipe delimiter`);
    }
    return record.map((value) => String(value ?? '')).join(RCNOA_FILE_DELIMITER);
  }).join('\r\n') + '\r\n';
}

export function selectRcnaRecordsFor834(workingRecords) {
  if (!Array.isArray(workingRecords)) {
    throw new TypeError('working RCNA records must be an array');
  }
  return workingRecords.filter((record) => {
    if (!Array.isArray(record)) return false;
    const discrepancyFamily = String(record[3] ?? '').trim().toUpperCase();
    const description = String(record[75] ?? '').trim();
    return ['F', 'I', 'N'].includes(discrepancyFamily) && /^Carrier to\b/i.test(description);
  });
}

export function transformRcnoRowsIsolated({
  rcnoRecords,
  transformer,
  membershipRecords = [],
  recent834Records = [],
  priorRcnaRecords = [],
}) {
  if (!Array.isArray(rcnoRecords) || !transformer || typeof transformer.transform !== 'function') {
    throw new TypeError('RCNO records and transformer are required');
  }

  const workingRecords = [];
  const outboundRecords = [];
  const audit = [];
  const failures = [];

  rcnoRecords.forEach((record, index) => {
    try {
      const result = transformer.transform({
        rcnoRecords: [record],
        membershipRecords,
        recent834Records,
        priorRcnaRecords,
      });
      workingRecords.push(...result.workingRecords);
      outboundRecords.push(...result.outboundRecords);
      audit.push(...result.audit.map((item) => ({ ...item, sourceRow: index + 1 })));
    } catch (error) {
      failures.push({
        sourceRowNumber: index + 1,
        status: 'ERROR',
        errorCode: error?.code || 'RCNO_ROW_TRANSFORM_FAILED',
        message: sanitizeErrorMessage(error),
        retryable: false,
      });
    }
  });

  return { workingRecords, outboundRecords, audit, failures };
}

export async function transformRcnoRowsIsolatedInBatches({
  rcnoRecords,
  transformer,
  membershipRecords = [],
  recent834Records = [],
  priorRcnaRecords = [],
  batchSize = 100,
  onProgress,
}) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new TypeError('batchSize must be a positive integer');
  }
  if (onProgress && typeof onProgress !== 'function') {
    throw new TypeError('onProgress must be a function');
  }

  const transformed = { workingRecords: [], outboundRecords: [], audit: [], failures: [] };
  for (let offset = 0; offset < rcnoRecords.length; offset += batchSize) {
    const batch = transformRcnoRowsIsolated({
      rcnoRecords: rcnoRecords.slice(offset, offset + batchSize),
      transformer,
      membershipRecords,
      recent834Records,
      priorRcnaRecords,
    });
    transformed.workingRecords.push(...batch.workingRecords);
    transformed.outboundRecords.push(...batch.outboundRecords);
    transformed.audit.push(...batch.audit.map((item) => ({
      ...item,
      sourceRow: item.sourceRow + offset,
    })));
    transformed.failures.push(...batch.failures.map((item) => ({
      ...item,
      sourceRowNumber: item.sourceRowNumber + offset,
    })));
    if (onProgress) {
      await onProgress({
        received: rcnoRecords.length,
        processed: Math.min(offset + batchSize, rcnoRecords.length),
        succeeded: transformed.workingRecords.length,
        failed: transformed.failures.length,
      });
    }
  }
  return transformed;
}

function createRcnoaTransformWorker(workerData) {
  return new Worker(RCNOA_TRANSFORM_WORKER_PATH, { workerData });
}

function waitForWorkerReady(worker) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
    }
    function onMessage(message) {
      if (!message || (message.type !== 'ready' && message.type !== 'init-error')) return;
      cleanup();
      if (message.type === 'init-error') {
        const error = new Error(message.message);
        error.code = message.errorCode || 'RCNOA_REFERENCE_DATA_INVALID';
        reject(error);
        return;
      }
      resolve();
    }
    function onError(error) {
      cleanup();
      reject(error);
    }
    function onExit(code) {
      cleanup();
      reject(new Error(`RCNOA transform worker exited before it was ready (code ${code})`));
    }
    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.on('exit', onExit);
  });
}

// Sends one row to the worker and resolves once that row's result arrives, or once
// rowBlockTimeoutMs elapses without a response. A timeout does NOT reject -- it
// resolves with a 'row-blocked' marker so the caller can record the blocked row and
// respawn the worker, rather than letting one hung row stall the entire run.
function runRowOnWorker(worker, rcnoRecord, sourceRowNumber, rowBlockTimeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.off('message', onMessage);
      worker.off('error', onWorkerError);
      worker.off('exit', onWorkerExit);
      resolve(result);
    }
    const timer = setTimeout(() => finish({ type: 'row-blocked' }), rowBlockTimeoutMs);
    function onMessage(message) {
      if (!message || message.sourceRowNumber !== sourceRowNumber) return;
      if (message.type === 'row-success' || message.type === 'row-failure') finish(message);
    }
    function onWorkerError() {
      finish({ type: 'row-blocked' });
    }
    function onWorkerExit() {
      finish({ type: 'row-blocked' });
    }
    worker.on('message', onMessage);
    worker.once('error', onWorkerError);
    worker.once('exit', onWorkerExit);
    worker.postMessage({ type: 'transform-row', rcnoRecord, sourceRowNumber });
  });
}

// Logs only the source row number and elapsed time -- deliberately no row/member
// data -- when a row transformation fails to complete within rowBlockTimeoutMs.
function logRcnoaRowBlocked({ runId, sourceRowNumber, elapsedMs }) {
  console.error(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'rcnoaRowTransformBlocked',
      detail: {
        runId: runId || null, sourceRowNumber, elapsedMs, stage: 'TRANSFORMING',
      },
    },
  }));
}

// Transforms RCNO rows one at a time on a single long-lived worker thread instead
// of synchronously on the main thread. This isolates each row so that a single
// pathologically slow/hung row (which cannot be caught by a try/catch on the main
// thread) is detected via a per-row timeout, recorded as a "blocked" row, and the
// run continues -- instead of the whole batch stalling until the run-level
// heartbeat timeout eventually fires. Reference data (membership/recent834/
// priorRcna) is normalized and indexed exactly once inside the worker via
// RcnoToRcnaService.prepareReferenceData(), removing the per-row re-normalization
// that previously caused GC pressure on large recordsets.
export async function transformRcnoRowsWithWorkerIsolation({
  rcnoRecords,
  transformerOptions = {},
  membershipRecords = [],
  recent834Records = [],
  priorRcnaRecords = [],
  onProgress,
  runId = null,
  rowBlockTimeoutMs = DEFAULT_ROW_BLOCK_TIMEOUT_MS,
  progressFlushEveryRows = DEFAULT_PROGRESS_FLUSH_EVERY_ROWS,
  progressFlushEveryMs = DEFAULT_PROGRESS_FLUSH_EVERY_MS,
  maxBlockedRows = DEFAULT_MAX_BLOCKED_ROWS,
  maxBlockedPercent = DEFAULT_MAX_BLOCKED_PERCENT,
} = {}) {
  if (!Array.isArray(rcnoRecords)) {
    throw new TypeError('rcnoRecords must be an array');
  }
  if (onProgress && typeof onProgress !== 'function') {
    throw new TypeError('onProgress must be a function');
  }
  if (!Number.isInteger(rowBlockTimeoutMs) || rowBlockTimeoutMs < 1) {
    throw new TypeError('rowBlockTimeoutMs must be a positive integer');
  }

  const transformed = {
    workingRecords: [], outboundRecords: [], audit: [], failures: [], blockedRows: [],
  };

  const flushProgress = async (processed) => {
    if (!onProgress) return;
    await onProgress({
      received: rcnoRecords.length,
      processed,
      succeeded: transformed.workingRecords.length,
      failed: transformed.failures.length,
      blocked: transformed.blockedRows.length,
    });
  };

  if (rcnoRecords.length === 0) {
    await flushProgress(0);
    return transformed;
  }

  const workerData = {
    transformerOptions, membershipRecords, recent834Records, priorRcnaRecords,
  };

  let worker = createRcnoaTransformWorker(workerData);
  try {
    await waitForWorkerReady(worker);
  } catch (error) {
    await worker.terminate();
    throw error;
  }

  let lastFlushAt = Date.now();
  let lastFlushProcessed = 0;

  try {
    for (let index = 0; index < rcnoRecords.length; index += 1) {
      const sourceRowNumber = index + 1;
      const rowStartedAt = Date.now();
      // eslint-disable-next-line no-await-in-loop -- rows must be isolated sequentially
      const rowResult = await runRowOnWorker(
        worker,
        rcnoRecords[index],
        sourceRowNumber,
        rowBlockTimeoutMs,
      );
      const processed = sourceRowNumber;

      if (rowResult.type === 'row-success') {
        transformed.workingRecords.push(rowResult.workingRecord);
        transformed.outboundRecords.push(rowResult.outboundRecord);
        transformed.audit.push(rowResult.audit);
      } else if (rowResult.type === 'row-failure') {
        transformed.failures.push({
          sourceRowNumber,
          status: 'ERROR',
          errorCode: rowResult.errorCode || 'RCNO_ROW_TRANSFORM_FAILED',
          message: rowResult.message,
          retryable: false,
        });
      } else {
        const elapsedMs = Date.now() - rowStartedAt;
        logRcnoaRowBlocked({ runId, sourceRowNumber, elapsedMs });
        transformed.blockedRows.push({
          sourceRowNumber,
          status: 'BLOCKED',
          errorCode: 'RCNO_ROW_TRANSFORM_BLOCKED',
          message: `Row transform did not complete within ${rowBlockTimeoutMs}ms during TRANSFORMING`,
          retryable: true,
        });
        // eslint-disable-next-line no-await-in-loop -- must respawn before the next row
        await worker.terminate();
        worker = createRcnoaTransformWorker(workerData);
        // eslint-disable-next-line no-await-in-loop -- must be ready before the next row
        await waitForWorkerReady(worker);
      }

      const blockedCount = transformed.blockedRows.length;
      const blockedPercent = (blockedCount / rcnoRecords.length) * 100;
      if (blockedCount > maxBlockedRows || blockedPercent > maxBlockedPercent) {
        const error = new Error(
          `RCNOA transform aborted: ${blockedCount} of ${rcnoRecords.length} rows blocked during TRANSFORMING`,
        );
        error.code = 'RCNOA_TOO_MANY_BLOCKED_ROWS';
        throw error;
      }

      const now = Date.now();
      const isLastRow = processed === rcnoRecords.length;
      const dueByCount = processed - lastFlushProcessed >= progressFlushEveryRows;
      const dueByTime = now - lastFlushAt >= progressFlushEveryMs;
      if (dueByCount || dueByTime || isLastRow) {
        lastFlushAt = now;
        lastFlushProcessed = processed;
        // eslint-disable-next-line no-await-in-loop -- progress must be flushed in row order
        await flushProgress(processed);
      }
    }
  } finally {
    await worker.terminate();
  }

  return transformed;
}

function businessConfigurationFromEnvironment(environment) {
  const jsonValue = (name) => {
    try {
      return JSON.parse(environment[name]);
    } catch {
      return null;
    }
  };
  return {
    envelope: jsonValue('RCNOA_834_ENVELOPE_JSON'),
    intentByCode: jsonValue('RCNOA_834_INTENT_BY_CODE_JSON'),
    relationshipMap: jsonValue('RCNOA_834_RELATIONSHIP_MAP_JSON'),
    addressLine3Mode: environment.RCNOA_ADDRESS_LINE3_MODE,
    priorRcnaMatchKeySecret: environment.RCNOA_PRIOR_RCNA_MATCH_KEY_SECRET,
    mappingApproved: environment.RCNOA_834_MAPPING_APPROVED === 'true',
    skip834Creation: environment.RCNOA_SKIP_834_CREATION === 'true',
  };
}

export function getRcnoaProductionReadiness(
  environment = process.env,
  { mode = 'all', businessConfiguration, require834 = true } = {},
) {
  if (!['all', 'adhoc', 'adhoc-mock', 'scheduled'].includes(mode)) {
    throw new Error('RCNOA readiness mode must be all, adhoc, adhoc-mock, or scheduled');
  }
  const requiredProperties = mode === 'adhoc-mock'
    ? []
    : mode === 'adhoc'
      ? REQUIRED_PROCESSING_PROPERTIES
      : [...REQUIRED_PROCESSING_PROPERTIES, ...REQUIRED_SCHEDULED_PROPERTIES];
  const missing = requiredProperties.filter((name) => !normalizedText(environment[name]));
  const invalid = [];
  const configuration = businessConfiguration || businessConfigurationFromEnvironment(environment);
  if (require834 && !configuration?.skip834Creation) {
    const configuredObjects = [
      ['RCNOA_834_ENVELOPE_JSON', configuration?.envelope],
      ['RCNOA_834_INTENT_BY_CODE_JSON', configuration?.intentByCode],
      ['RCNOA_834_RELATIONSHIP_MAP_JSON', configuration?.relationshipMap],
    ];
    configuredObjects.forEach(([name, value]) => {
      if (!value) missing.push(name);
      else if (typeof value !== 'object' || Array.isArray(value)) invalid.push(name);
    });
    if (!normalizedText(configuration?.addressLine3Mode)) {
      missing.push('RCNOA_ADDRESS_LINE3_MODE');
    } else if (!['append-to-line2', 'reject'].includes(configuration.addressLine3Mode)) {
      invalid.push('RCNOA_ADDRESS_LINE3_MODE');
    }
  }
  if (mode !== 'adhoc-mock' && !normalizedText(configuration?.priorRcnaMatchKeySecret)) {
    missing.push('RCNOA_PRIOR_RCNA_MATCH_KEY_SECRET');
  }

  const pendingContracts = [
    ...(!require834 || configuration?.mappingApproved || configuration?.skip834Creation
      ? []
      : ['RCNOA_834_MAPPING_APPROVED']),
    ...(['adhoc', 'adhoc-mock'].includes(mode) ? [] : ['RCNOA_SCHEDULER_AUTH_APPROVED']),
  ].filter((name) => name !== 'RCNOA_SCHEDULER_AUTH_APPROVED' || environment[name] !== 'true');

  return {
    ready: missing.length === 0 && invalid.length === 0 && pendingContracts.length === 0,
    missing,
    invalid,
    pendingContracts,
  };
}

export function validate834Content(content) {
  const text = Buffer.isBuffer(content) ? content.toString('utf-8') : String(content || '');
  if (!text || text.includes('\u0000') || !text.startsWith('ISA') || text.length < 4) {
    throw new Error('Uploaded file is not a valid X12 interchange');
  }
  const elementSeparator = text[3];
  if (!text.includes(`ST${elementSeparator}834${elementSeparator}`)) {
    throw new Error('Uploaded X12 interchange does not contain an 834 transaction');
  }
  return text;
}