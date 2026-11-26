import {
  DEFAULT_RCNOA_QUERY_CONFIGURATION,
  validateRcnoaQueryConfiguration,
} from '../rcnoaQueryConfigurationService.js';

describe('rcnoaQueryConfigurationService', () => {
  test('accepts and normalizes the default queries', () => {
    const result = validateRcnoaQueryConfiguration({
      mdwSsnBatchSize: DEFAULT_RCNOA_QUERY_CONFIGURATION.mdwSsnBatchSize,
      epdsQuery: `${DEFAULT_RCNOA_QUERY_CONFIGURATION.epdsQuery};`,
      mdwQuery: `  ${DEFAULT_RCNOA_QUERY_CONFIGURATION.mdwQuery}  `,
    });

    expect(result.mdwSsnBatchSize).toBe(300);
    expect(result.epdsQuery).toBe(DEFAULT_RCNOA_QUERY_CONFIGURATION.epdsQuery);
    expect(result.mdwQuery).toBe(DEFAULT_RCNOA_QUERY_CONFIGURATION.mdwQuery);
  });

  test('accepts the SSN and MRN lookup binds for MDW filtering', () => {
    const result = validateRcnoaQueryConfiguration({
      mdwSsnBatchSize: 125,
      epdsQuery: 'select :businessDate from dual',
      mdwQuery: 'select :businessDate, :ssnsJson, :mrnsJson from dual',
    });

    expect(result.mdwQuery).toContain(':ssnsJson');
    expect(result.mdwQuery).toContain(':mrnsJson');
    expect(result.mdwSsnBatchSize).toBe(125);
  });

  test('accepts MDW queries that use both SSN and MRN lookup binds', () => {
    const result = validateRcnoaQueryConfiguration({
      mdwSsnBatchSize: 125,
      epdsQuery: 'select :businessDate from dual',
      mdwQuery: 'select :businessDate, :ssnsJson, :mrnsJson from dual',
    });

    expect(result.mdwQuery).toContain(':ssnsJson');
    expect(result.mdwQuery).toContain(':mrnsJson');
  });

  test('orders default MDW membership rows by highest coverage end date', () => {
    const query = DEFAULT_RCNOA_QUERY_CONFIGURATION.mdwQuery;

    expect(query).toContain(':mrnsJson');
    expect(query).toMatch(/member_person\.MRN_NB = LTRIM\s*\(SUBSTR\s*\(lookup\.lookup_key, 3, 12\), '0'\)/);
    expect(query).toMatch(/member_person\.MRN_PFX_NB = TO_CHAR\(TO_NUMBER\(SUBSTR\s*\(lookup\.lookup_key, 1, 2\)\)\)/);
    expect(query).toContain('ORDER BY coverage_end_date DESC NULLS LAST, kp_mrn');
  });

  test('uses the base MDW region and latest membership-line candidate rules', () => {
    const query = DEFAULT_RCNOA_QUERY_CONFIGURATION.mdwQuery;

    expect(query).toContain('MAX(membership.LNE_NB) OVER');
    expect(query).toContain('WHERE LNE_NB = max_lne_nb');
    expect(query.match(/rgn_cd in \('SC','NC'\)/gi)).toHaveLength(2);
  });

  test('uses the SSN batch ceiling to optimize MDW candidate joins', () => {
    const query = DEFAULT_RCNOA_QUERY_CONFIGURATION.mdwQuery;

    expect(query).toContain('CARDINALITY(lookup 900) USE_HASH(person)');
    expect(query).toContain('CARDINALITY(candidate 900) USE_NL(membership)');
    expect(query).not.toContain('CARDINALITY(candidate 2)');
  });

  test('looks up optional death data without materializing all candidate deaths', () => {
    const query = DEFAULT_RCNOA_QUERY_CONFIGURATION.mdwQuery;

    expect(query.match(/OUTER APPLY/g)).toHaveLength(2);
    expect(query).not.toContain('person_death AS');
    expect(query).not.toContain('candidate_members AS');
  });

  test('deduplicates rows produced by matching coverage options', () => {
    expect(DEFAULT_RCNOA_QUERY_CONFIGURATION.mdwQuery).toMatch(
      /\)\s*SELECT DISTINCT\s+member_person\.MRN_PFX_NB \|\| LPAD\(TO_CHAR\(member_person\.MRN_NB\), 10, '0'\) AS kp_mrn/,
    );
  });

  test('joins coverage using the leading composite index columns', () => {
    const query = DEFAULT_RCNOA_QUERY_CONFIGURATION.mdwQuery;

    expect(query).toContain('coverage.PRSN_IK = membership.PRSN_IK');
    expect(query).toContain('coverage.RGN_CD = membership.RGN_CD');
    expect(query).toContain('coverage.MBRSHP_LNE_NB = membership.LNE_NB');
  });

  test('maps the MENR enrollment span and code at membership-line grain', () => {
    const query = DEFAULT_RCNOA_QUERY_CONFIGURATION.mdwQuery;

    expect(query).toContain("TO_CHAR(membership.MBRSHP_EFF_STRT_DT, 'YYYYMMDD')");
    expect(query).toContain("TO_CHAR(membership.MBRSHP_EFF_END_DT, 'YYYYMMDD')");
    expect(query).toContain('coverage.SRC_SYS_KEY_3_TX AS plan_code');
    expect(query).not.toContain('TO_CHAR(coverage.MBRSHP_CVRG_OPTN_EFF_STRT_DT');
  });

  test.each([
    ['missing batch size', { epdsQuery: 'select :businessDate from dual', mdwQuery: 'select :businessDate, :ssnsJson from dual' }, 'MDW SSN batch size'],
    ['fractional batch size', { mdwSsnBatchSize: 1.5, epdsQuery: 'select :businessDate from dual', mdwQuery: 'select :businessDate, :ssnsJson from dual' }, 'MDW SSN batch size'],
    ['oversized batch', { mdwSsnBatchSize: 5001, epdsQuery: 'select :businessDate from dual', mdwQuery: 'select :businessDate, :ssnsJson from dual' }, 'MDW SSN batch size'],
    ['missing SQL', { mdwSsnBatchSize: 300, epdsQuery: '', mdwQuery: 'select :businessDate from dual' }, 'EPDS query is required'],
    ['mutating SQL', { mdwSsnBatchSize: 300, epdsQuery: 'delete from records', mdwQuery: 'select :businessDate from dual' }, 'must be a SELECT or WITH'],
    ['mutating CTE', { mdwSsnBatchSize: 300, epdsQuery: 'with changed as (delete from records) select :businessDate from dual', mdwQuery: 'select :businessDate from dual' }, 'must be read-only'],
    ['multiple statements', { mdwSsnBatchSize: 300, epdsQuery: 'select :businessDate from dual; select 1 from dual', mdwQuery: 'select :businessDate from dual' }, 'must contain one statement'],
    ['unsupported bind', { mdwSsnBatchSize: 300, epdsQuery: 'select :startDate from dual', mdwQuery: 'select :businessDate from dual' }, 'unsupported bind :startDate'],
    ['missing bind', { mdwSsnBatchSize: 300, epdsQuery: 'select 1 from dual', mdwQuery: 'select :businessDate from dual' }, 'must use :businessDate'],
    ['unscoped MDW SQL', { mdwSsnBatchSize: 300, epdsQuery: 'select :businessDate from dual', mdwQuery: 'select :businessDate from dual' }, 'must use :ssnsJson'],
    ['MDW SQL without MRN scope', { mdwSsnBatchSize: 300, epdsQuery: 'select :businessDate from dual', mdwQuery: 'select :businessDate, :ssnsJson from dual' }, 'must use :mrnsJson'],
  ])('rejects %s', (name, configuration, expected) => {
    expect(() => validateRcnoaQueryConfiguration(configuration)).toThrow(expected);
  });
});