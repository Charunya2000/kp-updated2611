// RCNOA row-transform worker.
//
// This file is intentionally CommonJS (not ESM) and is loaded by Node directly at
// runtime via `new Worker(path.join(process.cwd(), ...))` from rcnoaCore.js -- the
// same pattern already used by ediWorkbenchValidationWorker.cjs in this codebase --
// so it avoids the `new Worker(new URL('./file', import.meta.url))` shape that
// Turbopack/webpack special-case and try to bundle as a separate chunk.
//
// RcnoToRcnaService and rcnoaAddressService are ESM modules, so they are loaded
// here via dynamic import() (which CommonJS files can call) rather than require().
//
// Lifecycle:
//   1. Reference data (membershipRecords/recent834Records/priorRcnaRecords) and
//      transformerOptions are supplied once via `workerData` when the worker is
//      constructed.
//   2. On startup this worker prepares the reference data exactly once
//      (RcnoToRcnaService.prepareReferenceData) and posts back either
//      { type: 'ready' } or { type: 'init-error', errorCode, message }.
//   3. For each row, the coordinator posts { type: 'transform-row', rcnoRecord,
//      sourceRowNumber }; this worker replies with row-success or row-failure.
//      Ordinary thrown errors (bad data, validation failures) become row-failure
//      messages -- they do not crash the worker.
const { parentPort, workerData } = require('worker_threads');

function sanitizeErrorMessage(error) {
  const message = String((error && error.message) || 'RCNO row processing failed').trim()
    || 'RCNO row processing failed';
  // Never forward row/member data in log-adjacent error text -- strip anything
  // that looks like a 9-digit identifier (SSN) and collapse newlines.
  return message
    .replace(/\b\d{9}\b/g, '[REDACTED]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500);
}

async function initialize() {
  const { RcnoToRcnaService } = await import('./RcnoToRcnaService.js');
  const { normalizeRcnoaAddress } = await import('./rcnoaAddressService.js');
  const {
    transformerOptions = {},
    membershipRecords = [],
    recent834Records = [],
    priorRcnaRecords = [],
  } = workerData || {};

  const service = new RcnoToRcnaService({
    ...transformerOptions,
    addressNormalizer: normalizeRcnoaAddress,
  });
  const prepared = RcnoToRcnaService.prepareReferenceData({
    membershipRecords,
    recent834Records,
    priorRcnaRecords,
    validateLookupDuplicates: service.validateLookupDuplicates,
  });
  return { service, prepared };
}

const readyPromise = initialize()
  .then((ready) => {
    parentPort.postMessage({ type: 'ready' });
    return ready;
  })
  .catch((error) => {
    parentPort.postMessage({
      type: 'init-error',
      errorCode: (error && error.code) || 'RCNOA_REFERENCE_DATA_INVALID',
      message: sanitizeErrorMessage(error),
    });
    return null;
  });

parentPort.on('message', async (message) => {
  if (!message || message.type !== 'transform-row') return;
  const { rcnoRecord, sourceRowNumber } = message;

  const ready = await readyPromise;
  if (!ready) return; // Initialization failed; the coordinator will not send rows in that case.

  const { service, prepared } = ready;
  try {
    const { workingRecord, outboundRecord, audit } = service.transformOne({
      rcnoRecord,
      prepared,
      sourceRowNumber,
    });
    parentPort.postMessage({
      type: 'row-success', sourceRowNumber, workingRecord, outboundRecord, audit,
    });
  } catch (error) {
    parentPort.postMessage({
      type: 'row-failure',
      sourceRowNumber,
      errorCode: (error && error.code) || 'RCNO_ROW_TRANSFORM_FAILED',
      message: sanitizeErrorMessage(error),
    });
  }
});
