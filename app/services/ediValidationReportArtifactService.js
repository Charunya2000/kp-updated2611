import crypto from 'node:crypto';
import ExcelJS from 'exceljs-hardened';
import {
  generateTemporaryDownloadLink,
  writeFileBufferToBlobStorage,
} from './blobStorageService.js';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const DEFAULT_CONTAINER_NAME = 'validation-reports';
const DEFAULT_SAS_LIFETIME_MINUTES = 10;

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function asText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function styleWorksheet(worksheet) {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount },
  };
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
}

export async function createValidationWorkbook(report, metadata = {}) {
  if (!report || typeof report !== 'object') {
    throw new Error('A validation report is required to create the workbook');
  }

  const validationSummary = report['validation-summary'] || {};
  const reportDetails = report.report || {};
  const validation = reportDetails.validation || {};
  const lookup = validationSummary.lookup || reportDetails['lookup-summary'] || validation.lookup || {};
  const subscriberStatuses = report['subscriber-statuses'] || reportDetails['subscriber-statuses'] || [];
  const invalidFindings = report['invalid-findings'] || [];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EDI Workbench';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 34 },
    { header: 'Value', key: 'value', width: 48 },
  ];
  const summaryRows = [
    ['Total', firstDefined(validationSummary.total, validation.total, 0)],
    ['Passed', firstDefined(validationSummary.passed, validation.passed, 0)],
    ['Failed', firstDefined(validationSummary.failed, validation.failed, 0)],
    ['DB Lookup Total', firstDefined(lookup.total, lookup.attempted, 0)],
    ['DB Lookup Passed', firstDefined(lookup.passed, 0)],
    ['DB Lookup Failed', firstDefined(lookup.failed, 0)],
    ['DB Lookup Skipped', firstDefined(lookup.skipped, lookup['no-spec'], 0)],
    ['Run Identifier', asText(firstDefined(reportDetails['run-id'], metadata.runId))],
    ['Started At', asText(firstDefined(reportDetails['started-at'], metadata.startedAt))],
    ['Completed At', asText(firstDefined(reportDetails['completed-at'], metadata.completedAt))],
    ['EDI Input', asText(metadata.ediDisplayName)],
    ['Companion Guide Input', asText(metadata.companionDisplayName)],
  ];
  summarySheet.addRows(summaryRows.map(([metric, value]) => ({ metric, value })));
  for (const rowNumber of [9, 10, 11, 12, 13]) {
    summarySheet.getCell(rowNumber, 2).numFmt = '@';
  }
  styleWorksheet(summarySheet);

  const findingsSheet = workbook.addWorksheet('Invalid Findings');
  findingsSheet.columns = [
    { header: 'Subscriber Index', key: 'subscriberIndex', width: 18 },
    { header: 'Subscriber Key', key: 'subscriberKey', width: 24 },
    { header: 'Segment', key: 'segment', width: 14 },
    { header: 'Reference', key: 'reference', width: 16 },
    { header: 'Failed Value', key: 'failedValue', width: 24 },
    { header: 'Reason', key: 'reason', width: 60 },
    { header: 'Loop Name', key: 'loopName', width: 20 },
    { header: 'Loop Description', key: 'loopDescription', width: 40 },
  ];
  findingsSheet.addRows(invalidFindings.map((finding) => ({
    subscriberIndex: asText(firstDefined(finding['subscriber-index'], finding.subscriberIndex)),
    subscriberKey: asText(firstDefined(
      finding['subscriber-key'],
      finding.subscriberKey,
      finding['subscriber-ssn'],
      finding.subscriberSsn,
    )),
    segment: asText(finding.segment),
    reference: asText(firstDefined(finding.ref, finding.reference)),
    failedValue: asText(firstDefined(finding['failed-value'], finding.failedValue)),
    reason: asText(finding.reason),
    loopName: asText(firstDefined(finding['loop-name'], finding.loopName)),
    loopDescription: asText(firstDefined(finding['loop-description'], finding.loopDescription)),
  })));
  findingsSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => { cell.numFmt = '@'; });
    }
  });
  styleWorksheet(findingsSheet);

  const statusesSheet = workbook.addWorksheet('Subscriber Statuses');
  statusesSheet.columns = [
    { header: 'Subscriber Index', key: 'subscriberIndex', width: 18 },
    { header: 'Subscriber Key', key: 'subscriberKey', width: 24 },
    { header: 'Status', key: 'status', width: 22 },
    { header: 'Structural Total', key: 'structureTotal', width: 18 },
    { header: 'Structural Passed', key: 'structurePassed', width: 20 },
    { header: 'Structural Failed', key: 'structureFailed', width: 20 },
    { header: 'DB Attempted', key: 'dbAttempted', width: 16 },
    { header: 'DB Passed', key: 'dbPassed', width: 14 },
    { header: 'DB Failed', key: 'dbFailed', width: 14 },
    { header: 'DB Skipped', key: 'dbSkipped', width: 14 },
    { header: 'Started At', key: 'startedAt', width: 26 },
    { header: 'Completed At', key: 'completedAt', width: 26 },
  ];
  statusesSheet.addRows(subscriberStatuses.map((status) => ({
    subscriberIndex: asText(firstDefined(status['subscriber-index'], status.subscriberIndex)),
    subscriberKey: asText(firstDefined(
      status['subscriber-key'],
      status.subscriberKey,
      status['subscriber-ssn'],
      status.subscriberSsn,
    )),
    status: asText(status.status),
    structureTotal: Number(firstDefined(status['structure-total'], status.structureTotal, 0)),
    structurePassed: Number(firstDefined(status['structure-passed'], status.structurePassed, 0)),
    structureFailed: Number(firstDefined(status['structure-failed'], status.structureFailed, 0)),
    dbAttempted: Number(firstDefined(status['db-attempted'], status.dbAttempted, 0)),
    dbPassed: Number(firstDefined(status['db-passed'], status.dbPassed, 0)),
    dbFailed: Number(firstDefined(status['db-failed'], status.dbFailed, 0)),
    dbSkipped: Number(firstDefined(status['db-skipped'], status.dbSkipped, 0)),
    startedAt: asText(firstDefined(status['started-at'], status.startedAt)),
    completedAt: asText(firstDefined(status['completed-at'], status.completedAt)),
  })));
  statusesSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      for (const columnNumber of [1, 2, 3, 11, 12]) {
        row.getCell(columnNumber).numFmt = '@';
      }
    }
  });
  styleWorksheet(statusesSheet);

  return workbook;
}

function getStorageConfiguration() {
  const requestedLifetime = Number.parseInt(
    process.env.EDI_VALIDATION_REPORT_SAS_MINUTES || String(DEFAULT_SAS_LIFETIME_MINUTES),
    10,
  );
  const sasLifetimeMinutes = Number.isFinite(requestedLifetime)
    ? Math.min(15, Math.max(5, requestedLifetime))
    : DEFAULT_SAS_LIFETIME_MINUTES;

  return {
    containerName: process.env.EDI_VALIDATION_REPORT_CONTAINER || DEFAULT_CONTAINER_NAME,
    sasLifetimeMinutes,
  };
}

function buildTenantSegment(tenantId) {
  return crypto.createHash('sha256').update(String(tenantId || 'default')).digest('hex').slice(0, 24);
}

function buildBlobPrefix({ tenantId, runId }) {
  const safeRunId = String(runId || crypto.randomUUID()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  return `${buildTenantSegment(tenantId)}/${safeRunId || crypto.randomUUID()}/${crypto.randomUUID()}`;
}

export async function createValidationReportArtifact({ report, tenantId, runId, ediDisplayName, companionDisplayName }) {
  const { containerName, sasLifetimeMinutes } = getStorageConfiguration();
  const prefix = buildBlobPrefix({ tenantId, runId });
  const workbookBlobName = `${prefix}/validation-report.xlsx`;
  const jsonBlobName = `${prefix}/validation-report.json`;
  const completedAt = new Date().toISOString();
  const workbook = await createValidationWorkbook(report, {
    runId,
    startedAt: report?.report?.['started-at'],
    completedAt,
    ediDisplayName,
    companionDisplayName,
  });
  const workbookBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const jsonBuffer = Buffer.from(JSON.stringify(report, null, 2), 'utf8');

  const workbookUploaded = await writeFileBufferToBlobStorage(
    workbookBuffer,
    containerName,
    workbookBlobName,
    XLSX_CONTENT_TYPE,
  );
  const jsonUploaded = await writeFileBufferToBlobStorage(
    jsonBuffer,
    containerName,
    jsonBlobName,
    JSON_CONTENT_TYPE,
  );
  if (!workbookUploaded || !jsonUploaded) {
    throw new Error('Failed to upload validation report artifacts');
  }

  const downloadUrl = await generateTemporaryDownloadLink(
    containerName,
    workbookBlobName,
    sasLifetimeMinutes,
  );
  const expiresAt = new Date(Date.now() + sasLifetimeMinutes * 60 * 1000).toISOString();

  return {
    downloadUrl,
    expiresAt,
    fileName: 'validation-report.xlsx',
    contentType: XLSX_CONTENT_TYPE,
    containerName,
    blobName: workbookBlobName,
    jsonBlobName,
  };
}

export async function refreshValidationReportDownload({ containerName, blobName }) {
  const { containerName: configuredContainer, sasLifetimeMinutes } = getStorageConfiguration();
  if (containerName !== configuredContainer) {
    throw new Error('Validation report container is not authorized');
  }

  return {
    downloadUrl: await generateTemporaryDownloadLink(containerName, blobName, sasLifetimeMinutes),
    expiresAt: new Date(Date.now() + sasLifetimeMinutes * 60 * 1000).toISOString(),
    fileName: 'validation-report.xlsx',
    contentType: XLSX_CONTENT_TYPE,
  };
}
