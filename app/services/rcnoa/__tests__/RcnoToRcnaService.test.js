import { parseRcnoText, serializeRcnoaRecords } from '../rcnoaCore';
import { formatNoticeCodeDisplay, formatPriorityDisplay } from '../rcnoaDecisionDisplay.js';
import { RcnoToRcnaService } from '../RcnoToRcnaService';

function rcnoRecord(overrides = {}) {
  const record = Array(73).fill('');
  record[0] = '01';
  Object.entries(overrides).forEach(([index, value]) => {
    record[Number(index)] = value;
  });
  return record;
}

function membershipRecord(overrides = {}) {
  const record = Array(25).fill('');
  Object.entries(overrides).forEach(([index, value]) => {
    record[Number(index)] = value;
  });
  return record;
}

function recent834Record(ssn, start, end, processed) {
  return [ssn, start, end, processed];
}

describe('RcnoToRcnaService', () => {
  const originalLocalTesting = process.env.RCNOA_LOCAL_TESTING;
  const originalValidateLookupDuplicates = process.env.RCNOA_VALIDATE_LOOKUP_DUPLICATES;
  const originalReusePriorRcnaDecisions = process.env.RCNOA_REUSE_PRIOR_RCNA_DECISIONS;

  afterEach(() => {
    if (originalLocalTesting === undefined) delete process.env.RCNOA_LOCAL_TESTING;
    else process.env.RCNOA_LOCAL_TESTING = originalLocalTesting;
    if (originalValidateLookupDuplicates === undefined) {
      delete process.env.RCNOA_VALIDATE_LOOKUP_DUPLICATES;
    } else {
      process.env.RCNOA_VALIDATE_LOOKUP_DUPLICATES = originalValidateLookupDuplicates;
    }
    if (originalReusePriorRcnaDecisions === undefined) {
      delete process.env.RCNOA_REUSE_PRIOR_RCNA_DECISIONS;
    } else {
      process.env.RCNOA_REUSE_PRIOR_RCNA_DECISIONS = originalReusePriorRcnaDecisions;
    }
    jest.restoreAllMocks();
  });

  test('creates working and outbound perfect-match RCNA records', () => {
    const source = rcnoRecord({ 3: ' m ', 10: 'Original Case' });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({ rcnoRecords: [source] });

    expect(result.workingRecords).toHaveLength(1);
    expect(result.workingRecords[0]).toHaveLength(78);
    expect(result.outboundRecords[0]).toHaveLength(78);
    expect(result.outboundRecords[0]).toEqual(result.workingRecords[0]);
    expect(result.workingRecords[0].slice(0, 73)).toEqual(source);
    expect(result.workingRecords[0].slice(73)).toEqual([
      '5: Matches (no action required)',
      'MM Matched Enrollment Record and Fields',
      'Matches (no action required)',
      '',
      '0',
    ]);
    expect(result.audit[0]).toEqual({
      sourceRow: 1,
      ruleId: 'A100',
      membershipMatchCount: 0,
      recent834MatchCount: 0,
    });
    expect(result).not.toHaveProperty('traces');
  });

  test('returns an opt-in trace without changing the A100 result', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const source = rcnoRecord({ 3: ' m ' });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const normalResult = service.transform({ rcnoRecords: [source] });
    const tracedResult = service.transform({ rcnoRecords: [source], trace: true });

    expect({
      workingRecords: tracedResult.workingRecords,
      outboundRecords: tracedResult.outboundRecords,
      audit: tracedResult.audit,
    }).toEqual(normalResult);
    expect(tracedResult.traces).toEqual([{
      sourceRow: 1,
      businessDate: '20260804',
      family: 'default',
      selectedRuleId: 'A100',
      evaluations: [{
        order: 1,
        ruleId: 'A100',
        family: 'match',
        outcome: 'selected',
        condition: 'RCNO overall result equals M',
        predicates: [{
          name: 'overallResultIsMatch',
          left: { field: 'RCNO_Subscriber_ID_Result', value: ' m ' },
          operator: 'equals',
          right: { value: 'M' },
          normalization: ['remove control characters', 'trim', 'uppercase'],
          result: true,
        }],
        reason: 'The normalized RCNO overall result is M',
      }],
    }]);
  });

  test('traces failed A100 before dispatching to the N-family', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const source = rcnoRecord({ 3: 'N', 5: 'MISSING-MRN', 6: 'N' });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({ rcnoRecords: [source], trace: true });

    expect(result.traces[0]).toMatchObject({
      family: 'N',
      selectedRuleId: 'N0000',
      evaluations: [
        {
          order: 1,
          ruleId: 'A100',
          outcome: 'failed',
          predicates: [{ result: false }],
        },
        {
          order: 2,
          ruleId: 'B200',
          outcome: 'failed',
          predicates: [{ result: false }],
        },
        {
          order: 3,
          ruleId: 'N0000',
          family: 'N',
          outcome: 'selected',
        },
      ],
    });
  });

  test('does not evaluate N-family rules unless RCNO member ID result column 7 is N', () => {
    const source = rcnoRecord({ 3: 'N', 5: 'MISSING-MRN', 6: 'M' });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({ rcnoRecords: [source] });

    expect(result.audit[0].ruleId).toBe('No_rule99999');
    expect(result.audit[0].ruleId).not.toMatch(/^N\d/);
  });

  test.each([
    ['F', 'F20000', ['F1300', 'F2400', 'F3500', 'F4600', 'F5700', 'F6800', 'F7000', 'F8000', 'F9000', 'F10000', 'F11000', 'F12000', 'F13000', 'F14000', 'F20000']],
    ['I', 'I2000', ['I1000', 'I2000']],
    ['N', 'N0000', ['N0000']],
  ])('returns ordered detailed %s-family trace through %s', (resultCode, selectedRule, familyRules) => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const source = rcnoRecord({
      3: resultCode,
      5: resultCode === 'N' ? 'MISSING' : (resultCode === 'I' ? 'MRN-I' : ''),
      6: resultCode === 'N' ? 'N' : '',
      10: 'DOE',
      11: 'DOE',
      13: 'JANE',
      14: 'JANE',
      22: '123456789',
      28: '20260101',
      29: '20260101',
      31: '20261231',
      32: '20261231',
    });
    const membershipRecords = resultCode === 'I'
      ? [membershipRecord({ 0: 'MRN-I', 3: 'JANE', 4: 'DOE', 15: '123456789', 1: '20260101', 2: '20261231' })]
      : [];

    const traced = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords,
      trace: true,
    }).traces[0];

    expect(traced.selectedRuleId).toBe(selectedRule);
    expect(traced.evaluations.slice(2).map(({ ruleId }) => ruleId)).toEqual(familyRules);
    expect(traced.evaluations.at(-1)).toMatchObject({
      ruleId: selectedRule,
      outcome: 'selected',
      predicates: [{ name: 'governingConditionSatisfied', result: true }],
    });
    expect(traced.evaluations.slice(2, -1).every(({ outcome }) => outcome === 'failed')).toBe(true);
  });

  test('reuses the prior decision and increments Aging Months', () => {
    const source = rcnoRecord({ 3: 'N', 5: 'MRN-1' });
    const prior = [
      ...source,
      '3',
      'DM501',
      'Carrier to update member field',
      'prior note',
      '4',
    ];
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const { workingRecords, audit, traces } = service.transform({
      rcnoRecords: [source],
      priorRcnaRecords: [prior],
      trace: true,
    });

    expect(workingRecords[0].slice(73)).toEqual([
      '3: Active Demographic Mismatches',
      'DM501 Annuitant Number pending update',
      'Carrier to update member field',
      '',
      '5',
    ]);
    expect(audit[0].ruleId).toBe('B200');
    expect(traces[0]).toMatchObject({
      selectedRuleId: 'B200',
      evaluations: [
        { ruleId: 'A100', outcome: 'failed' },
        {
          ruleId: 'B200',
          outcome: 'selected',
          predicates: [{
            name: 'exactPriorRcnaMatch',
            right: { candidateCount: 1, matchingCandidateCount: 1 },
            result: true,
          }],
        },
      ],
    });
  });

  test('evaluates current rules when prior RCNA decision reuse is disabled', () => {
    process.env.RCNOA_REUSE_PRIOR_RCNA_DECISIONS = 'false';
    const source = rcnoRecord({ 3: 'N', 5: 'MRN-1', 6: 'N' });
    const prior = [
      ...source,
      '1',
      '0000',
      'No Rules Applied',
      '',
      '4',
    ];

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      priorRcnaRecords: [prior],
      trace: true,
    });

    expect(result.audit[0].ruleId).toBe('N0000');
    expect(result.workingRecords[0][75]).toBe('MRN not found on an N record');
    expect(result.traces[0].evaluations[1]).toMatchObject({
      ruleId: 'B200',
      outcome: 'failed',
      reason: 'Prior RCNA decision reuse is disabled',
    });
  });

  test.each([
    ['Y', 'F13000', 'AE500'],
    ['N', 'F14000', 'AE501'],
  ])('distinguishes processed status %s when membership is missing', (
    processed,
    expectedRule,
    expectedCode,
  ) => {
    const source = rcnoRecord({
      3: 'F',
      10: 'DOE',
      13: 'JANE',
      22: '123456789',
      28: '20260101',
      31: '20261231',
    });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({
      rcnoRecords: [source],
      recent834Records: [
        recent834Record('123456789', '20260101', '20261231', processed),
      ],
    });

    expect(result.audit[0].ruleId).toBe(expectedRule);
    expect(result.workingRecords[0][74]).toBe(formatNoticeCodeDisplay(expectedCode));
  });

  test.each([
    ['no EPDS records', []],
    ['a different subscriber SSN', [recent834Record('987654321', '20260101', '20261231', 'N')]],
    ['a different coverage start', [recent834Record('123456789', '20260201', '20261231', 'N')]],
    ['a different coverage end', [recent834Record('123456789', '20260101', '20261130', 'N')]],
  ])('does not select F14000 with %s', (description, recent834Records) => {
    const source = rcnoRecord({
      3: 'F',
      10: 'DOE',
      13: 'JANE',
      22: '123456789',
      28: '20260101',
      31: '20261231',
    });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({
      rcnoRecords: [source],
      recent834Records,
    });

    expect(result.audit[0]).toMatchObject({
      ruleId: 'F20000',
      recent834MatchCount: 0,
    });
    expect(result.workingRecords[0][74]).toBe(formatNoticeCodeDisplay('AE013'));
  });

  test('uses N0000 when an N record has no membership MRN match', () => {
    const source = rcnoRecord({ 3: 'N', 5: 'MISSING-MRN', 6: 'N' });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({ rcnoRecords: [source] });

    expect(result.audit[0].ruleId).toBe('N0000');
    expect(result.workingRecords[0].slice(73, 76)).toEqual([
      '1: Active Enrollment mismatch',
      'KICKO',
      'MRN not found on an N record',
    ]);
  });

  test('renders a sole N5000-2 match as priority 3', () => {
    const source = rcnoRecord({
      3: 'N', 5: 'MRN-1', 6: 'N', 10: 'DOE', 13: 'JANE',
      31: '20261231',
    });
    const membership = membershipRecord({
      0: 'MRN-1', 3: 'JANE', 4: 'DOE', 18: '20260701',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0]).toMatchObject({ ruleId: 'N5000-2' });
    expect(result.workingRecords[0].slice(73, 76)).toEqual([
      formatPriorityDisplay('3'),
      'AE014 Conflicting Date of Death',
      'OPM to correct date of death and coverage end',
    ]);
  });

  test('aggregates N5000-2 with other priority 3 mismatches, N5000-2 first', () => {
    const source = rcnoRecord({
      3: 'N', 5: 'MRN-1', 6: 'N', 7: 'PSHB-ANN', 9: 'I', 10: 'DOE', 13: 'JANE',
      31: '20261231',
    });
    const membership = membershipRecord({
      0: 'MRN-1', 3: 'JANE', 4: 'DOE', 18: '20260701',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0]).toMatchObject({
      ruleId: 'N5000-2/N1000',
      contributingRuleIds: ['N5000-2', 'N1000'],
      canonicalCodes: ['AE014', 'DM501'],
    });
    expect(result.workingRecords[0].slice(73, 76)).toEqual([
      formatPriorityDisplay('3'),
      'AE014 Conflicting Date of Death/DM501 Annuitant Number pending update',
      'OPM to correct date of death and coverage end/Carrier to update member field',
    ]);
  });

  test('lets the Priority 1 AE-1 catch-all defeat the priority 3 N5000-2', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const source = rcnoRecord({
      3: 'N', 5: 'MRN-1', 6: 'N', 10: 'DOE', 13: 'JANE',
      28: '20260101', 31: '20261231',
    });
    const membership = membershipRecord({
      0: 'MRN-1', 1: '20260101', 2: '20261231', 3: 'JANE', 4: 'DOE', 18: '20260701',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0].ruleId).toBe('AE-1');
  });

  test('selects Priority 1 N13000 ahead of the priority 3 N5000-2', () => {
    const source = rcnoRecord({
      3: 'N', 5: 'MRN-1', 6: 'N', 10: 'DOE', 13: 'JANE',
      25: 'NEW', 27: 'I', 28: '20260101', 31: '20261231',
    });
    const membership = membershipRecord({
      0: 'MRN-1', 1: '20260101', 2: '20261231', 3: 'JANE', 4: 'DOE', 8: 'OLD', 18: '20260701',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0].ruleId).toBe('N13000');
    expect(result.workingRecords[0][73]).toBe(formatPriorityDisplay('1'));
  });

  test('aggregates all priority 3 N-family mismatch displays and actions', () => {
    const source = rcnoRecord({
      3: 'N', 5: 'MRN-1', 6: 'N',
      7: 'PSHB-ANN', 9: 'I',
      61: 'PSHB-PAY', 63: 'I',
      64: '01', 66: 'I',
      10: 'DOE', 13: 'JANE',
      16: '19730501', 19: '379114706', 22: '379114706',
      25: '377', 26: '377',
      28: '20260101', 29: '20260101',
      31: '20261201', 32: '20261201',
      70: 'M',
    });
    const membership = membershipRecord({
      0: 'MRN-1', 1: '20260101', 2: '20261201', 3: 'JANE', 4: 'DOE',
      5: '379114706', 6: 'M', 7: '18', 8: '377', 15: '379114706', 17: '19730501',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0]).toMatchObject({
      ruleId: 'N1000/N2000/N3000',
      contributingRuleIds: ['N1000', 'N2000', 'N3000'],
      canonicalCodes: ['DM501', 'DM508', 'DM509'],
    });
    expect(result.workingRecords[0].slice(73, 76)).toEqual([
      formatPriorityDisplay('3'),
      'DM501 Annuitant Number pending update/DM508 Payroll Office Number pending update/DM509 Relationship Code pending update',
      'Carrier to update member field/Carrier to update member field/Carrier to update member field',
    ]);
  });

  test.each([
    ['MM', 'MM Matched Enrollment Record and Fields'],
    ['AC004', 'AC004 No 834 Term or Cancel Received'],
    ['AE013', 'AE013 No 834 Enrollment Received'],
    ['AE014', 'AE014 Conflicting Date of Death'],
    ['AE999', 'AE*'],
  ])('renders the approved %s column 75 display', (code, display) => {
    expect(formatNoticeCodeDisplay(code)).toBe(display);
  });

  test('renders F1300 as priority 4 with CE502', () => {
    const source = rcnoRecord({
      3: 'F', 5: 'MRN-F', 10: 'DOE', 13: 'JANE', 22: '123456789',
      28: '20260701', 31: '20260101',
    });
    const membership = membershipRecord({
      0: 'MRN-F', 1: '20260701', 2: '20260101', 3: 'JANE', 4: 'DOE', 15: '123456789',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0].ruleId).toBe('F1300');
    expect(result.workingRecords[0].slice(73, 76)).toEqual([
      formatPriorityDisplay('4'),
      formatNoticeCodeDisplay('CE502'),
      'Carrier data matches RCNO; no action',
    ]);
  });

  test('renders F10000 as priority 4 with CE002 and revised action', () => {
    const source = rcnoRecord({
      3: 'F', 5: 'MRN-F', 10: 'DOE', 13: 'JANE', 22: '123456789',
      28: '20260101', 31: '20260701',
    });
    const membership = membershipRecord({
      0: 'MRN-F', 1: '20260101', 2: '20260601', 3: 'JANE', 4: 'DOE', 7: '19', 15: '123456789',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0].ruleId).toBe('F10000');
    expect(result.workingRecords[0].slice(73, 76)).toEqual([
      formatPriorityDisplay('4'),
      formatNoticeCodeDisplay('CE002'),
      'OPM to correct match',
    ]);
  });

  test('establishes F-family membership from normalized name and subscriber SSN without an MRN', () => {
    const source = rcnoRecord({
      3: 'F', 10: ' doe ', 13: ' jane ', 22: ' 123456789 ',
      28: '20260101', 31: '20261231',
    });
    const membership = membershipRecord({
      1: '20260101', 2: '20261231', 3: 'JANE', 4: 'DOE',
      15: '123456789',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0]).toMatchObject({
      ruleId: 'F12000',
      membershipMatchCount: 1,
    });
  });

  test('does not establish F-family membership from an MRN match when name and subscriber SSN differ', () => {
    const source = rcnoRecord({
      3: 'F', 5: '000321456', 10: 'DOE', 13: 'JANE', 22: '123456789',
      28: '20260101', 31: '20261231',
    });
    const membership = membershipRecord({
      0: '321456', 1: '20260101', 2: '20261231', 3: 'OTHER', 4: 'MEMBER',
      15: '987654321',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0]).toMatchObject({
      ruleId: 'F20000',
      membershipMatchCount: 0,
    });
  });

  describe('F-family PSHBS coverage end vs CURRENT_DATE gates', () => {
    const businessDate = '20260804';
    const pshbsStart = '20260101';
    // PSHBS coverage end + 31 days for the end dates used below.
    const plus31 = {
      20260804: '20260904',
      20260803: '20260903',
      20260701: '20260801',
      20261231: '20270131',
    };
    const fRow = (end) => rcnoRecord({
      3: 'F', 5: 'MRN-F', 10: 'DOE', 13: 'JANE', 22: '123456789', 28: pshbsStart, 31: end,
    });
    const memberRow = (overrides) => membershipRecord({
      0: 'MRN-F', 1: pshbsStart, 3: 'JANE', 4: 'DOE', 15: '123456789', ...overrides,
    });
    const gatedRules = {
      F4600: (end) => ({ membership: memberRow({ 2: end, 12: 'Y' }) }),
      F5700: (end) => ({ membership: memberRow({ 2: end, 11: 'Y' }) }),
      F6800: (end) => ({ membership: memberRow({ 2: end, 7: '19', 13: '27', 14: 'Y' }) }),
      F8000: (end) => ({ membership: memberRow({ 2: plus31[end] ?? '' }) }),
      F9000: () => ({ membership: memberRow({ 2: '20260815', 17: '20000715' }) }),
      F11000: (end) => ({
        membership: memberRow({ 1: '20260201', 2: end }),
        recent834: recent834Record('123456789', pshbsStart, end, 'N'),
      }),
      F12000: (end) => ({ membership: memberRow({ 2: end }) }),
      F13000: (end) => ({ recent834: recent834Record('123456789', pshbsStart, end, 'Y') }),
      F14000: (end) => ({ recent834: recent834Record('123456789', pshbsStart, end, 'N') }),
      F20000: () => ({}),
    };
    const evaluate = (ruleId, end) => {
      const built = gatedRules[ruleId](end);
      return new RcnoToRcnaService({ businessDate }).transform({
        rcnoRecords: [fRow(end)],
        membershipRecords: built.membership ? [built.membership] : [],
        recent834Records: built.recent834 ? [built.recent834] : [],
      }).audit[0].ruleId;
    };
    const cases = (ends) => Object.keys(gatedRules)
      .flatMap((ruleId) => ends.map((end) => [ruleId, end]));

    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    test.each(cases(['20260804', '20261231']))(
      'selects %s when PSHBS coverage end %s is on/after CURRENT_DATE',
      (ruleId, end) => {
        expect(evaluate(ruleId, end)).toBe(ruleId);
      },
    );

    test.each(cases(['20260803', '20260701', '']))(
      'does not select %s when PSHBS coverage end "%s" is blank or before CURRENT_DATE',
      (ruleId, end) => {
        expect(evaluate(ruleId, end)).not.toBe(ruleId);
      },
    );

    test.each(['F12000', 'F13000', 'F20000'])(
      'falls through to the CE-4 catch-all when %s is gated off by an ended PSHBS coverage end',
      (ruleId) => {
        expect(evaluate(ruleId, '20260701')).toBe('CE-4');
      },
    );

    test('keeps F10000 gated on PSHBS coverage end on/before CURRENT_DATE', () => {
      const run = (end) => new RcnoToRcnaService({ businessDate }).transform({
        rcnoRecords: [fRow(end)],
        membershipRecords: [memberRow({ 2: '20260601' })],
      }).audit[0].ruleId;

      expect(run('20260803')).toBe('F10000');
      expect(run('20260701')).toBe('F10000');
      expect(run('20261231')).not.toBe('F10000');
    });
  });

  describe('N-family PSHBS coverage end vs CURRENT_DATE gate', () => {
    const businessDate = '20260804';
    const plus31 = {
      20260804: '20260904',
      20260803: '20260903',
      20260701: '20260801',
      20261231: '20270131',
    };
    const nRow = (end, overrides) => rcnoRecord({
      3: 'N', 5: 'MRN-1', 6: 'N', 10: 'DOE', 13: 'JANE', 28: '20260101', 31: end, ...overrides,
    });
    const memberRow = (overrides) => membershipRecord({
      0: 'MRN-1', 1: '20260101', 3: 'JANE', 4: 'DOE', ...overrides,
    });
    const gatedRules = {
      'N5000-2': (end) => ({
        // MENR dates (columns 29 and 32) mirror PSHBS so the Priority 1 AE-1 catch-all
        // does not apply and defeat this Priority 3 rule.
        source: nRow(end, { 29: '20260101', 32: end }),
        membership: memberRow({ 2: end, 18: '20260701' }),
      }),
      N13000: (end) => ({
        source: nRow(end, { 25: 'NEW', 27: 'I' }),
        membership: memberRow({ 2: end, 8: 'OLD' }),
      }),
      N14000: (end) => ({
        source: nRow(end, { 25: 'ABC', 33: 'I' }),
        membership: memberRow({ 2: plus31[end] ?? '', 8: 'ABC' }),
      }),
      N12000: (end) => ({
        source: nRow(end, { 25: 'NEW', 27: 'I', 28: '20260201' }),
        membership: memberRow({ 2: end, 8: 'OLD' }),
      }),
    };
    const evaluate = (ruleId, end) => {
      const built = gatedRules[ruleId](end);
      return new RcnoToRcnaService({ businessDate, n12Code: 'AE999' }).transform({
        rcnoRecords: [built.source],
        membershipRecords: [built.membership],
      }).audit[0].ruleId;
    };
    const cases = (ends) => Object.keys(gatedRules)
      .flatMap((ruleId) => ends.map((end) => [ruleId, end]));

    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    test.each(cases(['20260804', '20261231']))(
      'selects %s when PSHBS coverage end %s is populated and on/after CURRENT_DATE',
      (ruleId, end) => {
        expect(evaluate(ruleId, end)).toBe(ruleId);
      },
    );

    test.each(cases(['20260803', '20260701', '']))(
      'does not select %s when PSHBS coverage end "%s" is blank or before CURRENT_DATE',
      (ruleId, end) => {
        expect(evaluate(ruleId, end)).not.toBe(ruleId);
      },
    );

    test.each(['N13000', 'N12000'])(
      'falls through to the CE-4 catch-all when %s data has an ended PSHBS coverage end',
      (ruleId) => {
        expect(evaluate(ruleId, '20260701')).toBe('CE-4');
      },
    );
  });

  test('uses the highest populated coverage end among N-family MRN matches and sorts blanks last', () => {
    const source = rcnoRecord({
      3: 'N', 5: '000321456', 6: 'N', 10: 'DOE', 13: 'JANE',
      29: '20260101', 31: '20261231', 32: '20261231',
    });
    const blankEndMembership = membershipRecord({
      0: '321456', 1: '20260101', 2: '', 3: 'JANE', 4: 'DOE',
    });
    const selectedMembership = membershipRecord({
      0: '321456', 1: '20260101', 2: '20261231', 3: 'JANE', 4: 'DOE',
      18: '20260701',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [blankEndMembership, selectedMembership],
    });

    expect(result.audit[0]).toMatchObject({
      ruleId: 'N5000-2',
      membershipMatchCount: 2,
    });
  });

  test.each([
    ['M', 'No_rule99999'],
    ['I', 'N4000-1'],
  ])('uses last-name N rules only when RCNA_Last_Name_Result is I, not %s', (
    lastNameResult,
    expectedRuleId,
  ) => {
    const source = rcnoRecord({
      3: 'N', 5: 'MRN-1', 6: 'N', 10: 'DOE', 12: lastNameResult, 13: 'JANE',
    });
    const membership = membershipRecord({ 0: 'MRN-1', 3: 'JANE', 4: 'SMITH' });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0].ruleId).toBe(expectedRuleId);
  });

  test.each([
    ['000321456', '321456'],
    ['000032145', '032145'],
  ])('matches zero-padded RCNO MRN %s to MDW MRN %s', (rcnoMrn, mdwMrn) => {
    const source = rcnoRecord({
      3: 'N',
      5: rcnoMrn,
      6: 'N',
      10: 'DOE',
      13: 'JANE',
      19: '123456789',
      22: '123456789',
      25: 'NEW',
      27: 'I',
      28: '20260201',
      29: '20260201',
      31: '20261231',
      32: '20261231',
      70: 'F',
    });
    const membership = membershipRecord({
      0: mdwMrn,
      1: '20260101',
      2: '20261231',
      3: 'JANE',
      4: 'DOE',
      5: '123456789',
      6: 'F',
      7: '18',
      8: 'OLD',
      15: '123456789',
      17: '19800101',
    });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0].ruleId).toBe('N12000');
    expect(result.workingRecords[0][74]).toBe(formatNoticeCodeDisplay('AE999'));
  });

  test('preserves a zero-padded MENR MRN as a string in serialized RCNA output', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const inputMrn = '000032145';
    const sourceText = rcnoRecord({ 3: 'N', 5: inputMrn, 6: 'N' }).join('|');
    const [source] = parseRcnoText(sourceText);

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
    });
    const serializedRcna = serializeRcnoaRecords(result.outboundRecords);
    const serializedMrn = serializedRcna.trimEnd().split('|')[5];

    expect(typeof result.outboundRecords[0][5]).toBe('string');
    expect(result.outboundRecords[0][5]).toBe(inputMrn);
    expect(serializedMrn).toBe(inputMrn);
  });

  test('allows an explicit N12000 code override', () => {
    const source = rcnoRecord({
      3: 'N',
      5: 'MRN-1',
      6: 'N',
      10: 'DOE',
      13: 'JANE',
      19: '123456789',
      22: '123456789',
      25: 'NEW',
      27: 'I',
      28: '20260201',
      29: '20260201',
      31: '20261231',
      32: '20261231',
      70: 'F',
    });
    const membership = membershipRecord({
      0: 'MRN-1',
      1: '20260101',
      2: '20261231',
      3: 'JANE',
      4: 'DOE',
      5: '123456789',
      6: 'F',
      7: '18',
      8: 'OLD',
      15: '123456789',
      17: '19800101',
    });
    const service = new RcnoToRcnaService({
      businessDate: '20260804',
      n12Code: 'APPROVED',
    });

    const result = service.transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0].ruleId).toBe('N12000');
    expect(result.workingRecords[0][74]).toBe(formatNoticeCodeDisplay('APPROVED'));
  });

  test.each([
    ['Y', '20261231', 'I4000', 'AC500'],
    ['Y', '20260731', 'I5000', 'CE500'],
    ['N', '20261231', 'I6000', 'AC501'],
    ['N', '20260731', 'I7000', 'CE501'],
  ])('uses active membership coverage for processed=%s to select %s', (
    processed,
    membershipEnd,
    expectedRule,
    expectedCode,
  ) => {
    const source = rcnoRecord({
      3: 'I',
      5: 'MRN-1',
      11: 'DOE',
      14: 'JANE',
      22: '123456789',
      29: '20260101',
      32: '20260731',
    });
    const membership = membershipRecord({
      0: 'MRN-1',
      1: '20260101',
      2: membershipEnd,
      3: 'JANE',
      4: 'DOE',
      15: '123456789',
    });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
      recent834Records: [
        recent834Record('123456789', '20260101', '20260731', processed),
      ],
    });

    expect(result.audit[0].ruleId).toBe(expectedRule);
    expect(result.workingRecords[0][74]).toBe(formatNoticeCodeDisplay(expectedCode));
  });

  test('overrides a lower-priority specific I-family rule with a higher-priority catch-all match', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const source = rcnoRecord({
      3: 'I',
      5: 'MRN-1',
      11: 'DOE',
      14: 'JANE',
      22: '123456789',
      29: '20260101',
      32: '20261130',
    });
    const membership = membershipRecord({
      0: 'MRN-1',
      1: '20260101',
      2: '20260731',
      3: 'JANE',
      4: 'DOE',
      15: '123456789',
    });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
      recent834Records: [
        recent834Record('123456789', '20260101', '20261130', 'Y'),
      ],
    });

    // Without the catch-all comparison this row would select I5000 (priority 4,
    // CE500) because the joined membership coverage window has already ended.
    // The RCNO row's own MENR window is still open on the business date, so the
    // AC-2 catch-all (priority 2) is also satisfied and must win.
    expect(result.audit[0].ruleId).toBe('AC-2');
    expect(result.workingRecords[0].slice(73, 76)).toEqual([
      formatPriorityDisplay('2'),
      'AC*',
      'Active carrier enrollment mismatch',
    ]);

    const overlapLog = logSpy.mock.calls
      .map(([entry]) => JSON.parse(entry))
      .find((entry) => entry.kpmsg?.name === 'rcnoCatchAllOverlapDetected');
    expect(overlapLog.kpmsg.detail).toMatchObject({
      sourceRow: 1,
      specificRule: { ruleId: 'I5000', priority: 4 },
      catchAllRule: { ruleId: 'AC-2', priority: 2 },
      selectedRuleId: 'AC-2',
      priorityDiffered: true,
    });
    // Verify no sensitive data is logged per design Section 6.4
    expect(overlapLog.kpmsg.detail.rcnoRecord).toBeUndefined();
  });

  test('keeps the specific rule when its priority ties with an overlapping catch-all match', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const source = rcnoRecord({
      3: 'F',
      10: 'DOE',
      13: 'JANE',
      22: '123456789',
      28: '20260101',
      31: '20260804',
    });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({
      rcnoRecords: [source],
      recent834Records: [
        recent834Record('123456789', '20260101', '20260804', 'Y'),
      ],
    });

    // F13000 and the AE-1 catch-all both resolve to priority 1 for this row, so
    // the tie must keep the already-selected specific rule.
    expect(result.audit[0].ruleId).toBe('F13000');

    const overlapLog = logSpy.mock.calls
      .map(([entry]) => JSON.parse(entry))
      .find((entry) => entry.kpmsg?.name === 'rcnoCatchAllOverlapDetected');
    expect(overlapLog.kpmsg.detail).toMatchObject({
      specificRule: { ruleId: 'F13000', priority: 1 },
      catchAllRule: { ruleId: 'AE-1', priority: 1 },
      selectedRuleId: 'F13000',
      priorityDiffered: false,
    });
  });

  test('keeps I2000 over AC-2 for high-dated active MENR coverage', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const source = rcnoRecord({
      3: 'I',
      5: 'MRN-1',
      11: 'DOE',
      14: 'JANE',
      22: '123456789',
      29: '20260101',
      32: '40001231',
    });
    const membership = membershipRecord({
      0: 'MRN-1',
      1: '20260101',
      2: '40001231',
      3: 'JANE',
      4: 'DOE',
      15: '123456789',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0].ruleId).toBe('I2000');
    expect(result.workingRecords[0].slice(73, 76)).toEqual([
      formatPriorityDisplay('2'),
      formatNoticeCodeDisplay('AC004'),
      'No 834 termination or cancellation received',
    ]);

    const overlapLog = logSpy.mock.calls
      .map(([entry]) => JSON.parse(entry))
      .find((entry) => entry.kpmsg?.name === 'rcnoCatchAllOverlapDetected');
    expect(overlapLog.kpmsg.detail).toMatchObject({
      specificRule: { ruleId: 'I2000', priority: 2 },
      catchAllRule: { ruleId: 'AC-2', priority: 2 },
      selectedRuleId: 'I2000',
      priorityDiffered: false,
    });
  });

  test('matches I-family membership by normalized MENR member MRN without an SSN or name match', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const source = rcnoRecord({
      3: 'I', 5: '000321456', 11: 'RCNO-NAME', 14: 'RCNO-FIRST',
      22: '123456789', 29: '20260101', 32: '20261231',
    });
    const membership = membershipRecord({
      0: '321456', 1: '20260101', 2: '20261231', 3: 'OTHER-FIRST',
      4: 'OTHER-NAME', 5: '987654321', 15: '987654321',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0].ruleId).toBe('I2000');
  });

  test('does not use an SSN and name match when the I-family MENR member MRN differs', () => {
    const source = rcnoRecord({
      3: 'I', 5: 'MRN-EXPECTED', 11: 'DOE', 14: 'JANE',
      22: '123456789', 29: '20260101', 32: '20261231',
    });
    const membership = membershipRecord({
      0: 'MRN-OTHER', 1: '20260101', 2: '20261231', 3: 'JANE',
      4: 'DOE', 15: '123456789',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0].ruleId).toBe('AC-2');
  });

  test('uses the highest coverage end date among I-family MRN matches', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const source = rcnoRecord({
      3: 'I', 5: 'MRN-1', 22: '123456789',
      29: '20260101', 32: '20261231',
    });
    const endedMembership = membershipRecord({
      0: 'MRN-1', 1: '20250101', 2: '20250731',
    });
    const currentMembership = membershipRecord({
      0: 'MRN-1', 1: '20260101', 2: '20261231',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [endedMembership, currentMembership],
    });

    expect(result.audit[0].ruleId).toBe('I2000');
  });

  test('matches the MRN format reconstructed by the base MDW query', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const source = rcnoRecord({
      3: 'I', 5: '010001234567', 22: '123456789',
      29: '20260101', 32: '20261231',
    });
    const membership = membershipRecord({
      0: '10001234567', 1: '20260101', 2: '20261231',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0].ruleId).toBe('I2000');
  });

  test('prefers a priority 4 catch-all over a priority 3 specific N disposition', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const source = rcnoRecord({
      3: 'N', 5: 'MRN-1', 6: 'N', 7: 'PSHB-ANN', 9: 'I',
      10: 'DOE', 13: 'JANE', 16: '19730501', 19: '379114706', 22: '379114706',
      25: '377', 28: '19950301', 31: '19961201', 70: 'M',
    });
    const membership = membershipRecord({
      0: 'MRN-1', 1: '19950301', 2: '19961201', 3: 'JANE', 4: 'DOE',
      5: '379114706', 6: 'M', 7: '18', 8: '377', 15: '379114706', 17: '19730501',
    });

    const result = new RcnoToRcnaService({ businessDate: '20260804' }).transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    expect(result.audit[0].ruleId).toBe('CE-4');
    expect(result.workingRecords[0].slice(73, 76)).toEqual([
      formatPriorityDisplay('4'),
      'CE*',
      'Cancelled enrollment mismatch',
    ]);
  });

  test('detects DM-3 catch-all when demographic mismatch exists with active PSHBS coverage', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    // Result = 'N' means at least one demographic result column is 'N'.
    // DM-3 triggers when result='N', pshbsActive=true, and any demographic result column is 'N'.
    // To avoid specific N-family rules while keeping result='N', we:
    // - Set PSHBS differently from MENR (so result columns are 'N')
    // - Set membership to match PSHBS (so no N-rule field mismatches fire)
    // - Ensure PSHBS matches membership to skip N-family evaluations
    const source = rcnoRecord({
      3: 'N',        // RCNO result (set by caller, not generated)
      5: 'MRN-1',
      10: 'DOE',     // PSHBS last name
      11: 'SMITH',   // MENR last name (different from PSHBS -> result column will be 'N')
      12: 'N',       // Last name result column = 'N' (demographic mismatch)
      13: 'JANE',    // PSHBS first name
      14: 'JANE',    // MENR first name (same as PSHBS)
      15: 'M',       // First name result column = 'M'
      16: '19800101',
      22: '123456789', // PSHBS subscriber SSN
      25: 'ABC123',   // PSHBS plan code
      26: 'ABC123',   // MENR plan code (same, so AE-1 won't fire)
      28: '20260101', // PSHBS start date
      29: '20260101', // MENR start date (same)
      31: '20261231', // PSHBS end date > start (active range)
      32: '20261231', // MENR end date (same)
      70: 'M',        // PSHBS_GENDER (matches membership gender)
    });
    const membership = membershipRecord({
      0: 'MRN-1',
      1: '20260101', // START_DATE matches PSHBS
      2: '20261231', // END_DATE matches PSHBS
      3: 'JANE',     // FIRST_NAME matches PSHBS
      4: 'DOE',      // LAST_NAME matches PSHBS
      5: '123456789', // MEMBER_SSN (will match PSHBS subscriber SSN for simplicity)
      6: 'M',        // GENDER (leave as default to avoid mismatch)
      7: 'S',        // RELATIONSHIP subscriber
      8: 'ABC123',   // PLAN_CODE matches PSHBS
      9: 'INITIAL',  // ANNUITANT
      15: '123456789', // SUBSCRIBER_SSN
    });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    });

    // Result = 'N' with active PSHBS and a demographic mismatch in result columns.
    // No specific N rule fires because membership matches PSHBS fields.
    // DM-3 catch-all (priority 3) is returned via catchAllOrDefault.
    expect(result.audit[0].ruleId).toBe('DM-3');
    expect(result.workingRecords[0].slice(73, 76)).toEqual([
      formatPriorityDisplay('3'),
      'DM*',
      'Active demographic mismatch',
    ]);

    const overlapLog = logSpy.mock.calls
      .map(([entry]) => JSON.parse(entry))
      .find((entry) => entry.kpmsg?.name === 'rcnoCatchAllOverlapDetected');
    // No overlap log expected; DM-3 is returned via catchAllOrDefault, not via resolveWithCatchAll.
    expect(overlapLog).toBeUndefined();
  });

  test('detects CE-4 catch-all when PSHBS coverage is cancelled (end <= start)', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const source = rcnoRecord({
      3: 'F',
      22: '123456789',
      28: '20261201', // PSHBS coverage start
      31: '20261101', // PSHBS coverage end - cancelled (end < start)
    });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    const result = service.transform({
      rcnoRecords: [source],
      membershipRecords: [],
      recent834Records: [],
    });

    // Result F with no membership and no 834, but PSHBS coverage is cancelled (end <= start).
    // F20 does not match (requires activeRange). Falls through to catchAllOrDefault.
    // CE-4 catch-all (priority 4) is satisfied and returned.
    expect(result.audit[0].ruleId).toBe('CE-4');
    expect(result.workingRecords[0].slice(73, 76)).toEqual([
      formatPriorityDisplay('4'),
      'CE*',
      'Cancelled enrollment mismatch',
    ]);

    const overlapLog = logSpy.mock.calls
      .map(([entry]) => JSON.parse(entry))
      .find((entry) => entry.kpmsg?.name === 'rcnoCatchAllOverlapDetected');
    // No overlap log expected; CE-4 is returned via catchAllOrDefault, not via resolveWithCatchAll.
    expect(overlapLog).toBeUndefined();
  });

  test('rejects an RCNO row with the wrong fixed width', () => {
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    expect(() => service.transform({ rcnoRecords: [Array(72).fill('')] }))
      .toThrow('RCNO row 1 must contain exactly 73 columns');
  });

  test('rejects a malformed membership lookup row', () => {
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    expect(() => service.transform({
      rcnoRecords: [rcnoRecord({ 3: 'M' })],
      membershipRecords: [Array(18).fill('')],
    })).toThrow('membership row 1 must contain at least 19 columns');
  });

  test('collapses identical membership candidates and rejects conflicting duplicates', () => {
    const source = rcnoRecord({ 3: 'N', 5: 'MRN-1', 7: 'ANN-1' });
    const membership = membershipRecord({ 0: 'MRN-1', 9: 'ANN-1' });
    const service = new RcnoToRcnaService({
      businessDate: '20260804',
      validateLookupDuplicates: true,
    });

    const identical = service.transform({
      rcnoRecords: [source],
      membershipRecords: [membership, [...membership]],
    });
    expect(identical.audit[0].membershipMatchCount).toBe(1);

    const conflicting = [...membership];
    conflicting[9] = 'ANN-2';
    expect(() => service.transform({
      rcnoRecords: [source],
      membershipRecords: [membership, conflicting],
    })).toThrow('Conflicting duplicate membership candidates found');
  });

  test('allows conflicting lookup candidates when duplicate validation is not configured', () => {
    delete process.env.RCNOA_VALIDATE_LOOKUP_DUPLICATES;
    const source = rcnoRecord({ 3: 'N', 5: 'MRN-1', 7: 'ANN-1' });
    const membership = membershipRecord({ 0: 'MRN-1', 9: 'ANN-1' });
    const conflicting = [...membership];
    conflicting[9] = 'ANN-2';
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    expect(() => service.transform({
      rcnoRecords: [source],
      membershipRecords: [membership, conflicting],
    })).not.toThrow();
  });

  test('allows distinct enrollment spans for the same membership identity', () => {
    const source = rcnoRecord({ 3: 'M' });
    const firstSpan = membershipRecord({
      0: 'MRN-1', 1: '20250101', 2: '20251231', 8: '001',
    });
    const secondSpan = membershipRecord({
      0: 'MRN-1', 1: '20260101', 2: '20261231', 8: 'A01',
    });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    expect(() => service.transform({
      rcnoRecords: [source],
      membershipRecords: [firstSpan, secondSpan],
    })).not.toThrow();
  });

  test('collapses identical recent 834 candidates and rejects conflicting duplicates', () => {
    const source = rcnoRecord({
      3: 'F', 22: '123456789', 28: '20260101', 31: '20261231',
    });
    const recent = recent834Record('123456789', '20260101', '20261231', 'Y');
    const service = new RcnoToRcnaService({
      businessDate: '20260804',
      validateLookupDuplicates: true,
    });

    const identical = service.transform({
      rcnoRecords: [source],
      recent834Records: [recent, [...recent]],
    });
    expect(identical.audit[0].recent834MatchCount).toBe(1);

    const conflicting = [...recent];
    conflicting[3] = 'N';
    expect(() => service.transform({
      rcnoRecords: [source],
      recent834Records: [recent, conflicting],
    })).toThrow('Conflicting duplicate recent enrollment candidates found');
  });

  test('does not mutate source or lookup arrays', () => {
    const source = rcnoRecord({ 3: 'M' });
    const membership = membershipRecord({ 0: 'MRN-1' });
    const recent = recent834Record('123456789', '20260101', '20261231', 'Y');
    const before = JSON.stringify({ source, membership, recent });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    service.transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
      recent834Records: [recent],
    });

    expect(JSON.stringify({ source, membership, recent })).toBe(before);
  });

  test('always selects the explicit default when no earlier rule applies', () => {
    const service = new RcnoToRcnaService({ businessDate: '20260804' });
    const result = service.transform({ rcnoRecords: [rcnoRecord({ 3: 'X' })] });

    expect(result.audit[0].ruleId).toBe('No_rule99999');
    expect(result.workingRecords[0][74]).toBe(formatNoticeCodeDisplay('0000'));
  });

  test('requires an address normalizer for N91000 and N92000 evaluation', () => {
    const source = rcnoRecord({
      3: 'N', 5: 'MRN-1', 6: 'N', 10: 'DOE', 13: 'JANE', 19: '123456789',
      22: '123456789', 25: 'ABC', 28: '20260101', 31: '20261231',
      36: 'I', 64: '18', 70: 'F',
    });
    const membership = membershipRecord({
      0: 'MRN-1', 1: '20260101', 2: '20261231', 3: 'JANE', 4: 'DOE',
      5: '123456789', 6: 'F', 7: '18', 8: 'ABC', 15: '123456789',
    });
    const service = new RcnoToRcnaService({ businessDate: '20260804' });

    expect(() => service.transform({
      rcnoRecords: [source],
      membershipRecords: [membership],
    })).toThrow('Address normalizer is required to evaluate N91 and N92');
  });
});

