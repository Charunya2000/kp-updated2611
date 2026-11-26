const ALLOWED_EDI_TELEMETRY_FIELDS = [
  'eventType',
  'runId',
  'isaIndex',
  'subscriberIndex',
  'subscriberCount',
  'subscriberPercentComplete',
  'overallJobPercent',
  'elapsedMs',
  'cpuUserMs',
  'cpuSystemMs',
  'pid',
  'threadId',
  'isMainThread',
  'workerResourceLimits',
  'processRssMb',
  'workerHeapUsedMb',
  'workerHeapTotalMb',
  'workerExternalMb',
  'workerArrayBuffersMb',
];

export function allowlistEdiDiagnosticMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return {};
  }

  return Object.fromEntries(ALLOWED_EDI_TELEMETRY_FIELDS
    .filter((field) => metrics[field] !== undefined)
    .map((field) => [field, metrics[field]]));
}
