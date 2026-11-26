import {
  publicRcnoaBusinessConfiguration,
  seedRcnoaBusinessConfiguration,
  validateRcnoaBusinessConfiguration,
} from '../rcnoaBusinessConfigurationService.js';

describe('rcnoaBusinessConfigurationService', () => {
  test('normalizes editable JSON and applies the approved N12 default', () => {
    expect(validateRcnoaBusinessConfiguration({
      envelope: '{"senderId":"sender"}',
      intentByCode: '{}',
      relationshipMap: {},
      addressLine3Mode: 'reject',
    })).toEqual(expect.objectContaining({
      n12Code: 'AE999',
      envelope: { senderId: 'sender' },
      addressLine3Mode: 'reject',
      reusePriorRcnaDecisions: true,
      ignoreFirstRcnoColumn: false,
      ignoreLastRcnoColumn: false,
      skip834Creation: false,
      processingInactivityMinutes: 30,
      oracleCallTimeoutSeconds: 240,
      sftpConnectionTimeoutSeconds: 30,
    }));
  });

  test('validates configurable processing and connection timeouts', () => {
    const configuration = {
      envelope: {},
      intentByCode: {},
      relationshipMap: {},
      processingInactivityMinutes: 20,
      oracleCallTimeoutSeconds: 600,
      sftpConnectionTimeoutSeconds: 45,
    };

    expect(validateRcnoaBusinessConfiguration(configuration)).toEqual(expect.objectContaining({
      processingInactivityMinutes: 20,
      oracleCallTimeoutSeconds: 600,
      sftpConnectionTimeoutSeconds: 45,
    }));
    expect(() => validateRcnoaBusinessConfiguration({
      ...configuration,
      processingInactivityMinutes: 481,
    })).toThrow('Processing inactivity timeout must be an integer from 5 through 480');
  });

  test('retains an existing write-only secret when the submitted value is blank', () => {
    const result = validateRcnoaBusinessConfiguration({
      envelope: {},
      intentByCode: {},
      relationshipMap: {},
      priorRcnaMatchKeySecret: '',
    }, { priorRcnaMatchKeySecret: 'x'.repeat(32) });

    expect(result.priorRcnaMatchKeySecret).toBe('x'.repeat(32));
  });

  test('normalizes the skip 834 creation setting as a strict boolean', () => {
    const configuration = {
      envelope: {},
      intentByCode: {},
      relationshipMap: {},
    };

    expect(validateRcnoaBusinessConfiguration({
      ...configuration,
      skip834Creation: true,
    }).skip834Creation).toBe(true);
    expect(validateRcnoaBusinessConfiguration({
      ...configuration,
      skip834Creation: 'true',
    }).skip834Creation).toBe(false);
  });

  test('defaults prior RCNA decision reuse on and supports disabling it', () => {
    const configuration = { envelope: {}, intentByCode: {}, relationshipMap: {} };

    expect(validateRcnoaBusinessConfiguration(configuration).reusePriorRcnaDecisions).toBe(true);
    expect(validateRcnoaBusinessConfiguration({
      ...configuration,
      reusePriorRcnaDecisions: false,
    }).reusePriorRcnaDecisions).toBe(false);
  });

  test('defaults leading RCNO column handling off and supports enabling it', () => {
    const configuration = { envelope: {}, intentByCode: {}, relationshipMap: {} };

    expect(validateRcnoaBusinessConfiguration(configuration).ignoreFirstRcnoColumn).toBe(false);
    expect(validateRcnoaBusinessConfiguration({
      ...configuration,
      ignoreFirstRcnoColumn: true,
    }).ignoreFirstRcnoColumn).toBe(true);
  });

  test('defaults trailing RCNO column handling off and supports enabling it', () => {
    const configuration = { envelope: {}, intentByCode: {}, relationshipMap: {} };

    expect(validateRcnoaBusinessConfiguration(configuration).ignoreLastRcnoColumn).toBe(false);
    expect(validateRcnoaBusinessConfiguration({
      ...configuration,
      ignoreLastRcnoColumn: true,
    }).ignoreLastRcnoColumn).toBe(true);
  });

  test('never exposes the match-key secret in the public configuration', () => {
    const result = publicRcnoaBusinessConfiguration({
      version: 2,
      priorRcnaMatchKeySecret: 'secret-value',
    });

    expect(result).toEqual({ version: 2, priorRcnaMatchKeySecretConfigured: true });
    expect(JSON.stringify(result)).not.toContain('secret-value');
  });

  test('seeds the initial Mongo document from existing environment values', () => {
    const result = seedRcnoaBusinessConfiguration({
      RCNOA_834_ENVELOPE_JSON: '{"usageIndicator":"T"}',
      RCNOA_834_INTENT_BY_CODE_JSON: '{}',
      RCNOA_834_RELATIONSHIP_MAP_JSON: '{}',
      RCNOA_PRIOR_RCNA_MATCH_KEY_SECRET: 'x'.repeat(32),
    });

    expect(result.envelope).toEqual({ usageIndicator: 'T' });
    expect(result.reusePriorRcnaDecisions).toBe(true);
    expect(result).not.toHaveProperty('fileContractApproved');
  });

  test('seeds disabled prior RCNA reuse from the environment', () => {
    const result = seedRcnoaBusinessConfiguration({
      RCNOA_834_ENVELOPE_JSON: '{}',
      RCNOA_834_INTENT_BY_CODE_JSON: '{}',
      RCNOA_834_RELATIONSHIP_MAP_JSON: '{}',
      RCNOA_REUSE_PRIOR_RCNA_DECISIONS: 'false',
    });

    expect(result.reusePriorRcnaDecisions).toBe(false);
  });

  test('rejects invalid JSON and short replacement secrets', () => {
    expect(() => validateRcnoaBusinessConfiguration({ envelope: '{' }))
      .toThrow('834 envelope must contain valid JSON');
    expect(() => validateRcnoaBusinessConfiguration({
      envelope: {},
      intentByCode: {},
      relationshipMap: {},
      priorRcnaMatchKeySecret: 'short',
    })).toThrow('at least 32 characters');
  });
});