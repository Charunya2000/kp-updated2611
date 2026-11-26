import oracledb from 'oracledb';
import { getRcnoaQueryConfiguration } from './rcnoaRepositoryService.js';
import { RCNOA_TIMEOUT_DEFAULTS } from './rcnoaBusinessConfigurationService.js';

const pools = new Map();
const LOOKUP_BATCH_SIZE = 300;
const RCNO_MRN_INDEX = 5;
const RCNO_MEMBER_SSN_INDEX = 19;

export function rcnoaDataSourceEnvironment(environment = process.env) {
  if (String(environment.RCNOA_LOCAL_TESTING).toLowerCase() !== 'true') {
    return environment;
  }
  return {
    ...environment,
    RCNOA_EPDS_JDBC_URL: environment.RCNOA_LOCAL_EPDS_JDBC_URL,
    RCNOA_EPDS_USERNAME: environment.RCNOA_LOCAL_EPDS_USERNAME,
    RCNOA_EPDS_PASSWORD: environment.RCNOA_LOCAL_EPDS_PASSWORD,
    RCNOA_MDW_JDBC_URL: environment.RCNOA_LOCAL_MDW_JDBC_URL,
    RCNOA_MDW_USERNAME: environment.RCNOA_LOCAL_MDW_USERNAME,
    RCNOA_MDW_PASSWORD: environment.RCNOA_LOCAL_MDW_PASSWORD,
  };
}

export function rcnoaQueryConfiguration(queryConfiguration, environment = process.env) {
  if (String(environment.RCNOA_LOCAL_TESTING).toLowerCase() !== 'true') {
    return queryConfiguration;
  }
  return {
    ...queryConfiguration,
    epdsQuery: environment.RCNOA_LOCAL_EPDS_QUERY?.trim() || queryConfiguration?.epdsQuery,
    mdwQuery: environment.RCNOA_LOCAL_MDW_QUERY?.trim() || queryConfiguration?.mdwQuery,
    mdwSsnBatchSize: environment.RCNOA_LOCAL_MDW_SSN_BATCH_SIZE?.trim()
      || queryConfiguration?.mdwSsnBatchSize,
  };
}

const SOURCE_CONFIG = Object.freeze({
  epds: {
    url: 'RCNOA_EPDS_JDBC_URL',
    username: 'RCNOA_EPDS_USERNAME',
    password: 'RCNOA_EPDS_PASSWORD',
    queryProperty: 'epdsQuery',
    expectedColumns: 4,
  },
  mdw: {
    url: 'RCNOA_MDW_JDBC_URL',
    username: 'RCNOA_MDW_USERNAME',
    password: 'RCNOA_MDW_PASSWORD',
    queryProperty: 'mdwQuery',
    expectedColumns: 19,
  },
});

function oracleConnectString(jdbcUrl) {
  return String(jdbcUrl || '').trim().replace(/^jdbc:oracle:thin:@/i, '');
}

function sourceSettings(source, queryConfiguration, environment = process.env) {
  const effectiveEnvironment = rcnoaDataSourceEnvironment(environment);
  const config = SOURCE_CONFIG[source];
  if (!config) throw new Error(`Unknown RCNOA Oracle source: ${source}`);
  const settings = {
    user: effectiveEnvironment[config.username],
    password: effectiveEnvironment[config.password],
    connectString: oracleConnectString(effectiveEnvironment[config.url]),
    query: queryConfiguration?.[config.queryProperty],
    expectedColumns: config.expectedColumns,
  };
  if (!settings.user || !settings.password || !settings.connectString || !settings.query) {
    throw new Error(`${source.toUpperCase()} Oracle connection or query configuration is incomplete`);
  }
  if (source === 'mdw' && !/:ssnsJson\b/.test(settings.query)) {
    throw new Error('MDW query must use :ssnsJson for early filtering');
  }
  if (source === 'mdw' && !/:mrnsJson\b/.test(settings.query)) {
    throw new Error('MDW query must use :mrnsJson for I-family membership matching');
  }
  return settings;
}

async function poolFor(source, queryConfiguration) {
  if (pools.has(source)) return pools.get(source);
  const settings = sourceSettings(source, queryConfiguration);
  const pool = await oracledb.createPool({
    poolAlias: `rcnoa-${source}`,
    user: settings.user,
    password: settings.password,
    connectString: settings.connectString,
    poolMin: 0,
    poolMax: 4,
    poolIncrement: 1,
    poolTimeout: 60,
    connectTimeout: 60000,
  });
  pools.set(source, pool);
  return pool;
}

function queryBinds(query, values) {
  const names = new Set([...query.matchAll(/:([a-zA-Z][a-zA-Z0-9_]*)/g)].map((match) => match[1]));
  return Object.fromEntries([...names].map((name) => {
    if (!(name in values)) throw new Error(`RCNOA query requires unsupported bind :${name}`);
    return [name, values[name]];
  }));
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

export function lookupBatchSize(source, queryConfiguration) {
  if (source !== 'mdw') return LOOKUP_BATCH_SIZE;
  const configured = Number(queryConfiguration?.mdwSsnBatchSize);
  return Number.isInteger(configured) && configured > 0 ? configured : LOOKUP_BATCH_SIZE;
}

export function lookupBatches(rcnoRecords, batchSize = LOOKUP_BATCH_SIZE) {
  const batches = [];
  for (let offset = 0; offset < rcnoRecords.length; offset += batchSize) {
    const records = rcnoRecords.slice(offset, offset + batchSize);
    batches.push({
      mrns: uniqueValues(records.map((record) => record[RCNO_MRN_INDEX])),
      ssns: uniqueValues(records.map((record) => record[RCNO_MEMBER_SSN_INDEX])),
    });
  }
  return batches.length ? batches : [{ mrns: [], ssns: [] }];
}

function scopedLookup(source, query, { businessDate, mrns, ssns }) {
  const values = {
    businessDate,
    mrnsJson: JSON.stringify(mrns),
    ssnsJson: JSON.stringify(ssns),
  };
  const queryBindNames = new Set(
    [...query.matchAll(/:([a-zA-Z][a-zA-Z0-9_]*)/g)].map((match) => match[1]),
  );
  if (queryBindNames.has('mrnsJson') || queryBindNames.has('ssnsJson')) {
    return { query, values, filterMode: 'query' };
  }

  const bindList = (prefix, items) => items.map((value, index) => {
    const name = `${prefix}${index}`;
    values[name] = value;
    return `:${name}`;
  }).join(', ');
  const mrnBinds = bindList('mrn', mrns);
  const ssnBinds = bindList('ssn', ssns);
  const predicates = source === 'mdw'
    ? [
      mrnBinds && `rcnoa_lookup.kp_mrn IN (${mrnBinds})`,
      ssnBinds && `rcnoa_lookup.member_ssn IN (${ssnBinds})`,
      ssnBinds && `rcnoa_lookup.subscriber_ssn IN (${ssnBinds})`,
    ].filter(Boolean)
    : [ssnBinds && `rcnoa_lookup.member_or_subscriber_ssn IN (${ssnBinds})`].filter(Boolean);
  return {
    query: `SELECT * FROM (${query}) rcnoa_lookup WHERE ${predicates.join(' OR ') || '1 = 0'}`,
    values,
    filterMode: 'outer-wrapper',
  };
}

async function loadSource(source, {
  businessDate,
  queryConfiguration,
  rcnoRecords,
  callTimeoutMs,
}) {
  const settings = sourceSettings(source, queryConfiguration);
  const pool = await poolFor(source, queryConfiguration);
  const connection = await pool.getConnection();
  connection.callTimeout = callTimeoutMs;
  const startedAt = Date.now();
  try {
    const batches = lookupBatches(rcnoRecords, lookupBatchSize(source, queryConfiguration));
    const recordsByValue = new Map();
    for (const [batchIndex, lookupKeys] of batches.entries()) {
      const scoped = scopedLookup(source, settings.query, { businessDate, ...lookupKeys });
      try {
        const result = await connection.execute(
          scoped.query,
          queryBinds(scoped.query, scoped.values),
          { outFormat: oracledb.OUT_FORMAT_ARRAY },
        );
        for (const record of result.rows || []) recordsByValue.set(JSON.stringify(record), record);
      } catch (error) {
        console.error(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'loadRcnoaOracleLookup',
            detail: {
              source,
              batch: batchIndex + 1,
              batchCount: batches.length,
              durationMs: Date.now() - startedAt,
              callTimeoutMs,
              errorCode: error.code || null,
              errorNumber: error.errorNum || null,
              error: String(error.message || error),
            },
          },
        }));
        throw error;
      }
    }
    const records = [...recordsByValue.values()];
    records.forEach((record, index) => {
      if (!Array.isArray(record) || record.length < settings.expectedColumns) {
        throw new Error(`${source.toUpperCase()} row ${index + 1} must contain at least ${settings.expectedColumns} columns`);
      }
    });
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'loadRcnoaOracleLookup',
        detail: { source, rowCount: records.length, durationMs: Date.now() - startedAt },
      },
    }));
    return records.map((record) => record.map((value) => value == null ? '' : String(value)));
  } finally {
    await connection.close();
  }
}

export async function loadRcnoaOracleLookups({
  businessDate,
  rcnoRecords,
  callTimeoutSeconds = RCNOA_TIMEOUT_DEFAULTS.oracleCallTimeoutSeconds,
}) {
  const queryConfiguration = rcnoaQueryConfiguration(await getRcnoaQueryConfiguration());
  const callTimeoutMs = Number(callTimeoutSeconds) * 1000;
  const [recent834Records, membershipRecords] = await Promise.all([
    loadSource('epds', { businessDate, queryConfiguration, rcnoRecords, callTimeoutMs }),
    loadSource('mdw', { businessDate, queryConfiguration, rcnoRecords, callTimeoutMs }),
  ]);
  return { recent834Records, membershipRecords };
}