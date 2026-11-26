import { execFileSync } from 'node:child_process';

function invokeService(operation, value, envOverrides = {}) {
  const script = `
    const service = await import('./app/services/ediWorkbenchService.js');
    const input = JSON.parse(process.env.EDI_WORKBENCH_TEST_INPUT);
    let result;
    if (input.operation === 'collect') {
      result = service.collectValidationFindings(input.value);
    } else if (input.operation === 'extract') {
      result = service.extractFailedValueFromNode(input.value);
    } else if (input.operation === 'normalizeOptions') {
      result = service.normalizeEdiParseOptions(input.value);
    } else if (input.operation === 'sanitizeWorkerResult') {
      result = service.sanitizeEdiWorkbenchWorkerResult(input.value);
    } else if (input.operation === 'normalizeCompactFindings') {
      result = service.normalizeCompactInvalidFindings(input.value);
    } else if (input.operation === 'normalizeProgress') {
      result = service.normalizeEfssProgressEvent(input.value);
    } else if (input.operation === 'assertCapabilities') {
      service.assertEfssBoundedMemoryCapabilities(input.value);
      result = { supported: true };
    } else if (input.operation === 'buildEfssOptions') {
      result = service.buildEfssValidationOptions(input.value.base, input.value.effective);
    } else if (input.operation === 'normalizeFinding') {
      result = service.normalizeFinding(input.value);
    } else if (input.operation === 'compactWorkerResult') {
      result = service.buildCompactEdiWorkbenchWorkerResult(input.value.result, input.value.runId);
    } else if (input.operation === 'dbTelemetry') {
      result = service.dbValidationTelemetry(input.value);
    } else if (input.operation === 'assertDbTelemetry') {
      result = service.assertDbValidationTelemetry(input.value.result, input.value.enabled);
    } else if (input.operation === 'assertCollectionTelemetry') {
      service.assertStrictCollectionTelemetry(input.value);
      result = { supported: true };
    } else {
      throw new Error(\`Unknown test operation: \${input.operation}\`);
    }
    process.stdout.write(JSON.stringify(result));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      ...envOverrides,
      EDI_WORKBENCH_TEST_INPUT: JSON.stringify({ operation, value }),
    },
  });

  return JSON.parse(output);
}

function collectValidationFindings(value) {
  return invokeService('collect', value);
}

function extractFailedValueFromNode(value) {
  return invokeService('extract', value);
}

function invalidAnnotation(overrides = {}) {
  return {
    valid: false,
    'invalid-description': 'Validation failed',
    'segment-ref': 'REF02',
    value: '100',
    'value-provided?': true,
    ...overrides,
  };
}

function subscriberNode(ssn, annotation) {
  return [
    'ins_subscriber',
    ['raw_segment', `REF*0F*${ssn}`],
    annotation,
  ];
}

function firstFinding(value) {
  return collectValidationFindings(value).invalidElements[0];
}

describe('EDI Workbench subscriber identity normalization', () => {
  test('prefers top-level subscriber identity for guide-validation failures', () => {
    const finding = firstFinding(subscriberNode('999999999', invalidAnnotation({
      'subscriber-index': 7,
      'subscriber-ssn': '111111111',
      lookup: {
        'subscriber-index': 3,
        'subscriber-ssn': '222222222',
      },
    })));

    expect(finding).toEqual(expect.objectContaining({
      subscriberIndex: 7,
      subscriberSsn: '111111111',
    }));
  });

  test('preserves top-level identity for a DB miss', () => {
    const finding = firstFinding(subscriberNode('333333333', invalidAnnotation({
      'subscriber-index': 2,
      'subscriber-ssn': '333333333',
      lookup: { status: 'db-miss', valid: false },
    })));

    expect(finding).toEqual(expect.objectContaining({
      subscriberIndex: 2,
      subscriberSsn: '333333333',
    }));
  });

  test('preserves identity when a conditional lookup is skipped', () => {
    const finding = firstFinding(subscriberNode('444444444', invalidAnnotation({
      'subscriber-index': 4,
      'subscriber-ssn': '444444444',
      lookup: { status: 'condition-not-matched', valid: true },
    })));

    expect(finding).toEqual(expect.objectContaining({
      subscriberIndex: 4,
      subscriberSsn: '444444444',
    }));
  });

  test('leaves errors without subscriber context at transaction level', () => {
    const finding = firstFinding(invalidAnnotation());

    expect(finding).toEqual(expect.objectContaining({
      subscriberIndex: null,
      subscriberSsn: null,
    }));
  });

  test('preserves loop identity in direct non-streaming findings', () => {
    const finding = firstFinding(invalidAnnotation({
      loopName: '1000B',
      'loop-description': 'Payer',
      'segment-description': 'N1',
    }));

    expect(finding).toEqual(expect.objectContaining({
      segment: 'N1',
      loopName: '1000B',
      loopDescription: 'Payer',
    }));
  });

  test('supports older annotations with only a nested lookup index', () => {
    const finding = firstFinding(subscriberNode('555555555', invalidAnnotation({
      lookup: { 'subscriber-index': 1 },
    })));

    expect(finding).toEqual(expect.objectContaining({
      subscriberIndex: 1,
      subscriberSsn: '555555555',
    }));
  });

  test('associates errors from multiple INS nodes with the correct subscriber', () => {
    const findings = collectValidationFindings([
      'transaction_set',
      subscriberNode('111111111', invalidAnnotation()),
      subscriberNode('222222222', invalidAnnotation()),
    ]).invalidElements;

    expect(findings.map(({ subscriberIndex, subscriberSsn }) => ({ subscriberIndex, subscriberSsn }))).toEqual([
      { subscriberIndex: 1, subscriberSsn: '111111111' },
      { subscriberIndex: 2, subscriberSsn: '222222222' },
    ]);
  });

  test('keeps failed EDI value behavior unchanged', () => {
    const annotation = invalidAnnotation({ value: 'P00' });
    const finding = firstFinding(subscriberNode('666666666', annotation));

    expect(extractFailedValueFromNode(annotation)).toBe('P00');
    expect(finding).toEqual(expect.objectContaining({
      failedValue: 'P00',
      valueProvided: true,
    }));
  });
});

describe('EDI Workbench EFS-S output controls', () => {
  test('forces strict streaming options, omits both trees, and disables memory logging by default', () => {
    const result = invokeService('normalizeOptions', {
      dbValidation: true,
      subscriberOnlyDbValidation: true,
      includeParsed: true,
      includeEnriched: false,
      logMemory: true,
    }, { EFSS_LOG_MEMORY: 'false' });

    expect(result).toEqual(expect.objectContaining({
      streaming: true,
      includeParsed: false,
      includeEnriched: false,
      collectInvalidFindings: false,
      collectSubscriberStatuses: false,
      findingBatchSize: 250,
      subscriberBatchSize: 1,
      logMemory: false,
      dbValidation: true,
      subscriberOnlyDbValidation: true,
      singleQueryDbValidation: true,
      compareSingleQueryVsLegacy: false,
    }));
  });

  test('does not allow callers to disable strict streaming', () => {
    const result = invokeService('normalizeOptions', { streaming: false });

    expect(result.streaming).toBe(true);
  });

  test('enables EFS-S memory logging only through EFSS_LOG_MEMORY', () => {
    const result = invokeService('normalizeOptions', {}, { EFSS_LOG_MEMORY: 'true' });

    expect(result.logMemory).toBe(true);
  });

  test.each([10, 25, 100])('accepts subscriber batch size %i', (subscriberBatchSize) => {
    const result = invokeService('normalizeOptions', { subscriberBatchSize });

    expect(result.subscriberBatchSize).toBe(subscriberBatchSize);
  });

  test('passes DB and subscriber batch options unchanged with strict EFS-S controls', () => {
    const effective = invokeService('normalizeOptions', {
      dbValidation: true,
      subscriberOnlyDbValidation: true,
      subscriberBatchSize: 25,
    });
    const result = invokeService('buildEfssOptions', {
      base: { validationScope: { mode: 'all-subscribers' }, heartbeatEveryDbAttempts: 10 },
      effective,
    });

    expect(result).toEqual(expect.objectContaining({
      subscriberBatchSize: 25,
      streaming: true,
      includeParsed: false,
      includeEnriched: false,
      collectInvalidFindings: false,
      collectSubscriberStatuses: false,
      findingBatchSize: 250,
      dbValidation: true,
      subscriberOnlyDbValidation: true,
      singleQueryDbValidation: true,
      compareSingleQueryVsLegacy: false,
    }));
  });

  test('forces subscriber-only single-query mode for DB-enabled validation', () => {
    const result = invokeService('normalizeOptions', {
      dbValidation: true,
      subscriberOnlyDbValidation: false,
      singleQueryDbValidation: false,
      compareSingleQueryVsLegacy: true,
    });

    expect(result).toEqual(expect.objectContaining({
      dbValidation: true,
      subscriberOnlyDbValidation: true,
      singleQueryDbValidation: true,
      compareSingleQueryVsLegacy: false,
    }));
  });

  test('extracts DB execution telemetry from the completed EFS-S report', () => {
    expect(invokeService('dbTelemetry', {
      report: {
        'single-query-db-validation-enabled': true,
        'subscriber-batch-size': 25,
        'single-query-prefetch-summary': { batches: 4, rows: 100 },
      },
    })).toEqual({
      singleQueryDbValidationEnabled: true,
      subscriberBatchSize: 25,
      singleQueryPrefetchSummary: { batches: 4, rows: 100 },
    });
  });

  test('fails clearly when a DB-enabled report does not confirm single-query mode', () => {
    expect(() => invokeService('assertDbTelemetry', {
      enabled: true,
      result: { report: { 'single-query-db-validation-enabled': false } },
    })).toThrow(/DB validation did not use EFS-S single-query mode/);
  });

  test('does not require single-query confirmation when DB validation is disabled', () => {
    expect(invokeService('assertDbTelemetry', {
      enabled: false,
      result: { report: { 'single-query-db-validation-enabled': false } },
    })).toEqual({ singleQueryDbValidationEnabled: false });
  });

  test('requires both strict collection controls in the completed report', () => {
    expect(invokeService('assertCollectionTelemetry', {
      report: {
        'invalid-findings-collected': false,
        'subscriber-statuses-collected': false,
      },
    })).toEqual({ supported: true });

    expect(() => invokeService('assertCollectionTelemetry', {
      report: {
        'invalid-findings-collected': true,
        'subscriber-statuses-collected': false,
      },
    })).toThrow(/did not honor bounded-memory collection controls/);
  });

  test.each(['', 'ten', 2.5, 0, -1])('rejects invalid subscriber batch size %p', (subscriberBatchSize) => {
    expect(() => invokeService('normalizeOptions', { subscriberBatchSize })).toThrow(
      /Subscribers per batch must be a positive integer/,
    );
  });

  test('removes all parsed and enriched tree aliases from worker results', () => {
    const result = invokeService('sanitizeWorkerResult', {
      summary: { valid: 1, invalid: 1, unknown: 0 },
      invalidElements: [{ ref: 'REF02' }],
      subscriberStatuses: [{ subscriberSsn: '111111111' }],
      executionContext: { lookupStats: { total: 1, applied: 1 } },
      parsed: { large: true },
      parseTree: { large: true },
      enriched: { large: true },
      enrichedResult: { large: true },
      annotatedTree: { large: true },
      canonicalValidationReport: { private: true },
    });

    expect(result).toEqual({
      summary: { valid: 1, invalid: 1, unknown: 0 },
      executionContext: { lookupStats: { total: 1, applied: 1 } },
    });
  });

  test('preserves compact finding values without truthiness coercion', () => {
    const result = invokeService('normalizeCompactFindings', {
      invalidFindings: [{
        path: '',
        reason: '',
        failedValue: 0,
        'value-provided': false,
        segment: 'REF',
        ref: 'REF02',
        name: 'Identifier',
        loopName: '1000A',
        'loop-description': 'Submitter',
        locatorTrail: ['Loop 2000', 'Segment REF'],
        subscriberIndex: 0,
        subscriberSsn: '',
        isaIndex: 1,
      }],
    });

    expect(result).toEqual([{
      path: '',
      reason: '',
      failedValue: 0,
      valueProvided: false,
      segment: 'REF',
      ref: 'REF02',
      name: 'Identifier',
      loopName: '1000A',
      loopDescription: 'Submitter',
      locatorTrail: ['Loop 2000', 'Segment REF'],
      subscriberIndex: 0,
      subscriberSsn: '',
      isaIndex: 1,
    }]);
  });

  test('normalizes raw loop identity keys without deriving them from repeated segments', () => {
    const result = invokeService('normalizeCompactFindings', {
      'invalid-findings': [
        { segment: 'N1', ref: 'N101', 'loop-name': '1000A', 'loop-description': 'Submitter' },
        { segment: 'N1', ref: 'N101', 'loop-name': '1000B', 'loop-description': 'Payer' },
      ],
    });

    expect(result.map(({ segment, ref, loopName, loopDescription }) => ({
      segment,
      ref,
      loopName,
      loopDescription,
    }))).toEqual([
      { segment: 'N1', ref: 'N101', loopName: '1000A', loopDescription: 'Submitter' },
      { segment: 'N1', ref: 'N101', loopName: '1000B', loopDescription: 'Payer' },
    ]);
  });

  test('fails clearly when compact findings are unavailable', () => {
    expect(() => invokeService('normalizeCompactFindings', {
      enriched: { legacy: true },
    })).toThrow(/does not support bounded-memory streaming/);
  });

  test('accepts a raw library with all bounded-memory capabilities', () => {
    expect(invokeService('assertCapabilities', {
      streaming: true,
      subscriberBoundedStreaming: true,
      subscriberBatching: true,
      defaultSubscriberBatchSize: 1,
      compactInvalidFindings: true,
      subscriberStatusCollectionControl: true,
      findingBatchEvents: true,
      isaProgressEvents: true,
      treeOutputControls: true,
    })).toEqual({ supported: true });
  });

  test.each([
    ['streaming', { streaming: false }],
    ['subscriber-bounded streaming', { subscriberBoundedStreaming: false }],
    ['subscriber batching', { subscriberBatching: false }],
    ['default subscriber batch size', { defaultSubscriberBatchSize: 2 }],
    ['compact findings', { compactInvalidFindings: false }],
    ['subscriber status collection control', { subscriberStatusCollectionControl: false }],
    ['finding batches', { findingBatchEvents: false }],
    ['ISA progress', { isaProgressEvents: false }],
    ['tree output controls', { treeOutputControls: false }],
  ])('fails clearly when the raw library lacks %s support', (_label, capabilities) => {
    const supportedCapabilities = {
      streaming: true,
      subscriberBoundedStreaming: true,
      subscriberBatching: true,
      defaultSubscriberBatchSize: 1,
      compactInvalidFindings: true,
      subscriberStatusCollectionControl: true,
      findingBatchEvents: true,
      isaProgressEvents: true,
      treeOutputControls: true,
      ...capabilities,
    };

    expect(() => invokeService('assertCapabilities', supportedCapabilities)).toThrow(
      /raw library lacks memory-efficient Workbench support/,
    );
  });

  test('normalizes kebab-case findings without truthiness inference', () => {
    expect(invokeService('normalizeFinding', {
      path: 'ISA/GS/ST/REF02',
      reason: 'Required',
      'failed-value': '',
      'value-provided': false,
      segment: 'REF',
      ref: 'REF02',
      name: 'Identifier',
      'loop-name': '2000',
      'loop-description': 'Member',
      'locator-trail': ['Loop 2000', 'REF'],
      'subscriber-index': 4,
      'subscriber-ssn': '111111111',
      'isa-index': 2,
    })).toEqual({
      path: 'ISA/GS/ST/REF02',
      reason: 'Required',
      failedValue: '',
      valueProvided: false,
      segment: 'REF',
      ref: 'REF02',
      name: 'Identifier',
      loopName: '2000',
      loopDescription: 'Member',
      locatorTrail: ['Loop 2000', 'REF'],
      subscriberIndex: 4,
      subscriberSsn: '111111111',
      isaIndex: 2,
    });
  });

  test('builds a compact final worker message without result roots or retained arrays', () => {
    const result = invokeService('compactWorkerResult', {
      runId: 'run-1',
      result: {
        x12Validation: { total: 2, passed: 1, failed: 1 },
        executionContext: {
          parseOptions: {
            dbValidation: true,
            subscriberOnlyDbValidation: true,
            singleQueryDbValidation: true,
          },
        },
        invalidElements: [{ ref: 'REF02' }],
        subscriberStatuses: [{ status: 'completed-failed' }],
        parsed: { large: true },
        enriched: { large: true },
        canonicalValidationReport: {
          'validation-summary': { total: 2, passed: 1, failed: 1 },
          'invalid-findings': [{ ref: 'REF02' }],
          'subscriber-statuses': [{ status: 'completed-failed' }],
          report: {
            validation: { total: 2, passed: 1, failed: 1 },
            'subscriber-progress-summary': { total: 1, 'completed-failed': 1 },
            'subscriber-batch-size': 10,
            'single-query-db-validation-enabled': true,
            'single-query-prefetch-summary': { batches: 1 },
            'invalid-findings-collected': false,
            'subscriber-statuses-collected': false,
          },
        },
      },
    });

    expect(result).toEqual({
      type: 'validation-completed',
      runId: 'run-1',
      validationSummary: { total: 2, passed: 1, failed: 1 },
      report: {
        validation: { total: 2, passed: 1, failed: 1 },
        subscriberProgressSummary: { total: 1, 'completed-failed': 1 },
        subscriberBatchSize: 10,
        singleQueryDbValidationEnabled: true,
        singleQueryPrefetchSummary: { batches: 1 },
        invalidFindingsCollected: false,
        subscriberStatusesCollected: false,
      },
      effectiveParseOptions: {
        dbValidation: true,
        subscriberOnlyDbValidation: true,
        singleQueryDbValidation: true,
      },
    });
    expect(result).not.toHaveProperty('invalidElements');
    expect(result).not.toHaveProperty('subscriberStatuses');
    expect(result).not.toHaveProperty('parsed');
    expect(result).not.toHaveProperty('enriched');
  });

  test('forwards ISA progress with null totals and unknown additive fields', () => {
    const event = {
      'event-type': 'isa-started',
      'isa-index': 2,
      'total-isas': null,
      futureField: 'preserved',
    };
    const result = invokeService('normalizeProgress', event);

    expect(result).toEqual({
      overallJobPercent: 58,
      step: 'Processing ISA 2',
      details: {
        subscriberProgress: null,
        isaProgress: event,
      },
    });
  });

  test('keeps existing subscriber progress events compatible', () => {
    const event = {
      'event-type': 'subscriber-completed',
      'subscriber-index': 3,
      'processed-subscribers': 3,
      'total-subscribers': 10,
      'percent-complete': 30,
      status: 'passed',
    };
    const result = invokeService('normalizeProgress', event);

    expect(result.details).toEqual({
      subscriberProgress: event,
      isaProgress: null,
    });
    expect(result.step).toBe('Validating subscriber 3 (3/10) - passed');
  });

  test('keeps UI-visible output and subscriber progress equivalent across batch sizes', () => {
    const compactResult = {
      validationSummary: { total: 2, passed: 1, failed: 1 },
      subscriberStatuses: [
        { subscriberIndex: 1, status: 'passed' },
        { subscriberIndex: 2, status: 'failed' },
      ],
      invalidFindings: [{ subscriberIndex: 2, ref: 'REF02', reason: 'Invalid value' }],
      report: { validation: { total: 2, passed: 1, failed: 1 } },
      metrics: { processedSubscribers: 2 },
    };
    const progressEvents = [1, 2].map((subscriberIndex) => ({
      'event-type': 'subscriber-completed',
      'subscriber-index': subscriberIndex,
      'processed-subscribers': subscriberIndex,
      'total-subscribers': 2,
    }));

    const normalizeConsumerView = (subscriberBatchSize) => ({
      subscriberBatchSize,
      result: invokeService('sanitizeWorkerResult', compactResult),
      progress: progressEvents.map((event) => invokeService('normalizeProgress', event).details.subscriberProgress),
    });
    const batchOne = normalizeConsumerView(1);
    const batchTwentyFive = normalizeConsumerView(25);

    expect(batchTwentyFive.result).toEqual(batchOne.result);
    expect(batchTwentyFive.progress).toEqual(batchOne.progress);
    expect(batchTwentyFive.result).not.toHaveProperty('parsed');
    expect(batchTwentyFive.result).not.toHaveProperty('enriched');
  });
});
