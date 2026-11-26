const { parentPort, workerData } = require('node:worker_threads');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  getRuntimeTelemetry,
  progressTelemetry,
  sanitizeSensitiveMetadata,
  shouldSampleSubscriberTelemetry,
} = require('./ediWorkbenchWorkerTelemetry.cjs');

const TELEMETRY_SUBSCRIBER_INTERVAL = 100;

function extractSubscriberProgress(details) {
  const rawEvent = details?.subscriberProgress;
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  return {
    eventType: rawEvent['event-type'] || null,
    runId: rawEvent['run-id'] || null,
    subscriberIndex: rawEvent['subscriber-index'] ?? null,
    subscriberSsn: rawEvent['subscriber-ssn'] || '',
    subscriberKey: rawEvent['subscriber-key'] || null,
    status: rawEvent.status || null,
    processedSubscribers: rawEvent['processed-subscribers'] ?? null,
    totalSubscribers: rawEvent['total-subscribers'] ?? null,
    percentComplete: rawEvent['percent-complete'] ?? null,
    elapsedMs: rawEvent['elapsed-ms'] ?? null,
    startedAt: rawEvent['started-at'] || null,
    completedAt: rawEvent['completed-at'] || null,
    structure: rawEvent.structure && typeof rawEvent.structure === 'object'
      ? rawEvent.structure
      : null,
    db: rawEvent.db && typeof rawEvent.db === 'object'
      ? rawEvent.db
      : null,
  };
}

async function runValidationJob() {
  const startTimeMs = Date.now();
  const startCpuUsage = process.cpuUsage();
  let lastSampledSubscriberCount = 0;
  parentPort?.postMessage({
    type: 'telemetry',
    runId: workerData.runId,
    samplePhase: 'validation-start',
    metrics: getRuntimeTelemetry(startTimeMs, startCpuUsage),
  });

  try {
    const serviceUrl = pathToFileURL(path.join(process.cwd(), 'app', 'services', 'ediWorkbenchService.js')).href;
    // Load the service via a NATIVE runtime import. Next's dev instrumentation compiles this
    // worker through Turbopack (and webpack in prod builds); without the ignore comments the
    // bundler cannot resolve this dynamic specifier and replaces it with a "Cannot find module
    // as expression is too dynamic" stub that throws. The comments force a plain Node import so
    // the source module (and its bundler-invisible efss ClojureScript require) loads correctly.
    const { buildCompactEdiWorkbenchWorkerResult, parseAndEnrichEdiFromBlob } = await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ serviceUrl
    );

    const result = await parseAndEnrichEdiFromBlob({
      ediContainer: workerData.edi.container,
      ediBlobName: workerData.edi.blobName,
      companionContainer: workerData.companion.container,
      companionBlobName: workerData.companion.blobName,
      editableGuide: workerData.editableGuide || null,
      template: workerData.template || null,
      runConfig: workerData.runConfig || null,
      validationScope: workerData.validationScope || null,
      parseOptions: workerData.parseOptions || null,
      onTempFile: (filePath) => {
        parentPort?.postMessage({
          type: 'validation-temp-file',
          runId: workerData.runId,
          filePath,
        });
      },
      onFindingBatch: (findings) => {
        parentPort?.postMessage({
          type: 'validation-finding-batch',
          runId: workerData.runId,
          findings,
        });
      },
      onProgress: ({ overallJobPercent, step, details }) => {
        const subscriberProgress = extractSubscriberProgress(details);
        const isaProgress = details?.isaProgress && typeof details.isaProgress === 'object'
          ? details.isaProgress
          : null;
        const event = details?.subscriberProgress || details?.isaProgress || null;
        const completedSubscriberCount = event?.['event-type'] === 'subscriber-completed'
          ? Number(event['subscriber-count'] ?? event['processed-subscribers'])
          : 0;
        if (shouldSampleSubscriberTelemetry(
          event,
          lastSampledSubscriberCount,
          TELEMETRY_SUBSCRIBER_INTERVAL,
        )) {
          lastSampledSubscriberCount = completedSubscriberCount;
          parentPort?.postMessage({
            type: 'telemetry',
            runId: workerData.runId,
            samplePhase: 'subscriber-interval',
            metrics: {
              ...progressTelemetry(event, overallJobPercent),
              ...getRuntimeTelemetry(startTimeMs, startCpuUsage),
            },
          });
        }

        parentPort?.postMessage({
          type: 'progress',
          overallJobPercent,
          step,
          subscriberProgress,
          isaProgress,
          progressTelemetry: progressTelemetry(event, overallJobPercent),
        });
      },
    });

    if (!result || typeof result !== 'object') {
      throw new Error('Validation finished but no result payload was produced');
    }

    parentPort?.postMessage({
      ...buildCompactEdiWorkbenchWorkerResult(result, workerData.runId),
      metrics: getRuntimeTelemetry(startTimeMs, startCpuUsage),
    });
  } catch (error) {
    parentPort?.postMessage({
      type: 'failed',
      error: error?.message || 'Failed to parse EDI file',
      errorType: error?.type || null,
      errorDetails: sanitizeSensitiveMetadata(error?.details || null),
      metrics: getRuntimeTelemetry(startTimeMs, startCpuUsage),
    });
  }
}

void runValidationJob();
