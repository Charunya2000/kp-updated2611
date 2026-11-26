const DEV_UAT_DATABASES = ['jpt', 'perf', 'rbc2', 'uat'];
const PROD_DATABASES = ['default'];

const DEV_UAT_OPTIONS = [
  { value: 'jpt', label: 'JPT' },
  { value: 'perf', label: 'Perf' },
  { value: 'rbc2', label: 'RBC2' },
  { value: 'uat', label: 'UAT' },
];
const PROD_OPTIONS = [{ value: 'default', label: 'Default' }];

function isMultiDbEnv(envName) {
  return envName === 'dev' || envName === 'uat';
}

/**
 * Get the list of valid target database keys for the given environment.
 * Pass envName explicitly when calling from client components.
 */
export function getTargetDatabases(envName) {
  const db = isMultiDbEnv(envName) ? DEV_UAT_DATABASES : PROD_DATABASES;
  return db;
}

/**
 * Get the dropdown options for the given environment.
 * Pass envName explicitly when calling from client components.
 */
export function getTargetDatabaseOptions(envName) {
  return isMultiDbEnv(envName) ? DEV_UAT_OPTIONS : PROD_OPTIONS;
}

/**
 * Get the default target database for the given environment.
 */
export function getDefaultTargetDatabase(envName) {
  return isMultiDbEnv(envName) ? 'perf' : 'default';
}

// Static exports evaluated at module load time.
// On the server, process.env.envName is set by configActions before Next.js loads modules.
const _envName = typeof process !== 'undefined' ? (process.env?.envName || 'dev') : 'dev';

export const TARGET_DATABASES = getTargetDatabases(_envName);

export const DEFAULT_TARGET_DATABASE = getDefaultTargetDatabase(_envName);

export const TARGET_DATABASE_OPTIONS = getTargetDatabaseOptions(_envName);

export function isValidTargetDatabase(targetDatabase, envName) {
  const env = envName || _envName;
  return getTargetDatabases(env).includes(targetDatabase);
}