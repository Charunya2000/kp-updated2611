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
export function getKpifTargetDatabases(envName) {
  const db = isMultiDbEnv(envName) ? DEV_UAT_DATABASES : PROD_DATABASES;
  return db;
}

/**
 * Get the dropdown options for the given environment.
 * Pass envName explicitly when calling from client components.
 */
export function getKpifTargetDatabaseOptions(envName) {
  return isMultiDbEnv(envName) ? DEV_UAT_OPTIONS : PROD_OPTIONS;
}

/**
 * Get the default target database for the given environment.
 */
export function getDefaultKpifTargetDatabase(envName) {
  return isMultiDbEnv(envName) ? 'perf' : 'default';
}

// Static exports evaluated at module load time.
// On the server, process.env.envName is set by configActions before Next.js loads modules.
const _envName = typeof process !== 'undefined' ? (process.env?.envName || 'dev') : 'dev';

export const KPIF_TARGET_DATABASES = getKpifTargetDatabases(_envName);

export const DEFAULT_KPIF_TARGET_DATABASE = getDefaultKpifTargetDatabase(_envName);

export const KPIF_TARGET_DATABASE_OPTIONS = getKpifTargetDatabaseOptions(_envName);

export function isValidKpifTargetDatabase(targetDatabase, envName) {
  const env = envName || _envName;
  return getKpifTargetDatabases(env).includes(targetDatabase);
}