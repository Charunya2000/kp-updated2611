import {
  lookupBatchSize,
  lookupBatches,
  rcnoaDataSourceEnvironment,
  rcnoaQueryConfiguration,
} from '../rcnoaOracleService.js';

describe('rcnoaOracleService', () => {
  test('uses only unique member SSNs for Oracle lookups', () => {
    const record = (memberSsn, alternateMemberSsn, subscriberSsn) => {
      const values = Array(23).fill('');
      values[19] = memberSsn;
      values[20] = alternateMemberSsn;
      values[22] = subscriberSsn;
      return values;
    };

    expect(lookupBatches([
      record('111111111', '222222222', '333333333'),
      record('111111111', '444444444', '555555555'),
      record('666666666', '777777777', '888888888'),
    ])[0].ssns).toEqual(['111111111', '666666666']);
  });

  test('accepts a caller-provided record batch size', () => {
    const records = Array.from({ length: 5 }, (_, index) => {
      const values = Array(23).fill('');
      values[19] = String(index + 1).padStart(9, '0');
      return values;
    });

    expect(lookupBatches(records, 2).map((batch) => batch.ssns.length)).toEqual([2, 2, 1]);
  });

  test('reads the MDW batch size from configuration and falls back to 300', () => {
    expect(lookupBatchSize('mdw', { mdwSsnBatchSize: 800 })).toBe(800);
    expect(lookupBatchSize('mdw', { mdwSsnBatchSize: '125' })).toBe(125);
    expect(lookupBatchSize('mdw', {})).toBe(300);
    expect(lookupBatchSize('mdw', { mdwSsnBatchSize: 0 })).toBe(300);
    expect(lookupBatchSize('mdw', { mdwSsnBatchSize: 'abc' })).toBe(300);
    expect(lookupBatchSize('mdw', undefined)).toBe(300);
    expect(lookupBatchSize('epds', { mdwSsnBatchSize: 800 })).toBe(300);
  });

  test('uses local query overrides only when local testing is enabled', () => {
    const stored = { epdsQuery: 'stored epds', mdwQuery: 'stored mdw', mdwSsnBatchSize: 300 };
    const environment = {
      RCNOA_LOCAL_TESTING: 'true',
      RCNOA_LOCAL_EPDS_QUERY: 'local epds',
      RCNOA_LOCAL_MDW_QUERY: 'local mdw',
      RCNOA_LOCAL_MDW_SSN_BATCH_SIZE: '25',
    };

    expect(rcnoaQueryConfiguration(stored, environment)).toEqual({
      epdsQuery: 'local epds',
      mdwQuery: 'local mdw',
      mdwSsnBatchSize: '25',
    });
    expect(rcnoaQueryConfiguration(stored, { ...environment, RCNOA_LOCAL_TESTING: 'false' }))
      .toBe(stored);
  });

  test('uses local data source properties only when local testing is enabled', () => {
    const environment = {
      RCNOA_LOCAL_TESTING: 'true',
      RCNOA_EPDS_JDBC_URL: 'configured epds',
      RCNOA_LOCAL_EPDS_JDBC_URL: 'local epds',
      RCNOA_LOCAL_EPDS_USERNAME: 'local epds user',
      RCNOA_LOCAL_EPDS_PASSWORD: 'local epds password',
      RCNOA_LOCAL_MDW_JDBC_URL: 'local mdw',
      RCNOA_LOCAL_MDW_USERNAME: 'local mdw user',
      RCNOA_LOCAL_MDW_PASSWORD: 'local mdw password',
    };

    expect(rcnoaDataSourceEnvironment(environment)).toMatchObject({
      RCNOA_EPDS_JDBC_URL: 'local epds',
      RCNOA_EPDS_USERNAME: 'local epds user',
      RCNOA_EPDS_PASSWORD: 'local epds password',
      RCNOA_MDW_JDBC_URL: 'local mdw',
      RCNOA_MDW_USERNAME: 'local mdw user',
      RCNOA_MDW_PASSWORD: 'local mdw password',
    });
    expect(rcnoaDataSourceEnvironment({ ...environment, RCNOA_LOCAL_TESTING: 'false' }))
      .toMatchObject({ RCNOA_EPDS_JDBC_URL: 'configured epds' });
  });

});