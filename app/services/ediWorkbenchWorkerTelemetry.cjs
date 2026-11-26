const {
  isMainThread,
  resourceLimits,
  threadId,
} = require('node:worker_threads');

function toMb(bytes) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

function getMemoryTelemetry() {
  const memory = process.memoryUsage();

  return {
    pid: process.pid,
    threadId,
    isMainThread,
    workerResourceLimits: resourceLimits,
    processRssMb: toMb(memory.rss),
    workerHeapUsedMb: toMb(memory.heapUsed),
    workerHeapTotalMb: toMb(memory.heapTotal),
    workerExternalMb: toMb(memory.external),
    workerArrayBuffersMb: toMb(memory.arrayBuffers),
  };
}

function getRuntimeTelemetry(startTimeMs, startCpuUsage) {
  const cpuUsage = process.cpuUsage(startCpuUsage);

  return {
    elapsedMs: Date.now() - startTimeMs,
    cpuUserMs: Math.round(cpuUsage.user / 1000),
    cpuSystemMs: Math.round(cpuUsage.system / 1000),
    ...getMemoryTelemetry(),
  };
}

function progressTelemetry(event, overallJobPercent) {
  return {
    eventType: event?.['event-type'],
    runId: event?.['run-id'],
    isaIndex: event?.['isa-index'],
    subscriberIndex: event?.['subscriber-index'],
    subscriberCount: event?.['subscriber-count'] ?? event?.['processed-subscribers'],
    subscriberPercentComplete: event?.['percent-complete'],
    overallJobPercent,
    elapsedMs: event?.['elapsed-ms'],
  };
}

function shouldSampleSubscriberTelemetry(event, lastSampledCount, interval = 100) {
  if (event?.['event-type'] !== 'subscriber-completed') {
    return false;
  }
  const subscriberCount = Number(event['subscriber-count'] ?? event['processed-subscribers']);
  return Number.isInteger(subscriberCount)
    && subscriberCount > 0
    && subscriberCount % interval === 0
    && subscriberCount !== lastSampledCount;
}

function sanitizeSensitiveMetadata(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeSensitiveMetadata);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => ![
      'subscriber-ssn',
      'subscriber-key',
      'subscriberSsn',
      'subscriberKey',
    ].includes(key))
    .map(([key, entry]) => [key, sanitizeSensitiveMetadata(entry)]));
}

module.exports = {
  getMemoryTelemetry,
  getRuntimeTelemetry,
  progressTelemetry,
  sanitizeSensitiveMetadata,
  shouldSampleSubscriberTelemetry,
  toMb,
};
