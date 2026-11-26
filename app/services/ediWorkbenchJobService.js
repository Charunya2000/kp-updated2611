import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { persistValidatedEditableCompanionGuide } from './ediEditableCompanionGuideService';
import { createValidationReportArtifact } from './ediValidationReportArtifactService';
import { appendBoundedValidationFindings } from '../utils/ediWorkbenchStreamState';
import { allowlistEdiDiagnosticMetrics } from '../utils/ediWorkbenchTelemetry';

function resolveMsFromEnv(envName, fallbackMs) {
  const rawValue = process.env[envName];
  const parsedValue = Number.parseInt(rawValue ?? '', 10);

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return fallbackMs;
}

const JOB_TTL_MS = resolveMsFromEnv('EDI_WORKBENCH_JOB_TTL_MS', 60 * 60 * 1000);
const JOB_MAX_RUNTIME_MS = resolveMsFromEnv('EDI_WORKBENCH_JOB_MAX_RUNTIME_MS', 45 * 60 * 1000);
const JOB_STALE_PROGRESS_MS = resolveMsFromEnv('EDI_WORKBENCH_STALE_PROGRESS_MS', 20 * 60 * 1000);
const JOB_WATCHDOG_INTERVAL_MS = resolveMsFromEnv('EDI_WORKBENCH_WATCHDOG_INTERVAL_MS', 10000);
const WORKER_MAX_OLD_GENERATION_SIZE_MB = resolveMsFromEnv(
  'EDI_WORKBENCH_WORKER_MAX_OLD_GENERATION_SIZE_MB',
  null,
);

function getJobStore() {
  if (!globalThis.__ediWorkbenchJobs) {
    globalThis.__ediWorkbenchJobs = new Map();
  }

  return globalThis.__ediWorkbenchJobs;
}

function cleanupExpiredJobs() {
  const now = Date.now();
  const store = getJobStore();

  for (const [jobId, job] of store.entries()) {
    if (now - job.updatedAt > JOB_TTL_MS) {
      store.delete(jobId);
    }
  }
}

function updateJob(jobId, patch) {
  const store = getJobStore();
  const current = store.get(jobId);

  if (!current) {
    return null;
  }

  const updated = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };

  store.set(jobId, updated);
  return updated;
}

function mergeJobMetrics(jobId, patchMetrics = null) {
  const current = getEdiValidationJob(jobId);
  const existingMetrics = current?.metrics && typeof current.metrics === 'object'
    ? current.metrics
    : {};
  const nextMetrics = patchMetrics && typeof patchMetrics === 'object'
    ? patchMetrics
    : {};

  if (Object.keys(nextMetrics).length === 0) {
    return Object.keys(existingMetrics).length > 0 ? existingMetrics : null;
  }

  return {
    ...existingMetrics,
    ...nextMetrics,
  };
}

export function createEdiValidationJob({
  edi,
  companion,
  editableGuide = null,
  editableGuideMetadata = null,
  templateId = null,
  runConfigId = null,
  validationScope = null,
  parseOptions = null,
  runtimeConfig = null,
}) {
  cleanupExpiredJobs();

  const store = getJobStore();
  const jobId = crypto.randomUUID();
  const now = Date.now();

  store.set(jobId, {
    jobId,
    status: 'running',
    step: 'Starting validation',
    progress: 3,
    overallJobPercent: 3,
    metrics: null,
    createdAt: now,
    updatedAt: now,
    result: null,
    findingCount: 0,
    findingPreview: [],
    error: null,
    context: {
      templateId,
      runConfigId,
      validationScope,
      parseOptions,
      teamName: runtimeConfig?.teamName || null,
      assistantName: runtimeConfig?.assistantName || null,
      smartNoteId: runtimeConfig?.smartNoteId || null,
      ownerNuid: runtimeConfig?.ownerNuid || null,
    },
  });

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'ediWorkbenchValidationJobCreated',
      detail: {
        jobId,
        templateId,
        runConfigId,
        validationScopeMode: validationScope?.mode || null,
        parseOptions,
        workerMaxOldGenerationSizeMb: WORKER_MAX_OLD_GENERATION_SIZE_MB,
      },
    },
  }));

  // Build the worker path at runtime (project root = process.cwd(), same assumption the
  // worker itself uses) and pass it as a plain absolute path string. This avoids the
  // new Worker(new URL('./file', import.meta.url)) shape that Turbopack/webpack special-case
  // and try to bundle as a separate chunk; the .cjs worker must be loaded by Node at runtime
  // because it dynamically imports the efss ClojureScript bundle.
  const workerPath = path.join(process.cwd(), 'app', 'services', 'ediWorkbenchValidationWorker.cjs');
  const workerOptions = {
    workerData: {
      runId: jobId,
      edi,
      companion,
      editableGuide,
      template: runtimeConfig?.template || null,
      runConfig: runtimeConfig?.runConfig || null,
      validationScope: validationScope || null,
      parseOptions: parseOptions || null,
    },
  };

  if (WORKER_MAX_OLD_GENERATION_SIZE_MB) {
    workerOptions.resourceLimits = {
      maxOldGenerationSizeMb: WORKER_MAX_OLD_GENERATION_SIZE_MB,
    };
  }

  const worker = new Worker(workerPath, workerOptions);
  let isFinalized = false;
  const workerTempFiles = new Set();

  const cleanupWorkerTempFiles = async () => {
    const paths = [...workerTempFiles];
    workerTempFiles.clear();
    await Promise.all(paths.map((filePath) => fs.rm(filePath, { force: true }).catch(() => null)));
  };

  const clearWatchdogs = () => {
    clearTimeout(runtimeTimeout);
    clearInterval(staleProgressInterval);
  };

  const finalizeJob = (patch) => {
    if (isFinalized) {
      return;
    }

    isFinalized = true;
    clearWatchdogs();
    updateJob(jobId, patch);
    void cleanupWorkerTempFiles();
  };

  const runtimeTimeout = setTimeout(() => {
    const job = getEdiValidationJob(jobId);
    if (!job || job.status !== 'running') {
      return;
    }

    finalizeJob({
      status: 'failed',
      step: 'Validation timed out',
      progress: 100,
      overallJobPercent: 100,
      error: 'Validation exceeded the maximum runtime limit',
    });

    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'ediWorkbenchValidationTimeout',
        detail: { jobId, maxRuntimeMs: JOB_MAX_RUNTIME_MS },
      },
    }));

    void worker.terminate();
  }, JOB_MAX_RUNTIME_MS);

  const staleProgressInterval = setInterval(() => {
    const job = getEdiValidationJob(jobId);
    if (!job || job.status !== 'running') {
      return;
    }

    const staleForMs = Date.now() - job.updatedAt;
    if (staleForMs < JOB_STALE_PROGRESS_MS) {
      return;
    }

    finalizeJob({
      status: 'failed',
      step: 'Validation stalled',
      progress: 100,
      overallJobPercent: 100,
      error: 'Validation made no progress for too long while reading the file',
    });

    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'ediWorkbenchValidationStalled',
        detail: {
          jobId,
          staleForMs,
          staleProgressThresholdMs: JOB_STALE_PROGRESS_MS,
        },
      },
    }));

    void worker.terminate();
  }, JOB_WATCHDOG_INTERVAL_MS);

  worker.on('message', async (message) => {
    if (message?.runId && message.runId !== jobId) {
      return;
    }

    if (message?.type === 'validation-temp-file') {
      if (typeof message.filePath === 'string' && message.filePath) {
        workerTempFiles.add(message.filePath);
      }
      return;
    }

    if (message?.type === 'validation-finding-batch') {
      const findings = Array.isArray(message.findings) ? message.findings : [];
      const current = getEdiValidationJob(jobId);
      updateJob(jobId, appendBoundedValidationFindings(current, findings));
      return;
    }

    if (message?.type === 'telemetry') {
      updateJob(jobId, {
        metrics: mergeJobMetrics(jobId, message.metrics),
      });

      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'ediWorkbenchValidationTelemetry',
          detail: {
            jobId,
            samplePhase: message.samplePhase || null,
            ...allowlistEdiDiagnosticMetrics(message.metrics),
          },
        },
      }));
      return;
    }

    if (message?.type === 'progress') {
      const mergedMetrics = mergeJobMetrics(jobId, {
        ...(message.subscriberProgress ? { subscriberProgress: message.subscriberProgress } : {}),
        ...(message.isaProgress ? { isaProgress: message.isaProgress } : {}),
        overallJobPercent: message.overallJobPercent,
      });

      updateJob(jobId, {
        status: 'running',
        step: message.step || 'Processing your files',
        progress: typeof message.overallJobPercent === 'number' ? message.overallJobPercent : 3,
        overallJobPercent: typeof message.overallJobPercent === 'number'
          ? message.overallJobPercent
          : 3,
        metrics: mergedMetrics,
      });

      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'ediWorkbenchValidationProgress',
          detail: {
            jobId,
            step: message.step || 'Processing your files',
            overallJobPercent: typeof message.overallJobPercent === 'number'
              ? message.overallJobPercent
              : 3,
            ...allowlistEdiDiagnosticMetrics(message.progressTelemetry),
          },
        },
      }));
      return;
    }

    if (message?.type === 'validation-completed') {
      if (!message.validationSummary) {
        finalizeJob({
          status: 'failed',
          step: 'Validation failed',
          progress: 100,
          overallJobPercent: 100,
          metrics: mergeJobMetrics(jobId, message.metrics),
          error: 'Validation finished but no results were returned',
        });

        console.error(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'ediWorkbenchValidationMissingResult',
            detail: {
              jobId,
              ...allowlistEdiDiagnosticMetrics(message.metrics),
            },
          },
        }));
        return;
      }

      let persistedEditableGuide = null;
      if (editableGuide) {
        try {
          persistedEditableGuide = await persistValidatedEditableCompanionGuide({
            teamName: runtimeConfig?.teamName,
            assistantName: runtimeConfig?.assistantName,
            smartNoteId: runtimeConfig?.smartNoteId,
            companion,
            editableGuide,
            efssPackageVersion: editableGuideMetadata?.efssPackageVersion || null,
          });
        } catch (error) {
          finalizeJob({
            status: 'failed',
            step: 'Failed to save validated companion guide',
            progress: 100,
            overallJobPercent: 100,
            metrics: mergeJobMetrics(jobId, message.metrics),
            error: error?.message || 'Failed to save validated companion guide',
          });
          return;
        }
      }

      const currentJob = getEdiValidationJob(jobId);
      const invalidElements = Array.isArray(currentJob?.findingPreview)
        ? currentJob.findingPreview
        : [];
      const compactReport = {
        'validation-summary': message.validationSummary,
        report: {
          validation: message.report?.validation,
          'lookup-summary': message.report?.lookupSummary,
          'subscriber-progress-summary': message.report?.subscriberProgressSummary,
          'subscriber-count': message.report?.subscriberCount,
          'subscriber-batch-size': message.report?.subscriberBatchSize,
          'single-query-db-validation-enabled':
            message.report?.singleQueryDbValidationEnabled,
          'single-query-prefetch-summary': message.report?.singleQueryPrefetchSummary,
          'invalid-findings-collected': message.report?.invalidFindingsCollected,
          'subscriber-statuses-collected': message.report?.subscriberStatusesCollected,
          'elapsed-ms': message.report?.elapsedMs,
          'isa-count': message.report?.isaCount,
          'run-id': jobId,
        },
        'invalid-findings': invalidElements,
        'subscriber-statuses': [],
      };
      let reportArtifact = null;
      try {
        reportArtifact = await createValidationReportArtifact({
          report: compactReport,
          tenantId: runtimeConfig?.teamName,
          runId: jobId,
          ediDisplayName: edi?.fileName || 'EDI input',
          companionDisplayName: companion?.fileName || 'Companion guide input',
        });
      } catch (error) {
        console.error(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'ediWorkbenchValidationArtifactFailed',
            detail: { jobId, error: error?.message || 'Failed to create validation report artifact' },
          },
        }));
      }

      finalizeJob({
        status: 'completed',
        step: 'Validation complete',
        progress: 100,
        overallJobPercent: 100,
        result: {
          summary: {
            valid: Number(message.validationSummary?.passed ?? message.validationSummary?.valid ?? 0),
            invalid: Number(message.validationSummary?.failed ?? message.validationSummary?.invalid ?? 0),
            unknown: Math.max(
              0,
              Number(message.validationSummary?.total ?? 0)
                - Number(message.validationSummary?.passed ?? message.validationSummary?.valid ?? 0)
                - Number(message.validationSummary?.failed ?? message.validationSummary?.invalid ?? 0),
            ),
          },
          invalidElements,
          findingCount: Number(currentJob?.findingCount || 0),
          findingsTruncated: Number(currentJob?.findingCount || 0) > invalidElements.length,
          x12Validation: message.validationSummary,
          report: message.report || null,
          executionContext: {
            templateId,
            runConfigId,
            validationScope,
            parseOptions: message.effectiveParseOptions || parseOptions,
            lookupStats: message.report?.lookupSummary || null,
          },
          ...(persistedEditableGuide
            ? {
                editableGuideRecord: {
                  id: persistedEditableGuide.id,
                  revision: persistedEditableGuide.revision,
                  schemaVersion: persistedEditableGuide.schemaVersion,
                  efssPackageVersion: persistedEditableGuide.efssPackageVersion,
                },
              }
            : {}),
          ...(reportArtifact
            ? {
                downloadReport: {
                  downloadUrl: reportArtifact.downloadUrl,
                  fileName: reportArtifact.fileName,
                  contentType: reportArtifact.contentType,
                  expiresAt: reportArtifact.expiresAt,
                },
              }
            : {}),
        },
        canonicalValidationReport: compactReport,
        reportArtifact: reportArtifact
          ? {
              containerName: reportArtifact.containerName,
              blobName: reportArtifact.blobName,
              jsonBlobName: reportArtifact.jsonBlobName,
            }
          : null,
        metrics: mergeJobMetrics(jobId, message.metrics),
        error: null,
      });

      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'ediWorkbenchValidationCompleted',
          detail: {
            jobId,
            singleQueryDbValidationEnabled:
              message.report?.singleQueryDbValidationEnabled,
            subscriberBatchSize: message.report?.subscriberBatchSize,
            singleQueryPrefetchSummary: message.report?.singleQueryPrefetchSummary,
            invalidFindingsCollected: message.report?.invalidFindingsCollected,
            subscriberStatusesCollected: message.report?.subscriberStatusesCollected,
            ...allowlistEdiDiagnosticMetrics(message.metrics),
          },
        },
      }));
      return;
    }

    if (message?.type === 'failed') {
      finalizeJob({
        status: 'failed',
        step: 'Validation failed',
        progress: 100,
        overallJobPercent: 100,
        metrics: mergeJobMetrics(jobId, message.metrics),
        error: message.error || 'Failed to parse EDI file',
        errorType: message.errorType || null,
        errorDetails: message.errorDetails || null,
      });

      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'ediWorkbenchValidationFailed',
          detail: {
            jobId,
            errorType: message.errorType || 'ValidationError',
            ...allowlistEdiDiagnosticMetrics(message.metrics),
          },
        },
      }));
    }
  });

  worker.on('error', (error) => {
    finalizeJob({
      status: 'failed',
      step: 'Validation failed',
      progress: 100,
      overallJobPercent: 100,
      error: error?.message || 'Failed to parse EDI file',
    });

    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'ediWorkbenchValidationWorkerError',
        detail: { jobId, errorType: error?.name || 'WorkerError' },
      },
    }));
  });

  worker.on('exit', (code) => {
    void cleanupWorkerTempFiles();
    const job = getEdiValidationJob(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      clearWatchdogs();
      return;
    }

    if (code !== 0) {
      finalizeJob({
        status: 'failed',
        step: 'Validation failed',
        progress: 100,
        overallJobPercent: 100,
        error: `Validation worker exited unexpectedly (code ${code})`,
      });
    }
  });

  return {
    jobId,
    status: 'running',
    step: 'Starting validation',
    progress: 3,
    overallJobPercent: 3,
    metrics: null,
    context: {
      templateId,
      runConfigId,
      validationScope,
      parseOptions,
    },
  };
}

export function getEdiValidationJob(jobId) {
  cleanupExpiredJobs();
  const store = getJobStore();
  return store.get(jobId) || null;
}

export function getAuthorizedEdiValidationJob({ jobId, teamName, assistantName, smartNoteId, ownerNuid }) {
  const job = getEdiValidationJob(jobId);
  if (!job) {
    return null;
  }

  const context = job.context || {};
  if (context.teamName !== teamName
    || context.assistantName !== assistantName
    || context.smartNoteId !== smartNoteId
    || context.ownerNuid !== ownerNuid) {
    return null;
  }

  return job;
}
