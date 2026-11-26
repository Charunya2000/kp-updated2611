import {
  assertRcnoaScope,
  buildRcnaFileName,
  buildRcnoaBlobName,
  buildRcnoaCompanionFileName,
  getRcnoaProductionReadiness,
  parseRcnaText,
  parseRcnoText,
  prepareUploadedRcnaPriorRecords,
  RCNOA_DEFAULTS,
  RCNO_DATA_RECORD_TYPE,
  selectRcnaRecordsFor834,
  serializeRcnoaRecords,
  transformRcnoRowsIsolated,
  transformRcnoRowsIsolatedInBatches,
  transformRcnoRowsWithWorkerIsolation,
  validateReconciliationCycle,
  validate834Content,
} from '../rcnoaCore.js';

const RUN_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('rcnoaCore', () => {
  test('selects carrier-action F, I, and N rows for 834 generation', () => {
    const row = (family, description) => {
      const record = Array(78).fill('');
      record[3] = family;
      record[75] = description;
      return record;
    };
    const selectedF = row('F', 'Carrier to process the 834 enrollment');
    const selectedI = row('I', 'Carrier to cancel coverage');
    const selectedN = row('N', 'Carrier to update member field');

    expect(selectRcnaRecordsFor834([
      row('M', 'Matches (no action required)'),
      row('F', 'OPM to send an 834'),
      selectedF,
      selectedI,
      selectedN,
    ])).toEqual([selectedF, selectedI, selectedN]);
  });

  test('enforces the fixed team and assistant route scope', () => {
    expect(() => assertRcnoaScope('reconciliation-notice-processing', 'rcno-rcna-834')).not.toThrow();
    expect(() => assertRcnoaScope('other-team', 'rcno-rcna-834')).toThrow('scope not found');
  });

  test('parses and serializes the provisional 73-column format', () => {
    const record = Array.from({ length: 73 }, (_, index) => `value-${index}`);
    const text = serializeRcnoaRecords([record]);

    expect(parseRcnoText(text)).toEqual([record]);
    expect(() => parseRcnoText('too|short')).toThrow('exactly 73 columns');
  });

  test('drops a leading RCNO column when configured', () => {
    const record = Array.from({ length: 73 }, (_, index) => `value-${index}`);
    const text = ['', ...record].join('|');

    expect(parseRcnoText(text, { ignoreFirstColumn: true })).toEqual([record]);
    expect(() => parseRcnoText(record.join('|'), { ignoreFirstColumn: true }))
      .toThrow('exactly 74 columns');
  });

  test('drops a trailing RCNO column when configured', () => {
    const record = Array.from({ length: 73 }, (_, index) => `value-${index}`);
    const text = [...record, 'ignored'].join('|');

    expect(parseRcnoText(text, { ignoreLastColumn: true })).toEqual([record]);
    expect(() => parseRcnoText(record.join('|'), { ignoreLastColumn: true }))
      .toThrow('exactly 74 columns');
  });

  test('drops both RCNO edge columns when both options are configured', () => {
    const record = Array.from({ length: 73 }, (_, index) => `value-${index}`);
    const text = ['ignored-first', ...record, 'ignored-last'].join('|');

    expect(parseRcnoText(text, {
      ignoreFirstColumn: true,
      ignoreLastColumn: true,
    })).toEqual([record]);
    expect(() => parseRcnoText(['ignored-first', ...record].join('|'), {
      ignoreFirstColumn: true,
      ignoreLastColumn: true,
    })).toThrow('exactly 75 columns');
  });

  test('strips blank and whitespace-only lines from RCNO input', () => {
    const first = Array.from({ length: 73 }, (_, index) => `first-${index}`);
    const second = Array.from({ length: 73 }, (_, index) => `second-${index}`);
    const text = `\r\n  \r\n${first.join('|')}\r\n\t\r\n${second.join('|')}\r\n\r\n`;

    expect(parseRcnoText(text)).toEqual([first, second]);
  });

  describe('Record_Type filtering', () => {
    const typed = (recordType, label, length = 73) => [
      recordType,
      ...Array.from({ length: length - 1 }, (_, index) => `${label}-${index}`),
    ];
    const KEEP_01 = { keepRecordType: RCNO_DATA_RECORD_TYPE };

    test('keeps only Record_Type 01 rows from a mixed 01 and 02 file', () => {
      const first = typed('01', 'first');
      const second = typed('01', 'second');
      const text = serializeRcnoaRecords([
        typed('02', 'ignored-a'),
        first,
        typed('02', 'ignored-b'),
        second,
      ]);

      expect(parseRcnoText(text, KEEP_01)).toEqual([first, second]);
    });

    test('fails clearly when every row is Record_Type 02', () => {
      const text = serializeRcnoaRecords([typed('02', 'a'), typed('02', 'b')]);

      expect(() => parseRcnoText(text, KEEP_01))
        .toThrow('RCNO file does not contain any Record_Type 01 rows');
    });

    test('ignores a Record_Type 02 row of a different width without failing the file', () => {
      const kept = typed('01', 'kept');
      const text = serializeRcnoaRecords([
        typed('02', 'short', 5),
        kept,
        typed('02', 'long', 90),
      ]);

      expect(parseRcnoText(text, KEEP_01)).toEqual([kept]);
    });

    test('still enforces the column count for Record_Type 01 rows', () => {
      const text = serializeRcnoaRecords([typed('01', 'ok'), typed('01', 'bad', 10)]);

      expect(() => parseRcnoText(text, KEEP_01)).toThrow('RCNO row 2 must contain exactly 73 columns');
    });

    test('treats Record_Type 1 and 01 as data rows and ignores 2, 02, 03, and blank', () => {
      const one = typed('1', 'one');
      const zeroOne = typed('01', 'zero-one');
      const padded = typed(' 01 ', 'padded');
      const text = serializeRcnoaRecords([
        typed('', 'blank'),
        typed('2', 'two'),
        one,
        typed('02', 'zero-two'),
        typed('03', 'three'),
        zeroOne,
        padded,
      ]);

      expect(parseRcnoText(text, KEEP_01)).toEqual([one, zeroOne, padded]);
    });

    test('handles the real file format: 1 data rows with a short 2 trailer row', () => {
      const first = typed('1', 'first');
      const second = typed('1', 'second');
      const text = serializeRcnoaRecords([first, second, typed('2', 'trailer', 7)]);

      expect(parseRcnoText(text, KEEP_01)).toEqual([first, second]);
    });

    test('fails clearly when every row is Record_Type 2', () => {
      const text = serializeRcnoaRecords([typed('2', 'a', 7), typed('2', 'b')]);

      expect(() => parseRcnoText(text, KEEP_01))
        .toThrow('RCNO file does not contain any Record_Type 01 rows');
    });

    test('reads Record_Type after the ignored first column and drops both edge columns', () => {
      const kept = typed('01', 'kept');
      const text = [
        ['edge-first', ...typed('02', 'ignored'), 'edge-last'].join('|'),
        ['edge-first', ...kept, 'edge-last'].join('|'),
      ].join('\r\n');

      expect(parseRcnoText(text, {
        ...KEEP_01,
        ignoreFirstColumn: true,
        ignoreLastColumn: true,
      })).toEqual([kept]);
    });

    test('does not filter when keepRecordType is not supplied', () => {
      const rows = [typed('02', 'a'), typed('01', 'b')];

      expect(parseRcnoText(serializeRcnoaRecords(rows))).toEqual(rows);
    });
  });

  test('parses reviewed outbound RCNA rows and restores working columns', () => {
    const outbound = Array.from({ length: 76 }, (_, index) => String(index));
    const [record] = parseRcnaText(`${outbound.join('|')}\r\n`);

    expect(record).toHaveLength(78);
    expect(record.slice(0, 76)).toEqual(outbound);
    expect(record.slice(76)).toEqual(['', '']);
  });

  test('parses 78-column outbound RCNA rows without changing Notes or Aging Months', () => {
    const outbound = Array.from({ length: 78 }, (_, index) => String(index));
    outbound[76] = 'Analyst note';
    outbound[77] = '4';

    const [record] = parseRcnaText(`${outbound.join('|')}\r\n`);

    expect(record).toEqual(outbound);
    expect(record.slice(76)).toEqual(['Analyst note', '4']);
  });

  test('prepares uploaded outbound RCNA rows for prior-decision reuse', () => {
    const outbound = Array.from({ length: 76 }, (_, index) => `value-${index}`);
    const [parsed] = parseRcnaText(outbound.join('|'));

    const [prepared] = prepareUploadedRcnaPriorRecords([parsed]);

    expect(prepared).toHaveLength(78);
    expect(prepared.slice(0, 76)).toEqual(outbound);
    expect(prepared.slice(76)).toEqual(['', '0']);
  });

  test('validates uploaded RCNA reconciliation cycles and aging', () => {
    expect(validateReconciliationCycle('202611')).toBe('202611');
    expect(() => validateReconciliationCycle('2026-11')).toThrow('YYYYMM');
    expect(() => validateReconciliationCycle('202613')).toThrow('valid month');

    const invalidAging = Array(78).fill('value');
    invalidAging[77] = 'not-a-number';
    expect(() => prepareUploadedRcnaPriorRecords([invalidAging]))
      .toThrow('Aging Months must be a nonnegative integer');
  });

  test('accepts only X12 interchanges containing an 834 transaction', () => {
    expect(validate834Content('ISA*header~ST*834*0001~SE*2*0001~IEA*1*1~')).toContain('ST*834*');
    expect(() => validate834Content('ISA*header~ST*835*0001~')).toThrow('834 transaction');
    expect(() => validate834Content('arbitrary text')).toThrow('valid X12 interchange');
  });

  test('does not allow callers to override pipe-delimited data-row framing', () => {
    const record = Array.from({ length: 73 }, (_, index) => `value-${index}`);

    expect(() => parseRcnoText(record.join(','), { delimiter: ',' }))
      .toThrow('exactly 73 columns');
    expect(serializeRcnoaRecords([record], { delimiter: ',' })).toContain('|');
  });

  test('builds owner-scoped ad hoc Blob names and rejects traversal', () => {
    expect(buildRcnoaBlobName({
      mode: 'adhoc',
      nuid: 'a123456',
      runId: RUN_ID,
      direction: 'input',
      fileName: 'sample.rcno',
    })).toBe(`rcnoa-processing/adhoc/A123456/${RUN_ID}/input/sample.rcno`);

    expect(() => buildRcnoaBlobName({
      mode: 'scheduled',
      runId: RUN_ID,
      direction: 'input',
      fileName: '../sample.rcno',
    })).toThrow('path segments');
  });

  test('builds OPM RCNA names from production and test RCNO names', () => {
    expect(buildRcnaFileName(
      'PSHB_ATOZ_RCNO_20250301_20250331_20250415.txt.pgp',
      '20260810',
    )).toBe('PSHB_ATOZ_RCNA_20250301_20250331_20260810.txt.pgp');
    expect(buildRcnaFileName(
      'TST_PSHB_ATOZ_RCNO_20250301_20250331_20250415.txt.pgp',
      '20260810',
    )).toBe('TST_PSHB_ATOZ_RCNA_20250301_20250331_20260810.txt.pgp');
  });

  test('uses the OPM RCNO transfer pattern for scheduled discovery', () => {
    const pattern = new RegExp(RCNOA_DEFAULTS.inboundFilePattern);

    expect(pattern.test('PSHB_ATOZ_RCNO_20250301_20250331_20250415.txt.pgp')).toBe(true);
    expect(pattern.test('TST_PSHB_ATOZ_RCNO_20250301_20250331_20250415.txt.pgp')).toBe(true);
    expect(pattern.test('PSHB_ATOZ_RCNA_20250301_20250331_20250415.txt.pgp')).toBe(false);
    expect(pattern.test('sample.rcno')).toBe(false);
  });

  test('keeps legacy ad hoc names usable and removes the compound transfer extension', () => {
    expect(buildRcnaFileName('sample.rcno', '20260810')).toBe('sample.rcna.txt');
    expect(buildRcnoaCompanionFileName(
      'PSHB_ATOZ_RCNO_20250301_20250331_20250415.txt.pgp',
      '834',
      'x12',
    )).toBe('PSHB_ATOZ_RCNO_20250301_20250331_20250415.834.x12');
  });

  test('isolates row failures and redacts nine-digit identifiers', () => {
    const transformer = {
      transform: ({ rcnoRecords }) => {
        if (rcnoRecords[0][0] === 'bad') throw new Error('member 123456789 failed');
        return {
          workingRecords: [[...rcnoRecords[0], 'working']],
          outboundRecords: [[...rcnoRecords[0], 'outbound']],
          audit: [{ sourceRow: 1, ruleId: 'A100' }],
        };
      },
    };

    const result = transformRcnoRowsIsolated({
      rcnoRecords: [['good'], ['bad'], ['also-good']],
      transformer,
    });

    expect(result.workingRecords).toHaveLength(2);
    expect(result.failures).toEqual([expect.objectContaining({
      sourceRowNumber: 2,
      message: 'member [REDACTED] failed',
    })]);
    expect(result.audit.map((item) => item.sourceRow)).toEqual([1, 3]);
  });

  test('preserves a specific row transformation error code', () => {
    const transformer = {
      transform: () => {
        const error = new Error('Conflicting duplicate membership candidates found');
        error.code = 'AMBIGUOUS_LOOKUP_DUPLICATE';
        throw error;
      },
    };

    const result = transformRcnoRowsIsolated({
      rcnoRecords: [['source-row']],
      transformer,
    });

    expect(result.failures[0]).toMatchObject({
      sourceRowNumber: 1,
      errorCode: 'AMBIGUOUS_LOOKUP_DUPLICATE',
    });
  });

  test('reports cumulative row progress between transformation batches', async () => {
    const progress = [];
    const transformer = {
      transform: ({ rcnoRecords }) => {
        if (rcnoRecords[0][0] === 'bad') throw new Error('invalid row');
        return {
          workingRecords: [rcnoRecords[0]],
          outboundRecords: [rcnoRecords[0]],
          audit: [{ ruleId: 'A100' }],
        };
      },
    };

    const result = await transformRcnoRowsIsolatedInBatches({
      rcnoRecords: [['one'], ['bad'], ['three']],
      transformer,
      batchSize: 2,
      onProgress: async (counts) => progress.push(counts),
    });

    expect(progress).toEqual([
      { received: 3, processed: 2, succeeded: 1, failed: 1 },
      { received: 3, processed: 3, succeeded: 2, failed: 1 },
    ]);
    expect(result.failures[0].sourceRowNumber).toBe(2);
    expect(result.audit.map((item) => item.sourceRow)).toEqual([1, 3]);
  });

  describe('transformRcnoRowsWithWorkerIsolation', () => {
    function rcnoRecord(overrides = {}) {
      const record = Array(73).fill('');
      record[0] = '01';
      Object.entries(overrides).forEach(([index, value]) => {
        record[Number(index)] = value;
      });
      return record;
    }

    test('transforms rows on an isolated worker thread and reports cumulative progress', async () => {
      const progressUpdates = [];

      const result = await transformRcnoRowsWithWorkerIsolation({
        rcnoRecords: [rcnoRecord({ 3: 'M' }), rcnoRecord({ 3: 'M' })],
        transformerOptions: { businessDate: '20260804' },
        runId: RUN_ID,
        onProgress: async (progress) => { progressUpdates.push(progress); },
      });

      expect(result.workingRecords).toHaveLength(2);
      expect(result.outboundRecords).toHaveLength(2);
      expect(result.failures).toHaveLength(0);
      expect(result.blockedRows).toHaveLength(0);
      expect(progressUpdates.at(-1)).toEqual({
        received: 2, processed: 2, succeeded: 2, failed: 0, blocked: 0,
      });
    }, 15000);

    test('isolates a single row failure without aborting the run', async () => {
      const malformedRow = Array(70).fill('');

      const result = await transformRcnoRowsWithWorkerIsolation({
        rcnoRecords: [rcnoRecord({ 3: 'M' }), malformedRow, rcnoRecord({ 3: 'M' })],
        transformerOptions: { businessDate: '20260804' },
      });

      expect(result.workingRecords).toHaveLength(2);
      expect(result.failures).toEqual([{
        sourceRowNumber: 2,
        status: 'ERROR',
        errorCode: 'RCNO_ROW_TRANSFORM_FAILED',
        message: expect.stringContaining('RCNO row 2 must contain exactly 73 columns'),
        retryable: false,
      }]);
      expect(result.blockedRows).toHaveLength(0);
    }, 15000);

    test('surfaces malformed reference data once as an init error rather than per row', async () => {
      await expect(transformRcnoRowsWithWorkerIsolation({
        rcnoRecords: [rcnoRecord({ 3: 'M' })],
        membershipRecords: [Array(5).fill('')],
        transformerOptions: { businessDate: '20260804' },
      })).rejects.toThrow(/membership row 1 must contain at least 19 columns/);
    }, 15000);
  });

  test('reports readiness without returning configuration values', () => {
    const environment = {
      RCNOA_EPDS_JDBC_URL: 'jdbc:oracle:thin:@epds',
      RCNOA_EPDS_USERNAME: 'user',
      RCNOA_EPDS_PASSWORD: 'secret',
      RCNOA_MDW_JDBC_URL: 'jdbc:oracle:thin:@mdw',
      RCNOA_MDW_USERNAME: 'user',
      RCNOA_MDW_PASSWORD: 'secret',
      RCNOA_N12_CODE: 'N12',
      RCNOA_834_ENVELOPE_JSON: '{}',
      RCNOA_834_INTENT_BY_CODE_JSON: '{}',
      RCNOA_834_RELATIONSHIP_MAP_JSON: '{}',
      RCNOA_ADDRESS_LINE3_MODE: 'reject',
      RCNOA_PRIOR_RCNA_MATCH_KEY_SECRET: 'secret',
      RCNOA_REMOTE_SERVER: 'sftp.example.test',
      RCNOA_REMOTE_FOLDER: '/inbound',
      RCNOA_USERNAME: 'sftp-user',
      RCNOA_PASSWORD: 'secret',
      RCNOA_SFTP_HOST_KEY_SHA256: 'fingerprint',
      RCNOA_SCHEDULER_TOKEN: 'secret',
      RCNOA_834_MAPPING_APPROVED: 'true',
      RCNOA_SCHEDULER_AUTH_APPROVED: 'true',
    };

    expect(getRcnoaProductionReadiness(environment)).toEqual({
      ready: true,
      missing: [],
      invalid: [],
      pendingContracts: [],
    });
    expect(JSON.stringify(getRcnoaProductionReadiness(environment))).not.toContain('secret');
  });

  test('does not require scheduler or SFTP configuration for ad hoc readiness', () => {
    const environment = {
      RCNOA_EPDS_JDBC_URL: 'jdbc:oracle:thin:@epds',
      RCNOA_EPDS_USERNAME: 'user',
      RCNOA_EPDS_PASSWORD: 'secret',
      RCNOA_MDW_JDBC_URL: 'jdbc:oracle:thin:@mdw',
      RCNOA_MDW_USERNAME: 'user',
      RCNOA_MDW_PASSWORD: 'secret',
      RCNOA_N12_CODE: 'N12',
      RCNOA_834_ENVELOPE_JSON: '{}',
      RCNOA_834_INTENT_BY_CODE_JSON: '{}',
      RCNOA_834_RELATIONSHIP_MAP_JSON: '{}',
      RCNOA_ADDRESS_LINE3_MODE: 'reject',
      RCNOA_PRIOR_RCNA_MATCH_KEY_SECRET: 'secret',
      RCNOA_834_MAPPING_APPROVED: 'true',
    };

    expect(getRcnoaProductionReadiness(environment, { mode: 'adhoc' }).ready).toBe(true);
    expect(getRcnoaProductionReadiness(environment, { mode: 'scheduled' }).ready).toBe(false);
  });

  test('does not require Oracle or prior-history configuration for mock readiness', () => {
    const businessConfiguration = {
      envelope: {},
      intentByCode: {},
      relationshipMap: {},
      addressLine3Mode: 'reject',
      priorRcnaMatchKeySecret: '',
      mappingApproved: true,
    };

    expect(getRcnoaProductionReadiness({}, {
      mode: 'adhoc-mock',
      businessConfiguration,
    })).toEqual({
      ready: true,
      missing: [],
      invalid: [],
      pendingContracts: [],
    });
  });

  test('uses Mongo-backed business configuration without legacy environment properties', () => {
    const environment = {
      RCNOA_EPDS_JDBC_URL: 'jdbc:oracle:thin:@epds',
      RCNOA_EPDS_USERNAME: 'user',
      RCNOA_EPDS_PASSWORD: 'secret',
      RCNOA_MDW_JDBC_URL: 'jdbc:oracle:thin:@mdw',
      RCNOA_MDW_USERNAME: 'user',
      RCNOA_MDW_PASSWORD: 'secret',
    };
    const businessConfiguration = {
      envelope: {},
      intentByCode: {},
      relationshipMap: {},
      addressLine3Mode: 'reject',
      priorRcnaMatchKeySecret: 'x'.repeat(32),
      mappingApproved: true,
    };

    expect(getRcnoaProductionReadiness(environment, {
      mode: 'adhoc',
      businessConfiguration,
    })).toEqual({
      ready: true,
      missing: [],
      invalid: [],
      pendingContracts: [],
    });
  });

  test('does not require 834 configuration when 834 creation is skipped', () => {
    const environment = {
      RCNOA_EPDS_JDBC_URL: 'jdbc:oracle:thin:@epds',
      RCNOA_EPDS_USERNAME: 'user',
      RCNOA_EPDS_PASSWORD: 'secret',
      RCNOA_MDW_JDBC_URL: 'jdbc:oracle:thin:@mdw',
      RCNOA_MDW_USERNAME: 'user',
      RCNOA_MDW_PASSWORD: 'secret',
    };
    const businessConfiguration = {
      priorRcnaMatchKeySecret: 'x'.repeat(32),
      skip834Creation: true,
    };

    expect(getRcnoaProductionReadiness(environment, {
      mode: 'adhoc',
      businessConfiguration,
    })).toEqual({
      ready: true,
      missing: [],
      invalid: [],
      pendingContracts: [],
    });
  });

  test('does not require 834 configuration during RCNO to RCNA processing', () => {
    const environment = {
      RCNOA_EPDS_JDBC_URL: 'jdbc:oracle:thin:@epds',
      RCNOA_EPDS_USERNAME: 'user',
      RCNOA_EPDS_PASSWORD: 'secret',
      RCNOA_MDW_JDBC_URL: 'jdbc:oracle:thin:@mdw',
      RCNOA_MDW_USERNAME: 'user',
      RCNOA_MDW_PASSWORD: 'secret',
    };
    const businessConfiguration = { priorRcnaMatchKeySecret: 'x'.repeat(32) };

    expect(getRcnoaProductionReadiness(environment, {
      mode: 'adhoc',
      businessConfiguration,
      require834: false,
    })).toEqual({ ready: true, missing: [], invalid: [], pendingContracts: [] });
  });
});