import { diagnoseRcnoaRow } from '../rcnoaDiagnosticService.js';

function rcnoRecord(overrides = {}) {
  const record = Array(73).fill('');
  record[0] = '01';
  Object.entries(overrides).forEach(([index, value]) => {
    record[Number(index)] = value;
  });
  return record;
}

function dependencies(overrides = {}) {
  return {
    businessDate: '20260915',
    getRcnoaBusinessConfiguration: jest.fn().mockResolvedValue({
      version: 7,
      n12Code: 'AE999',
      oracleCallTimeoutSeconds: 90,
      priorRcnaMatchKeySecret: 'test-secret-that-is-at-least-32-characters',
    }),
    loadRcnoaOracleLookups: jest.fn().mockResolvedValue({
      membershipRecords: [],
      recent834Records: [],
    }),
    loadPriorRcnaRecords: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('rcnoaDiagnosticService', () => {
  afterEach(() => jest.restoreAllMocks());

  test('processes one row into named, read-only diagnostic evidence', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const record = rcnoRecord({ 3: 'N', 5: '000321456' });
    const membership = Array(19).fill('');
    membership[0] = '321456';
    const deps = dependencies({
      loadRcnoaOracleLookups: jest.fn().mockResolvedValue({
        membershipRecords: [membership],
        recent834Records: [],
      }),
    });

    const diagnostic = await diagnoseRcnoaRow(record.join('|'), deps);

    expect(deps.loadRcnoaOracleLookups).toHaveBeenCalledWith({
      businessDate: '20260915',
      rcnoRecords: [record],
      callTimeoutSeconds: 90,
    });
    expect(deps.loadPriorRcnaRecords).toHaveBeenCalledWith(
      [record],
      '202609',
      'test-secret-that-is-at-least-32-characters',
    );
    expect(diagnostic).toMatchObject({
      businessDate: '20260915',
      reconciliationCycle: '202609',
      configurationVersion: 7,
      source: { fieldCount: 73 },
      output: { workingFieldCount: 78, outboundFieldCount: 78 },
      evidence: {
        membership: [{ candidateNumber: 1 }],
        recent834: [],
        priorRcna: [],
      },
    });
    expect(diagnostic.evidence.membership[0].fields[0]).toEqual({
      column: 1,
      name: 'kp_mrn',
      value: '321456',
      origin: 'source',
    });
    expect(diagnostic.source.fields[5]).toEqual({
      column: 6,
      name: 'MENR_Member_ID',
      value: '000321456',
      origin: 'source',
    });
    expect(diagnostic.output.serializedOutboundRow.split('|')).toHaveLength(78);
    expect(diagnostic.output.serializedDiagnosticRow.split('|')).toHaveLength(78);
    expect(diagnostic.output.serializedOutboundRow)
      .toBe(diagnostic.output.serializedDiagnosticRow);
    expect(diagnostic.decision.priority).toBe('1');
    expect(diagnostic.decision.priorityDisplay).toBe('1: Active Enrollment mismatch');
    expect(diagnostic.decision.code).toBe('0000');
    expect(diagnostic.decision.codeDisplay).toBe('0000');
    expect(diagnostic.output.serializedDiagnosticRow.split('|').slice(76)).toEqual(['', '0']);
    expect(diagnostic.trace.selectedRuleId).toBe(diagnostic.decision.ruleId);
  });

  test('bypasses B200 when prior RCNA decision reuse is disabled', async () => {
    const record = rcnoRecord({ 3: 'N', 5: 'MRN-1', 6: 'N' });
    const prior = [...record, '1', '0000', 'No Rules Applied', '', '4'];
    const deps = dependencies({
      getRcnoaBusinessConfiguration: jest.fn().mockResolvedValue({
        version: 8,
        n12Code: 'AE999',
        oracleCallTimeoutSeconds: 90,
        priorRcnaMatchKeySecret: 'test-secret-that-is-at-least-32-characters',
        reusePriorRcnaDecisions: false,
      }),
      loadPriorRcnaRecords: jest.fn().mockResolvedValue([prior]),
    });

    const diagnostic = await diagnoseRcnoaRow(record.join('|'), deps);

    expect(diagnostic.decision.ruleId).toBe('N0000');
    expect(diagnostic.decision.agingMonths).toBe('0');
    expect(deps.loadPriorRcnaRecords).not.toHaveBeenCalled();
    expect(diagnostic.trace.evaluations[1]).toMatchObject({
      ruleId: 'B200',
      outcome: 'failed',
      reason: 'Prior RCNA decision reuse is disabled',
    });
  });

  test('returns slash-delimited priority 3 displays and actions through diagnostics', async () => {
    const record = rcnoRecord({
      3: 'N', 5: 'MRN-1', 6: 'N', 7: 'PSHB-ANN', 9: 'I',
      61: 'PSHB-PAY', 63: 'I', 10: 'DOE', 13: 'JANE',
    });
    const membership = Array(19).fill('');
    membership[0] = 'MRN-1';
    membership[3] = 'JANE';
    membership[4] = 'DOE';
    const deps = dependencies({
      loadRcnoaOracleLookups: jest.fn().mockResolvedValue({
        membershipRecords: [membership],
        recent834Records: [],
      }),
    });

    const diagnostic = await diagnoseRcnoaRow(record.join('|'), deps);

    expect(diagnostic.decision).toMatchObject({
      ruleId: 'N1000/N2000',
      code: 'DM501/DM508',
      codeDisplay: 'DM501 Annuitant Number pending update/DM508 Payroll Office Number pending update',
      description: 'Carrier to update member field/Carrier to update member field',
    });
    expect(diagnostic.output.serializedOutboundRow.split('|').slice(74, 76))
      .toEqual([
        'DM501 Annuitant Number pending update/DM508 Payroll Office Number pending update',
        'Carrier to update member field/Carrier to update member field',
      ]);
  });

  test('drops a configured leading column before diagnostic processing', async () => {
    const record = rcnoRecord({ 3: 'M' });
    const deps = dependencies({
      getRcnoaBusinessConfiguration: jest.fn().mockResolvedValue({
        version: 9,
        n12Code: 'AE999',
        oracleCallTimeoutSeconds: 90,
        priorRcnaMatchKeySecret: 'test-secret-that-is-at-least-32-characters',
        ignoreFirstRcnoColumn: true,
      }),
    });

    const diagnostic = await diagnoseRcnoaRow(['', ...record].join('|'), deps);

    expect(diagnostic.source.fieldCount).toBe(73);
    expect(diagnostic.source.serializedRow.split('|')).toEqual(record);
    expect(diagnostic.decision.ruleId).toBe('A100');
  });

  test('drops configured first and last columns before diagnostic processing', async () => {
    const record = rcnoRecord({ 3: 'M' });
    const deps = dependencies({
      getRcnoaBusinessConfiguration: jest.fn().mockResolvedValue({
        version: 10,
        n12Code: 'AE999',
        oracleCallTimeoutSeconds: 90,
        priorRcnaMatchKeySecret: 'test-secret-that-is-at-least-32-characters',
        ignoreFirstRcnoColumn: true,
        ignoreLastRcnoColumn: true,
      }),
    });

    const diagnostic = await diagnoseRcnoaRow(
      ['ignored-first', ...record, 'ignored-last'].join('|'),
      deps,
    );

    expect(diagnostic.source.fieldCount).toBe(73);
    expect(diagnostic.source.serializedRow.split('|')).toEqual(record);
    expect(diagnostic.decision.ruleId).toBe('A100');
  });

  test('rejects multiple rows before loading lookups', async () => {
    const deps = dependencies();
    const row = rcnoRecord({ 3: 'M' }).join('|');

    await expect(diagnoseRcnoaRow(`${row}\r\n${row}`, deps))
      .rejects.toThrow('exactly one RCNO row');
    expect(deps.getRcnoaBusinessConfiguration).toHaveBeenCalledTimes(1);
    expect(deps.loadRcnoaOracleLookups).not.toHaveBeenCalled();
    expect(deps.loadPriorRcnaRecords).not.toHaveBeenCalled();
  });

  test('rejects an invalid field count after loading configuration', async () => {
    const deps = dependencies();

    await expect(diagnoseRcnoaRow('01|too|short', deps))
      .rejects.toThrow('exactly 73 columns');
    expect(deps.getRcnoaBusinessConfiguration).toHaveBeenCalledTimes(1);
  });
});
