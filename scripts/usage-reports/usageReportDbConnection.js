import https from 'https';
import { MongoClient } from 'mongodb';
import { loadEnvLocal } from '../../utils/envLoader.js';

// Cache connections by environment + database name.
// Each entry stores both the Db handle (returned to callers) and the MongoClient
// (needed for cleanup — the Db object doesn't expose a public `client` property).
const connectionCache = new Map();

// Cache resolved KP Config sources per environment so we only hit the KP Config
// service once per target environment per process.
const envConfigCache = new Map();

export async function connectToEnvironmentDatabase(environment, databaseName) {
  const cacheKey = `${environment}:${databaseName}`;

  if (connectionCache.has(cacheKey)) {
    return connectionCache.get(cacheKey).db;
  }

  const envConfig = await getEnvironmentConfig(environment);

  if (!envConfig.mongoUri) {
    throw new Error(`Mongo endpoint not found in KP Config for environment '${environment}'`);
  }

  const client = new MongoClient(envConfig.mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    // Migration-specific options
    maxIdleTimeMS: 30000,
  });

  await client.connect();
  const database = client.db(databaseName);

  connectionCache.set(cacheKey, { db: database, client });
  return database;
}

/**
 * List all `team-*-db` database names for the given environment.
 *
 * Uses the cached MongoClient (creating a connection via aisvc_userdb if needed)
 * to run `admin().listDatabases()`, then filters and sorts the results. Callers
 * should use this helper rather than reaching into the driver's internals
 * (e.g. `db.client.db().admin()`), which is not part of the public MongoDB
 * Node.js driver API.
 *
 * @param {string} environment - e.g. 'dev', 'uat', 'pp'
 * @returns {Promise<string[]>} sorted list of team database names
 */
export async function listTeamDatabases(environment) {
  // Ensure we have a live connection for this environment.
  await connectToEnvironmentDatabase(environment, 'aisvc_userdb');
  const { client } = connectionCache.get(`${environment}:aisvc_userdb`);

  const { databases } = await client.db().admin().listDatabases();
  return databases
    .map((d) => d.name)
    .filter((name) => /^team-.+-db$/.test(name))
    .sort();
}

/**
 * calling the KP Config service directly. Does NOT mutate `process.env`, so
 * calling this from a running deployment (e.g. dev) to reach another
 * environment (e.g. uat / pp) will not clobber the current process's config.
 */
async function getEnvironmentConfig(environment) {
  if (envConfigCache.has(environment)) {
    return envConfigCache.get(environment);
  }

  // Ensure KPCONFIG_* creds are available for local dev; no-op if not present.
  loadEnvLocal();

  const source = await fetchKpConfigSource(environment);
  const mongoUri = source[`host.${environment}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mongodb.endpoint`];

  const config = { mongoUri };
  envConfigCache.set(environment, config);
  return config;
}

/**
 * Fetch the `propertySources[0].source` object from KP Config for the given
 * environment. Uses the current process's KPCONFIG_* credentials (which
 * authenticate against KP Config itself) to look up the target env's profile
 * (e.g. `genai-port-client-uat`).
 *
 * @param {string} environment - e.g. 'dev', 'uat', 'pp'
 * @returns {Promise<Record<string, string>>} the raw KP Config source object
 */
function fetchKpConfigSource(environment) {
  const kpConfigURI = process.env.KPCONFIG_URI;
  const kpConfigName = process.env.KPCONFIG_NAME;
  const kpConfigLabel = process.env.KPCONFIG_LABEL;
  const kpConfigUser = process.env.KPCONFIG_USER;
  const kpConfigPassword = process.env.KPCONFIG_PASSWORD;
  const kpConfigAccessToken = process.env.KPCONFIG_ACCESSTOKEN;

  if (!kpConfigURI || !kpConfigName || !kpConfigLabel || !kpConfigUser || !kpConfigPassword || !kpConfigAccessToken) {
    return Promise.reject(new Error(
      'KP Config credentials are not configured (KPCONFIG_URI, KPCONFIG_NAME, KPCONFIG_LABEL, KPCONFIG_USER, KPCONFIG_PASSWORD, KPCONFIG_ACCESSTOKEN)'
    ));
  }

  const kpConfigProfile = `genai-port-client-${environment}`;
  const kpConfigPath = `/${kpConfigName}/${kpConfigProfile}/${kpConfigLabel}`;

  // KPCONFIG_URI may include a scheme (http/https) — extract just the hostname.
  const kpConfigHost = new URL(kpConfigURI).hostname;

  const base64Credentials = Buffer.from(`${kpConfigUser}:${kpConfigPassword}`).toString('base64');
  const kpConfigAuthorization = `Basic ${base64Credentials}`;

  const options = {
    hostname: kpConfigHost,
    path: kpConfigPath,
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      'access_token': kpConfigAccessToken,
      'Authorization': kpConfigAuthorization,
      'Accept': '*/*',
      'Host': kpConfigHost,
      'Accept-Encoding': 'gzip, deflate, br',
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');

        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`KP Config request for '${kpConfigProfile}' failed with status ${res.statusCode}`));
          return;
        }

        try {
          const parsed = JSON.parse(body);
          const source = parsed?.propertySources?.[0]?.source;
          if (!source) {
            reject(new Error(`KP Config response for '${kpConfigProfile}' is missing propertySources[0].source`));
            return;
          }
          resolve(source);
        } catch (err) {
          reject(new Error(`Failed to parse KP Config response for '${kpConfigProfile}': ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

export async function closeMigrationConnections() {
  // Helper to clean up all migration connections
  for (const { client } of connectionCache.values()) {
    try {
      await client.close();
    } catch {
      // best-effort cleanup
    }
  }
  connectionCache.clear();
  envConfigCache.clear();
}