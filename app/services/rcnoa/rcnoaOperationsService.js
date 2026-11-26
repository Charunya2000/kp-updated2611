import { timingSafeEqual } from 'node:crypto';
import {
  confirmRcnoaUpload,
  createRcnoaDownloadLink,
  createRcnoaUploadTarget,
  deleteRcnoaArtifactBlob,
  isRcnoaLocalTesting,
  readRcnoaArtifact,
  RCNOA_BLOB_CONTAINER,
  stageRcnoaArtifact,
} from './rcnoaBlobService.js';
import {
  buildRcnoaBlobName,
  getRcnoaProductionReadiness,
  RCNOA_DEFAULTS,
  sanitizeFileName,
  validateReconciliationCycle,
  validate834Content,
} from './rcnoaCore.js';
import {
  loadWorkingRcnaRecords,
  processRcnoaRun,
  stage834FromRcnaArtifact,
} from './rcnoaProcessingService.js';
import {
  getRcnoaBusinessConfiguration,
  claimDueRcnoaSchedule,
  claimNextQueuedRcnoaRun,
  createRcnoaArtifact,
  createRcnoaRetryRun,
  createRcnoaRun,
  deleteRcnoaRunDocuments,
  findRcnoaInputArtifact,
  ensureRcnoaIndexes,
  getRcnoaArtifact,
  getRcnoaQueryConfiguration,
  getRcnoaRun,
  getRcnoaSchedule,
  hasActiveScheduledRcnoaRun,
  isRcnoaArtifactBlobShared,
  listAllRcnoaRunItems,
  listRcnoaArtifacts,
  listRcnoaRunItems,
  listRcnoaRuns,
  recoverStaleRcnoaRuns,
  saveRcnoaSchedule,
  saveRcnoaBusinessConfiguration,
  savePriorRcnaRecords,
  saveRcnoaQueryConfiguration,
  setRcnoaRunInput,
  transitionRcnoaRun,
  updateRcnoaRunNote,
} from './rcnoaRepositoryService.js';
import { publicRcnoaBusinessConfiguration } from './rcnoaBusinessConfigurationService.js';
import {
  buildRcnoaScheduleIdempotencyKey,
  calculateNextRcnoaRun,
  validateRcnoaSchedule,
} from './rcnoaScheduleService.js';
import {
  archiveRcnoaInput,
  deliverRcnoaOutput,
  receiveNextRcnoFile,
} from './rcnoaSftpService.js';
import {
  listRcnoaMockFixtures,
  loadRcnoaMockFixture,
  rcnoaMockFixturesEnabled,
} from './rcnoaMockFixtureService.js';

function defaultSchedule() {
  return {
    enabled: false,
    frequency: { unit: 'daily', interval: 1, daysOfWeek: [], dayOfMonth: null },
    startTime: '08:30',
    timeZone: RCNOA_DEFAULTS.timeZone,
    lastTriggeredAt: null,
    nextScheduledAt: null,
    version: 0,
  };
}

async function getCanonicalRcnoaSchedule() {
  const schedule = await getRcnoaSchedule();
  if (!schedule || schedule.timeZone === RCNOA_DEFAULTS.timeZone) return schedule;
  const normalized = validateRcnoaSchedule(schedule);
  const nextScheduledAt = normalized.enabled ? calculateNextRcnoaRun(normalized) : null;
  return saveRcnoaSchedule({ ...schedule, ...normalized, nextScheduledAt }, 'rcnoa-system');
}

export async function getRcnoaAdminState(runQuery = {}) {
  await ensureRcnoaIndexes();
  await recoverStaleRcnoaRuns();
  const [schedule, businessConfiguration, queryConfiguration, runs, mockFixtures] = await Promise.all([
    getCanonicalRcnoaSchedule(),
    getRcnoaBusinessConfiguration(),
    getRcnoaQueryConfiguration(),
    listRcnoaRuns(runQuery),
    listRcnoaMockFixtures(),
  ]);
  return {
    schedule: schedule || defaultSchedule(),
    businessConfiguration: publicRcnoaBusinessConfiguration(businessConfiguration),
    queryConfiguration,
    runs,
    readiness: getRcnoaProductionReadiness(process.env, {
      mode: 'adhoc',
      businessConfiguration,
      require834: false,
    }),
    scheduledReadiness: getRcnoaProductionReadiness(process.env, {
      mode: 'scheduled',
      businessConfiguration,
      require834: false,
    }),
    mockFixturesEnabled: rcnoaMockFixturesEnabled(),
    mockFixtures,
    mockReadiness: getRcnoaProductionReadiness(process.env, {
      mode: 'adhoc-mock',
      businessConfiguration,
      require834: false,
    }),
  };
}

export async function updateRcnoaSchedule(schedule, actor) {
  const normalized = validateRcnoaSchedule(schedule);
  const nextScheduledAt = normalized.enabled ? calculateNextRcnoaRun(normalized) : null;
  return saveRcnoaSchedule({ ...normalized, nextScheduledAt }, actor);
}

export async function reserveRcnoaUpload(fileName, actor) {
  if (isRcnoaLocalTesting()) {
    throw new Error('Direct upload reservation is unavailable during RCNOA local testing; use the multipart upload endpoint');
  }
  const safeFileName = sanitizeFileName(fileName);
  const run = await createRcnoaRun({
    mode: 'adhoc',
    requestedBy: actor,
    inputFileName: safeFileName,
    status: 'AWAITING_UPLOAD',
    currentStage: 'AWAITING_UPLOAD',
  });
  const upload = await createRcnoaUploadTarget({
    runId: run.id,
    nuid: actor,
    fileName: safeFileName,
  });
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'reserveRcnoaUpload',
      detail: {
        runId: run.id,
        status: run.status,
        containerName: upload.containerName,
        uploadHost: new URL(upload.uploadUrl).host,
      },
    },
  }));
  return { run, upload };
}

export async function uploadRcnoaFile({ fileName, content, contentType }, actor) {
  const safeFileName = sanitizeFileName(fileName);
  const sizeBytes = Buffer.byteLength(content);
  if (sizeBytes <= 0 || sizeBytes > RCNOA_DEFAULTS.maxUploadBytes) {
    throw new Error(`Uploaded RCNO file must be between 1 byte and ${RCNOA_DEFAULTS.maxUploadBytes} bytes`);
  }

  const run = await createRcnoaRun({
    mode: 'adhoc',
    requestedBy: actor,
    inputFileName: safeFileName,
    status: 'AWAITING_UPLOAD',
    currentStage: 'STAGING_UPLOAD',
  });
  try {
    const artifact = await stageRcnoaArtifact({
      mode: 'adhoc',
      nuid: actor,
      runId: run.id,
      direction: 'input',
      fileName: safeFileName,
      content,
      contentType: contentType || 'text/plain',
    });
    await createRcnoaArtifact(run.id, {
      ...artifact,
      ownerNuid: actor,
      direction: 'input',
      artifactType: 'rcno',
    }, actor);
    const queuedRun = await transitionRcnoaRun(run.id, {
      fromStatuses: ['AWAITING_UPLOAD'],
      status: 'QUEUED',
      currentStage: 'QUEUED',
      actor,
    });
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'uploadRcnoaFile',
        detail: { runId: run.id, sizeBytes, status: queuedRun?.status },
      },
    }));
    return queuedRun;
  } catch (error) {
    await transitionRcnoaRun(run.id, {
      fromStatuses: ['AWAITING_UPLOAD'],
      status: 'ERROR',
      currentStage: 'ERROR',
      errorCode: 'RCNOA_UPLOAD_STAGE_FAILED',
      errorSummary: String(error?.message || 'Failed to stage uploaded RCNO file').slice(0, 500),
      actor,
    });
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'uploadRcnoaFile',
        detail: { runId: run.id, sizeBytes, error: error.message },
      },
    }));
    throw error;
  }
}

export async function startRcnoaUploadRun(runId, actor) {
  let stage = 'loadRun';
  try {
    const run = await getRcnoaRun(runId);
    if (!run || run.mode !== 'adhoc') throw new Error('RCNOA run not found');
    if (run.requestedBy !== actor) throw new Error('RCNOA run is owned by another user');
    if (run.status === 'QUEUED' || run.status === 'PROCESSING') return run;
    if (run.status !== 'AWAITING_UPLOAD') throw new Error('RCNOA run cannot be started from its current state');

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'startRcnoaUploadRun',
        detail: { runId, stage: 'uploadConfirmationStarted', status: run.status },
      },
    }));
    stage = 'createUploadTarget';
    const upload = await createRcnoaUploadTarget({
      runId: run.id,
      nuid: actor,
      fileName: run.inputFileName,
    });
    stage = 'confirmBlob';
    const properties = await confirmRcnoaUpload(upload);
    stage = 'createArtifact';
    await createRcnoaArtifact(run.id, {
      ownerNuid: actor,
      direction: 'input',
      artifactType: 'rcno',
      containerName: upload.containerName,
      blobName: upload.blobName,
      fileName: upload.fileName,
      contentType: properties.contentType,
      sizeBytes: properties.sizeBytes,
      etag: properties.etag,
    }, actor);
    stage = 'queueRun';
    const queuedRun = await transitionRcnoaRun(run.id, {
      fromStatuses: ['AWAITING_UPLOAD'],
      status: 'QUEUED',
      currentStage: 'QUEUED',
      actor,
    });
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'startRcnoaUploadRun',
        detail: { runId, stage: 'runQueued', status: queuedRun?.status },
      },
    }));
    return queuedRun;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'startRcnoaUploadRun',
        detail: { runId, stage, error: error.message },
      },
    }));
    throw error;
  }
}

export async function getRcnoaRunDetail(runId) {
  const run = await getRcnoaRun(runId);
  if (!run) return null;
  const [artifacts, failures] = await Promise.all([
    listRcnoaArtifacts(runId),
    // Temporarily return all failed rows in run detail instead of limiting the UI to 25.
    listAllRcnoaRunItems(runId),
  ]);
  return { ...run, artifacts, failures };
}

export async function getRcnoaRunFailures(runId, query) {
  return listRcnoaRunItems(runId, query);
}

export async function saveRcnoaRunNote(runId, note, actor) {
  const run = await updateRcnoaRunNote(runId, note, actor);
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'saveRcnoaRunNote',
      detail: { runId, hasNote: Boolean(run.note) },
    },
  }));
  return run;
}

export async function deleteRcnoaRun(runId) {
  const run = await getRcnoaRun(runId);
  if (!run) throw new Error('RCNOA run not found');
  if (!['AWAITING_UPLOAD', 'AWAITING_RCNA_REVIEW', 'COMPLETE', 'PARTIAL', 'ERROR', 'CANCELED', 'SKIPPED'].includes(run.status)) {
    throw new Error('RCNOA run must be completed or awaiting upload before deletion');
  }

  const artifacts = await listRcnoaArtifacts(runId);
  if (run.status === 'AWAITING_UPLOAD' && run.mode === 'adhoc') {
    artifacts.push({
      containerName: RCNOA_BLOB_CONTAINER,
      blobName: buildRcnoaBlobName({
        mode: 'adhoc',
        nuid: run.requestedBy,
        runId: run.id,
        direction: 'input',
        fileName: run.inputFileName,
      }),
    });
  }
  const uniqueLocations = [...new Map(artifacts
    .filter((artifact) => artifact.containerName && artifact.blobName)
    .map((artifact) => [`${artifact.containerName}\u0000${artifact.blobName}`, artifact])).values()];
  let deletedBlobCount = 0;
  for (const artifact of uniqueLocations) {
    if (!await isRcnoaArtifactBlobShared(runId, artifact)) {
      const result = await deleteRcnoaArtifactBlob(artifact);
      if (result.succeeded) deletedBlobCount += 1;
    }
  }

  const deleted = await deleteRcnoaRunDocuments(runId);
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'deleteRcnoaRun',
      detail: { runId, deletedBlobCount, deletedChildCount: deleted.deletedChildCount },
    },
  }));
  return { runId, deletedBlobCount, deletedChildCount: deleted.deletedChildCount };
}

export async function retryRcnoaRun(runId, actor) {
  const run = await getRcnoaRun(runId);
  if (!run) throw new Error('RCNOA run not found');
  if (run.mode === 'adhoc' && run.requestedBy !== actor) {
    throw new Error('RCNOA run is owned by another user');
  }
  const retry = await createRcnoaRetryRun(run, actor);
  const input = await findRcnoaInputArtifact(run.id);
  if (!input) throw new Error('Original RCNOA input artifact is unavailable');
  await createRcnoaArtifact(retry.id, {
    direction: input.direction,
    artifactType: input.artifactType,
    containerName: input.containerName,
    blobName: input.blobName,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    sha256: input.sha256,
    etag: input.etag,
    ownerNuid: retry.mode === 'adhoc' ? actor : null,
  }, actor);
  return retry;
}

export async function getAuthorizedRcnoaDownload(
  artifactId,
  actor,
  localDownloadUrl,
  expectedRunId,
) {
  const artifact = await getRcnoaArtifact(artifactId);
  if (!artifact
    || artifact.direction !== 'output'
    || (expectedRunId && artifact.parentId !== expectedRunId)) {
    throw new Error('RCNOA artifact not found');
  }
  if (artifact.ownerNuid && artifact.ownerNuid !== actor) {
    throw new Error('RCNOA artifact is owned by another user');
  }
  return {
    url: await createRcnoaDownloadLink(artifact, localDownloadUrl),
    fileName: artifact.fileName,
  };
}

export async function getAuthorizedRcnoaArtifactContent(artifactId, actor, expectedRunId) {
  const artifact = await getRcnoaArtifact(artifactId);
  if (!artifact
    || artifact.direction !== 'output'
    || (expectedRunId && artifact.parentId !== expectedRunId)) {
    throw new Error('RCNOA artifact not found');
  }
  if (artifact.ownerNuid && artifact.ownerNuid !== actor) {
    throw new Error('RCNOA artifact is owned by another user');
  }
  return {
    content: await readRcnoaArtifact(artifact),
    contentType: artifact.contentType || 'application/octet-stream',
    fileName: sanitizeFileName(artifact.fileName),
  };
}

export function verifyRcnoaSchedulerToken(authorizationHeader) {
  const configured = String(process.env.RCNOA_SCHEDULER_TOKEN || '');
  const supplied = String(authorizationHeader || '').replace(/^Bearer\s+/i, '');
  if (!configured || !supplied) return false;
  const configuredBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  return configuredBuffer.length === suppliedBuffer.length
    && timingSafeEqual(configuredBuffer, suppliedBuffer);
}

async function enqueueDueSchedule() {
  const schedule = await getCanonicalRcnoaSchedule();
  const timestamp = new Date();
  if (!schedule?.enabled || !schedule.nextScheduledAt || new Date(schedule.nextScheduledAt) > timestamp) {
    return null;
  }

  const nextScheduledAt = calculateNextRcnoaRun(schedule, timestamp);
  const claimedSchedule = await claimDueRcnoaSchedule(schedule, nextScheduledAt);
  if (!claimedSchedule) return null;
  const scheduledAt = new Date(claimedSchedule.lastTriggeredAt);
  const idempotencyKey = buildRcnoaScheduleIdempotencyKey(schedule.id, scheduledAt);
  const active = await hasActiveScheduledRcnoaRun();
  return createRcnoaRun({
    mode: 'scheduled',
    requestedBy: 'rcnoa-scheduler',
    inputFileName: null,
    parentId: schedule.id,
    idempotencyKey,
    status: active ? 'SKIPPED' : 'QUEUED',
    currentStage: active ? 'OVERLAP_SKIPPED' : 'QUEUED',
  });
}

async function stageScheduledInput(run, connectionTimeoutSeconds) {
  const received = await receiveNextRcnoFile(connectionTimeoutSeconds);
  if (!received) throw new Error('No eligible RCNO file is available on SFTP');
  const artifact = await stageRcnoaArtifact({
    mode: 'scheduled',
    runId: run.id,
    direction: 'input',
    fileName: received.fileName,
    content: received.content,
  });
  await createRcnoaArtifact(run.id, {
    ...artifact,
    ownerNuid: null,
    direction: 'input',
    artifactType: 'rcno',
  }, 'rcnoa-worker');
  return setRcnoaRunInput(run.id, received.fileName);
}

async function pauseScheduledRunForReview(run, connectionTimeoutSeconds) {
  await archiveRcnoaInput(run.inputFileName, connectionTimeoutSeconds);
  return transitionRcnoaRun(run.id, {
    fromStatuses: ['PROCESSING'],
    status: 'AWAITING_RCNA_REVIEW',
    currentStage: 'AWAITING_RCNA_REVIEW',
    counts: run.counts,
    actor: 'rcnoa-worker',
  });
}

export async function runRcnoaWorkerOnce() {
  await ensureRcnoaIndexes();
  const scheduledRun = await enqueueDueSchedule();
  const run = await claimNextQueuedRcnoaRun();
  if (!run) return { scheduledRun, processedRun: null };
  try {
    const businessConfiguration = await getRcnoaBusinessConfiguration();
    if (!getRcnoaProductionReadiness(process.env, {
      mode: run.mode,
      businessConfiguration,
      require834: false,
    }).ready) {
      await processRcnoaRun(run);
      return { scheduledRun, processedRun: await getRcnoaRun(run.id) };
    }
    const preparedRun = run.mode === 'scheduled'
      ? await stageScheduledInput(run, businessConfiguration.sftpConnectionTimeoutSeconds)
      : run;
    await processRcnoaRun(preparedRun);
    const processedRun = await getRcnoaRun(run.id);
    if (processedRun?.mode === 'scheduled' && processedRun.currentStage === 'RCNA_STAGED') {
      return {
        scheduledRun,
        processedRun: await pauseScheduledRunForReview(
          processedRun,
          businessConfiguration.sftpConnectionTimeoutSeconds,
        ),
      };
    }
    return { scheduledRun, processedRun };
  } catch (error) {
    const failedRun = await transitionRcnoaRun(run.id, {
      fromStatuses: ['PROCESSING'],
      status: 'ERROR',
      currentStage: 'ERROR',
      errorCode: 'RCNOA_WORKER_FAILED',
      errorSummary: String(error?.message || 'RCNOA worker failed').slice(0, 500),
      actor: 'rcnoa-worker',
    });
    return { scheduledRun, processedRun: failedRun };
  }
}

export async function processNextAdhocRcnoaRun(actor, lookupSource = 'live') {
  await ensureRcnoaIndexes();
  const run = await claimNextQueuedRcnoaRun(actor, { mode: 'adhoc', lookupSource });
  if (!run) return null;
  await processRcnoaRun(run);
  return getRcnoaRun(run.id);
}

export async function updateRcnoaQueryConfiguration(configuration, actor) {
  return saveRcnoaQueryConfiguration(configuration, actor);
}

export async function updateRcnoaBusinessConfiguration(configuration, actor) {
  return publicRcnoaBusinessConfiguration(
    await saveRcnoaBusinessConfiguration(configuration, actor),
  );
}

function assertRunOwner(run, actor) {
  if (!run) throw new Error('RCNOA run not found');
  if (run.mode === 'adhoc' && run.requestedBy !== actor) {
    throw new Error('RCNOA run is owned by another user');
  }
}

export async function generate834ForRcnoaRun(runId, actor) {
  const run = await getRcnoaRun(runId);
  assertRunOwner(run, actor);
  const operation = run.operation || 'RCNO_TO_RCNA';
  if (!['RCNO_TO_RCNA', 'RCNA_IMPORT', 'RCNA_TO_834'].includes(operation)) {
    throw new Error('834 generation requires an RCNA-producing run');
  }
  if (run.status !== 'AWAITING_RCNA_REVIEW') {
    throw new Error('RCNOA run is not awaiting RCNA review');
  }
  const artifacts = await listRcnoaArtifacts(run.id);
  const rcnaArtifactType = operation === 'RCNO_TO_RCNA' ? 'outbound-rcna' : 'rcna';
  const rcnaArtifact = artifacts.find((artifact) => artifact.artifactType === rcnaArtifactType);
  if (!rcnaArtifact) throw new Error('RCNA artifact is unavailable');

  const processingRun = await transitionRcnoaRun(run.id, {
    fromStatuses: ['AWAITING_RCNA_REVIEW'],
    status: 'PROCESSING',
    currentStage: 'GENERATING_834',
    counts: run.counts,
    actor,
  });
  if (!processingRun) throw new Error('RCNOA run is no longer awaiting review');
  try {
    const result = await stage834FromRcnaArtifact({ run: processingRun, rcnaArtifact, actor });
    return transitionRcnoaRun(run.id, {
      fromStatuses: ['PROCESSING'],
      status: 'COMPLETE',
      currentStage: '834_GENERATED',
      counts: {
        ...run.counts,
        members834Written: result.counts.members,
        members834Skipped: result.counts.skipped ?? 0,
      },
      actor,
    });
  } catch (error) {
    await transitionRcnoaRun(run.id, {
      fromStatuses: ['PROCESSING'],
      status: 'AWAITING_RCNA_REVIEW',
      currentStage: 'AWAITING_RCNA_REVIEW',
      counts: run.counts,
      errorCode: 'RCNOA_834_GENERATION_FAILED',
      errorSummary: String(error?.message || '834 generation failed').slice(0, 500),
      actor,
    });
    throw error;
  }
}

async function createUploadedFileRun({
  fileName,
  content,
  contentType,
  artifactType,
  operation,
}, actor) {
  const safeFileName = sanitizeFileName(fileName);
  const sizeBytes = Buffer.byteLength(content);
  if (sizeBytes <= 0 || sizeBytes > RCNOA_DEFAULTS.maxUploadBytes) {
    throw new Error(`Uploaded file must be between 1 byte and ${RCNOA_DEFAULTS.maxUploadBytes} bytes`);
  }
  const run = await createRcnoaRun({
    mode: 'adhoc',
    operation,
    requestedBy: actor,
    inputFileName: safeFileName,
    status: 'AWAITING_UPLOAD',
    currentStage: 'STAGING_UPLOAD',
  });
  try {
    const artifact = await stageRcnoaArtifact({
      mode: 'adhoc',
      nuid: actor,
      runId: run.id,
      direction: 'input',
      fileName: safeFileName,
      content,
      contentType,
    });
    const storedArtifact = await createRcnoaArtifact(run.id, {
      ...artifact,
      ownerNuid: actor,
      direction: 'input',
      artifactType,
    }, actor);
    const processingRun = await transitionRcnoaRun(run.id, {
      fromStatuses: ['AWAITING_UPLOAD'],
      status: 'PROCESSING',
      currentStage: operation === 'RCNA_IMPORT' ? 'IMPORTING_RCNA' : 'DELIVERING_834',
      startedAt: new Date(),
      actor,
    });
    return { run: processingRun, artifact: storedArtifact };
  } catch (error) {
    await transitionRcnoaRun(run.id, {
      fromStatuses: ['AWAITING_UPLOAD'],
      status: 'ERROR',
      currentStage: 'ERROR',
      errorCode: 'RCNOA_UPLOAD_STAGE_FAILED',
      errorSummary: String(error?.message || 'Failed to stage uploaded file').slice(0, 500),
      actor,
    });
    throw error;
  }
}

export async function importUploadedRcna(file, reconciliationCycle, actor) {
  const validatedCycle = validateReconciliationCycle(reconciliationCycle);
  const created = await createUploadedFileRun({
    ...file,
    artifactType: 'rcna',
    operation: 'RCNA_IMPORT',
  }, actor);
  try {
    const workingRcnaRecords = await loadWorkingRcnaRecords(created.artifact);
    await transitionRcnoaRun(created.run.id, {
      fromStatuses: ['PROCESSING'],
      status: 'PROCESSING',
      currentStage: 'SAVING_PRIOR_RCNA',
      actor,
    });
    const businessConfiguration = await getRcnoaBusinessConfiguration();
    await savePriorRcnaRecords(
      created.run.id,
      workingRcnaRecords,
      validatedCycle,
      businessConfiguration.priorRcnaMatchKeySecret,
      actor,
    );
    return transitionRcnoaRun(created.run.id, {
      fromStatuses: ['PROCESSING'],
      status: 'AWAITING_RCNA_REVIEW',
      currentStage: 'AWAITING_RCNA_REVIEW',
      counts: {
        ...created.run.counts,
        received: workingRcnaRecords.length,
        processed: workingRcnaRecords.length,
        succeeded: workingRcnaRecords.length,
        rcnaWritten: workingRcnaRecords.length,
      },
      actor,
    });
  } catch (error) {
    await transitionRcnoaRun(created.run.id, {
      fromStatuses: ['PROCESSING'],
      status: 'ERROR',
      currentStage: 'ERROR',
      errorCode: 'RCNOA_RCNA_IMPORT_FAILED',
      errorSummary: String(error?.message || 'RCNA import failed').slice(0, 500),
      actor,
    });
    throw error;
  }
}

export async function deliverUploaded834(file, actor) {
  validate834Content(file.content);
  const created = await createUploadedFileRun({
    ...file,
    artifactType: '834',
    operation: '834_TO_SFTP',
  }, actor);
  try {
    const businessConfiguration = await getRcnoaBusinessConfiguration();
    await deliverRcnoaOutput(
      created.artifact.fileName,
      file.content,
      businessConfiguration.sftpConnectionTimeoutSeconds,
    );
    return transitionRcnoaRun(created.run.id, {
      fromStatuses: ['PROCESSING'],
      status: 'COMPLETE',
      currentStage: '834_DELIVERED',
      actor,
    });
  } catch (error) {
    await transitionRcnoaRun(created.run.id, {
      fromStatuses: ['PROCESSING'],
      status: 'ERROR',
      currentStage: 'ERROR',
      errorCode: 'RCNOA_834_DELIVERY_FAILED',
      errorSummary: String(error?.message || '834 delivery failed').slice(0, 500),
      actor,
    });
    throw error;
  }
}

export async function createMockRcnoaRun(fixtureId, actor) {
  const fixture = await loadRcnoaMockFixture(fixtureId);
  const run = await createRcnoaRun({
    mode: 'adhoc',
    requestedBy: actor,
    inputFileName: fixture.fileName,
    lookupSource: 'mock',
    mockFixtureId: fixture.id,
    mockFixtureVersion: fixture.version,
    mockFixtureChecksum: fixture.checksum,
    status: 'AWAITING_UPLOAD',
    currentStage: 'STAGING_MOCK_FIXTURE',
  });
  try {
    const artifact = await stageRcnoaArtifact({
      mode: 'adhoc',
      nuid: actor,
      runId: run.id,
      direction: 'input',
      fileName: fixture.fileName,
      content: fixture.rcnoText,
    });
    await createRcnoaArtifact(run.id, {
      ...artifact,
      ownerNuid: actor,
      direction: 'input',
      artifactType: 'rcno',
      mockFixtureId: fixture.id,
      mockFixtureVersion: fixture.version,
      mockFixtureChecksum: fixture.checksum,
    }, actor);
    return transitionRcnoaRun(run.id, {
      fromStatuses: ['AWAITING_UPLOAD'],
      status: 'QUEUED',
      currentStage: 'QUEUED',
      actor,
    });
  } catch (error) {
    await transitionRcnoaRun(run.id, {
      fromStatuses: ['AWAITING_UPLOAD'],
      status: 'ERROR',
      currentStage: 'ERROR',
      errorCode: 'RCNOA_MOCK_FIXTURE_STAGE_FAILED',
      errorSummary: String(error?.message || 'Failed to stage RCNOA mock fixture').slice(0, 500),
      actor,
    });
    throw error;
  }
}