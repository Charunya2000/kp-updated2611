import { allowlistEdiDiagnosticMetrics } from '../ediWorkbenchTelemetry.js';
import workerTelemetry from '../../services/ediWorkbenchWorkerTelemetry.cjs';

const {
  getMemoryTelemetry,
  progressTelemetry,
  sanitizeSensitiveMetadata,
  shouldSampleSubscriberTelemetry,
} = workerTelemetry;

describe('EDI Workbench telemetry privacy and scope', () => {
  test('labels process RSS separately from worker-local memory', () => {
    const telemetry = getMemoryTelemetry();

    expect(telemetry).toEqual(expect.objectContaining({
      pid: process.pid,
      threadId: expect.any(Number),
      isMainThread: expect.any(Boolean),
      workerResourceLimits: expect.any(Object),
      processRssMb: expect.any(Number),
      workerHeapUsedMb: expect.any(Number),
      workerHeapTotalMb: expect.any(Number),
      workerExternalMb: expect.any(Number),
      workerArrayBuffersMb: expect.any(Number),
    }));
    expect(telemetry).not.toHaveProperty('memoryRssMb');
  });

  test('builds progress telemetry from allowlisted non-sensitive fields', () => {
    const telemetry = progressTelemetry({
      'event-type': 'subscriber-completed',
      'run-id': 'run-1',
      'isa-index': 2,
      'subscriber-index': 100,
      'subscriber-count': 100,
      'percent-complete': 20,
      'elapsed-ms': 5000,
      'subscriber-ssn': '111111111',
      'subscriber-key': 'secret-key',
    }, 66);

    expect(telemetry).toEqual({
      eventType: 'subscriber-completed',
      runId: 'run-1',
      isaIndex: 2,
      subscriberIndex: 100,
      subscriberCount: 100,
      subscriberPercentComplete: 20,
      overallJobPercent: 66,
      elapsedMs: 5000,
    });
    expect(JSON.stringify(telemetry)).not.toMatch(/111111111|secret-key|subscriber-ssn|subscriber-key/);
  });

  test('does not spread raw or normalized subscriber identity into logs', () => {
    const result = allowlistEdiDiagnosticMetrics({
      eventType: 'subscriber-heartbeat',
      subscriberIndex: 3,
      subscriberPercentComplete: 12,
      overallJobPercent: 63,
      processRssMb: 512,
      subscriberSsn: '111111111',
      subscriberKey: 'normalized-secret',
      'subscriber-ssn': '222222222',
      'subscriber-key': 'raw-secret',
      futureSensitiveField: 'do-not-log',
    });

    expect(result).toEqual({
      eventType: 'subscriber-heartbeat',
      subscriberIndex: 3,
      subscriberPercentComplete: 12,
      overallJobPercent: 63,
      processRssMb: 512,
    });
  });

  test('removes subscriber identity recursively from exception metadata', () => {
    const result = sanitizeSensitiveMetadata({
      code: 'LOOKUP_FAILED',
      nested: {
        'subscriber-ssn': '111111111',
        subscriberKey: 'secret',
        safe: true,
      },
    });

    expect(result).toEqual({ code: 'LOOKUP_FAILED', nested: { safe: true } });
  });

  test('samples memory only at fixed completed-subscriber intervals', () => {
    expect(shouldSampleSubscriberTelemetry({
      'event-type': 'subscriber-heartbeat',
      'subscriber-count': 100,
    }, 0)).toBe(false);
    expect(shouldSampleSubscriberTelemetry({
      'event-type': 'subscriber-completed',
      'subscriber-count': 99,
    }, 0)).toBe(false);
    expect(shouldSampleSubscriberTelemetry({
      'event-type': 'subscriber-completed',
      'subscriber-count': 100,
    }, 0)).toBe(true);
    expect(shouldSampleSubscriberTelemetry({
      'event-type': 'subscriber-completed',
      'subscriber-count': 100,
    }, 100)).toBe(false);
    expect(shouldSampleSubscriberTelemetry({
      'event-type': 'subscriber-completed',
      'processed-subscribers': 500,
    }, 400)).toBe(true);
  });
});