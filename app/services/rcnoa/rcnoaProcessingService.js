import { RcnaTo834Service } from './RcnaTo834Service.js';
import {
  buildRcnaFileName,
  buildRcnoaCompanionFileName,
  getRcnoaProductionReadiness,
  parseRcnaText,
  parseRcnoText,
  prepareUploadedRcnaPriorRecords,
  RCNO_DATA_RECORD_TYPE,
  selectRcnaRecordsFor834,
  serializeRcnoaRecords,
  transformRcnoRowsWithWorkerIsolation,
} from './rcnoaCore.js';
import { readRcnoaArtifactText, stageRcnoaArtifact } from './rcnoaBlobService.js';
import { writeAmbiguousMembershipRows } from './rcnoaFailureDiagnosticService.js';
import { loadRcnoaOracleLookups } from './rcnoaOracleService.js';
import { loadRcnoaMockFixture } from './rcnoaMockFixtureService.js';
import {
  createRcnoaArtifact,
  createRcnoaRunItems,
  findRcnoaInputArtifact,
  getRcnoaBusinessConfiguration,
  loadPriorRcnaRecords,
  savePriorRcnaRecords,
  transitionRcnoaRun,
} from './rcnoaRepositoryService.js';

const SKIPPED_834_ARTIFACT_TYPE = 'skipped-834-records';

function businessDate() {
  const date = new Date();
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
}

function errorSummary(error) {
  return String(error?.message || 'RCNOA processing failed')
    .replace(/\b\d{9}\b/g, '[REDACTED]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500);
}

function addressLine3Handler(mode) {
  return ({ line1, line2, line3 }) => {
    if (mode === 'append-to-line2') {
      return { line1, line2: [line2, line3].filter(Boolean).join(' ') };
    }
    // Address line 3 has no 834 destination, so any other mode omits it instead of failing.
    return { line1, line2 };
  };
}

export async function processRcnoaRun(run) {
  const advanceStage = async (nextStage) => {
    const updatedRun = await transitionRcnoaRun(run.id, {
      fromStatuses: ['PROCESSING'],
      status: 'PROCESSING',
      currentStage: nextStage,
      actor: 'rcnoa-worker',
    });
    if (!updatedRun) throw new Error('RCNOA run is no longer available for processing');
  };

  try {
    await advanceStage('LOADING_CONFIGURATION');
    const businessConfiguration = await getRcnoaBusinessConfiguration();
    const readiness = getRcnoaProductionReadiness(process.env, {
      mode: run.lookupSource === 'mock' ? 'adhoc-mock' : run.mode,
      businessConfiguration,
      require834: false,
    });
    if (!readiness.ready) {
      await transitionRcnoaRun(run.id, {
        fromStatuses: ['PROCESSING'],
        status: 'ERROR',
        currentStage: 'CONFIGURATION_BLOCKED',
        errorCode: 'RCNOA_CONFIGURATION_INCOMPLETE',
        errorSummary: `Missing or pending RCNOA configuration: ${[
          ...readiness.missing,
          ...readiness.invalid,
          ...readiness.pendingContracts,
        ].join(', ')}`,
        actor: 'rcnoa-worker',
      });
      return;
    }

    await advanceStage('LOADING_INPUT');
    const inputArtifact = await findRcnoaInputArtifact(run.id);
    if (!inputArtifact) throw new Error('RCNOA input artifact is missing');
    const inputText = await readRcnoaArtifactText(inputArtifact);
    const rcnoRecords = parseRcnoText(inputText, {
      ignoreFirstColumn: run.lookupSource !== 'mock'
        && businessConfiguration.ignoreFirstRcnoColumn,
      ignoreLastColumn: run.lookupSource !== 'mock'
        && businessConfiguration.ignoreLastRcnoColumn,
      keepRecordType: RCNO_DATA_RECORD_TYPE,
    });
    await advanceStage('LOADING_LOOKUPS');
    const mockFixture = run.lookupSource === 'mock'
      ? await loadRcnoaMockFixture(run.mockFixtureId)
      : null;
    if (mockFixture && (
      mockFixture.version !== run.mockFixtureVersion
      || mockFixture.checksum !== run.mockFixtureChecksum
    )) {
      throw new Error('RCNOA mock fixture changed after this run was queued');
    }
    if (mockFixture && inputText !== mockFixture.rcnoText) {
      throw new Error('RCNOA mock input does not match its predefined fixture');
    }
    const currentBusinessDate = mockFixture?.mock.businessDate || businessDate();
    const reconciliationCycle = currentBusinessDate.slice(0, 6);
    const [{ membershipRecords, recent834Records }, priorRcnaRecords] = mockFixture
      ? [mockFixture.mock, mockFixture.mock.priorRcnaRecords]
      : await Promise.all([
        loadRcnoaOracleLookups({
          businessDate: currentBusinessDate,
          rcnoRecords,
          callTimeoutSeconds: businessConfiguration.oracleCallTimeoutSeconds,
        }),
        businessConfiguration.reusePriorRcnaDecisions
          ? loadPriorRcnaRecords(
            rcnoRecords,
            reconciliationCycle,
            businessConfiguration.priorRcnaMatchKeySecret,
          )
          : Promise.resolve([]),
      ]);

    await advanceStage('TRANSFORMING');
    const transformed = await transformRcnoRowsWithWorkerIsolation({
      rcnoRecords,
      transformerOptions: {
        businessDate: currentBusinessDate,
        n12Code: businessConfiguration.n12Code,
        reusePriorRcnaDecisions: businessConfiguration.reusePriorRcnaDecisions,
      },
      membershipRecords,
      recent834Records,
      priorRcnaRecords,
      runId: run.id,
      onProgress: async (counts) => {
        const updatedRun = await transitionRcnoaRun(run.id, {
          fromStatuses: ['PROCESSING'],
          status: 'PROCESSING',
          currentStage: 'TRANSFORMING',
          counts: {
            ...counts,
            rcnaWritten: 0,
            members834Written: 0,
            members834Skipped: 0,
          },
          actor: 'rcnoa-worker',
        });
        if (!updatedRun) throw new Error('RCNOA run is no longer available for processing');
      },
    });
    await writeAmbiguousMembershipRows({
      runId: run.id,
      rcnoRecords,
      failures: transformed.failures,
    });
    if (transformed.failures.length) {
      await createRcnoaRunItems(run.id, transformed.failures, 'rcnoa-worker');
    }
    if (transformed.blockedRows.length) {
      await createRcnoaRunItems(run.id, transformed.blockedRows, 'rcnoa-worker');
    }
    if (!transformed.workingRecords.length) {
      const firstFailure = transformed.failures[0]?.message;
      throw new Error(`No valid RCNA rows were produced${firstFailure ? `: ${firstFailure}` : ''}`);
    }

    await advanceStage('STAGING_RCNA');
    const rcnaArtifact = await stageRcnoaArtifact({
      mode: run.mode,
      nuid: run.requestedBy,
      runId: run.id,
      direction: 'output',
      fileName: buildRcnaFileName(run.inputFileName, currentBusinessDate),
      content: serializeRcnoaRecords(transformed.outboundRecords),
    });
    await createRcnoaArtifact(run.id, {
      ...rcnaArtifact,
      ownerNuid: run.mode === 'adhoc' ? run.requestedBy : null,
      direction: 'output',
      artifactType: 'outbound-rcna',
    }, 'rcnoa-worker');

    if (transformed.failures.length || transformed.blockedRows.length) {
      await advanceStage('STAGING_ERROR_REPORT');
      const report = `${[...transformed.failures, ...transformed.blockedRows]
        .sort((left, right) => left.sourceRowNumber - right.sourceRowNumber)
        .map((item) => `${item.sourceRowNumber}|${item.errorCode}|${item.message}`)
        .join('\r\n')}\r\n`;
      const reportArtifact = await stageRcnoaArtifact({
        mode: run.mode,
        nuid: run.requestedBy,
        runId: run.id,
        direction: 'output',
        fileName: buildRcnoaCompanionFileName(run.inputFileName, 'errors', 'txt'),
        content: report,
      });
      await createRcnoaArtifact(run.id, {
        ...reportArtifact,
        ownerNuid: run.mode === 'adhoc' ? run.requestedBy : null,
        direction: 'output',
        artifactType: 'error-report',
      }, 'rcnoa-worker');
    }

    if (!mockFixture) {
      await advanceStage('SAVING_PRIOR_RCNA');
      await savePriorRcnaRecords(
        run.id,
        transformed.workingRecords,
        reconciliationCycle,
        businessConfiguration.priorRcnaMatchKeySecret,
        'rcnoa-worker',
      );
    }
    await advanceStage('FINALIZING');
    const failed = transformed.failures.length;
    await transitionRcnoaRun(run.id, {
      fromStatuses: ['PROCESSING'],
      status: run.mode === 'scheduled' ? 'PROCESSING' : 'AWAITING_RCNA_REVIEW',
      currentStage: run.mode === 'scheduled' ? 'RCNA_STAGED' : 'AWAITING_RCNA_REVIEW',
      counts: {
        received: rcnoRecords.length,
        processed: rcnoRecords.length,
        succeeded: transformed.workingRecords.length,
        blocked: transformed.blockedRows.length,
        failed,
        rcnaWritten: transformed.outboundRecords.length,
        members834Written: 0,
        members834Skipped: 0,
      },
      actor: 'rcnoa-worker',
    });
  } catch (error) {
    await transitionRcnoaRun(run.id, {
      fromStatuses: ['PROCESSING'],
      status: 'ERROR',
      currentStage: 'ERROR',
      errorCode: 'RCNOA_PROCESSING_FAILED',
      errorSummary: errorSummary(error),
      actor: 'rcnoa-worker',
    });
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'processRcnoaRun',
        detail: { runId: run.id, error: errorSummary(error) },
      },
    }));
  }
}

export async function loadWorkingRcnaRecords(rcnaArtifact) {
  const rcnaText = await readRcnoaArtifactText(rcnaArtifact);
  return prepareUploadedRcnaPriorRecords(parseRcnaText(rcnaText));
}

export async function stage834FromRcnaArtifact({ run, rcnaArtifact, actor }) {
  const businessConfiguration = await getRcnoaBusinessConfiguration();
  if (businessConfiguration.skip834Creation) throw new Error('834 creation is disabled by configuration');
  if (!businessConfiguration.mappingApproved) throw new Error('834 mapping must be approved before generation');

  const workingRcnaRecords = await loadWorkingRcnaRecords(rcnaArtifact);
  const selectedRecords = selectRcnaRecordsFor834(workingRcnaRecords);
  if (!selectedRecords.length) {
    throw new Error('RCNA file contains no carrier-action rows eligible for 834 generation');
  }

  const x834Service = new RcnaTo834Service({
    envelope: businessConfiguration.envelope,
    intentByCode: businessConfiguration.intentByCode,
    relationshipMap: businessConfiguration.relationshipMap,
    addressLine3Handler: addressLine3Handler(businessConfiguration.addressLine3Mode),
  });
  const x834 = x834Service.transform({ workingRcnaRecords: selectedRecords });

  let storedArtifact = null;
  if (x834.x12) {
    const artifact = await stageRcnoaArtifact({
      mode: run.mode,
      nuid: run.requestedBy,
      runId: run.id,
      direction: 'output',
      fileName: buildRcnoaCompanionFileName(rcnaArtifact.fileName, '834', 'x12'),
      content: x834.x12,
      contentType: 'application/edi-x12',
    });
    storedArtifact = await createRcnoaArtifact(run.id, {
      ...artifact,
      ownerNuid: run.mode === 'adhoc' ? run.requestedBy : null,
      direction: 'output',
      artifactType: '834',
    }, actor);
  }

  let skippedArtifact = null;
  if (x834.skipped.length) {
    // Report original RCNA file row numbers, not positions within the selected subset.
    const rcnaRowByRecord = new Map(workingRcnaRecords.map((record, index) => [record, index + 1]));
    const content = serializeRcnoaRecords(x834.skipped.map((item) => [
      String(rcnaRowByRecord.get(selectedRecords[item.sourceRow - 1])),
      item.discrepancyFamily,
      item.sourceSide,
      item.missingFields.join(','),
      ...item.record,
    ]));
    const artifact = await stageRcnoaArtifact({
      mode: run.mode,
      nuid: run.requestedBy,
      runId: run.id,
      direction: 'output',
      fileName: buildRcnoaCompanionFileName(rcnaArtifact.fileName, '834-skipped', 'txt'),
      content,
    });
    skippedArtifact = await createRcnoaArtifact(run.id, {
      ...artifact,
      ownerNuid: run.mode === 'adhoc' ? run.requestedBy : null,
      direction: 'output',
      artifactType: SKIPPED_834_ARTIFACT_TYPE,
    }, actor);
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'stage834SkippedRecords',
        detail: { runId: run.id, skipped: x834.skipped.length, emitted: x834.counts.members },
      },
    }));
  }

  return {
    artifact: storedArtifact,
    skippedArtifact,
    counts: { ...x834.counts, skipped: x834.skipped.length },
    workingRcnaRecords,
  };
}