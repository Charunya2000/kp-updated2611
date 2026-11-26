import oracledb from 'oracledb';

const pools = {};

export function getOracleConnectionConfig(account = null) {
  const envName = process.env.envName || 'dev';
  let user = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.user`];
  let password = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.password`];
  let connectString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.url`];

  switch (account) {
    case 'COMPARE_OWNER_JPT':
      user = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.jpt.user`];
      password = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.jpt.password`];
      connectString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.jpt.url`];
      break;
    case 'COMPARE_OWNER_PERF':
      user = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.perf.user`];
      password = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.perf.password`];
      connectString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.perf.url`];
      break;
    case 'COMPARE_OWNER_RBC2':
      user = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.rbc2.user`];
      password = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.rbc2.password`];
      connectString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.rbc2.url`];
      break;
    case 'COMPARE_OWNER_UAT':
      user = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.uat.user`];
      password = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.uat.password`];
      connectString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.uat.url`];
      break;
    case 'APPUSER_JPT':
      user = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.jpt.user`];
      password = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.jpt.password`];
      connectString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.jpt.url`];
      break;
    case 'APPUSER_PERF':
      user = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.perf.user`];
      password = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.perf.password`];
      connectString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.perf.url`];
      break;
    case 'APPUSER_RBC2':
      user = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.rbc2.user`];
      password = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.rbc2.password`];
      connectString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.rbc2.url`];
      break;
    case 'APPUSER_UAT':
      user = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.uat.user`];
      password = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.uat.password`];
      connectString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.uat.url`];
      break;
	case 'BCS':
      user = process.env[`host.${envName}-aiportal-web-2.bcs.oracle.user`],//process.env.BASE_ORACLE_USER
      password = process.env[`host.${envName}-aiportal-web-2.bcs.oracle.password`],//process.env.BASE_ORACLE_PASSWORD
      connectString = process.env[`host.${envName}-aiportal-web-2.bcs.oracle.dsn`]//process.env.BASE_ORACLE_DSN,
      break;
    default:
      break;
  }

  return { user, password, connectString };
}

async function getPool(account) {
  const poolKey = account || 'DEFAULT';

  if (pools[poolKey]) {
    return pools[poolKey];
  }

  const connectionConfig = getOracleConnectionConfig(account);

  pools[poolKey] = await oracledb.createPool({
    user: connectionConfig.user,
    password: connectionConfig.password,
    connectString: connectionConfig.connectString,
    poolTimeout: 60,
    connectTimeout: 5 * 60 * 1000,
  });

  return pools[poolKey];
}

export async function getOracleConnection(account = null) {
  const pool = await getPool(account);
  let connection;
  try {
    connection = await pool.getConnection();
    return connection;
  } catch (err) {
    console.error('Error connecting to Oracle:', err);
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

export const oracleAccounts = (() => {
  const envName = process.env.envName || 'dev';
  if (envName === 'dev' || envName === 'uat') {
    return {
      COMPARE_OWNER_JPT: 'COMPARE_OWNER_JPT',
      COMPARE_OWNER_PERF: 'COMPARE_OWNER_PERF',
      COMPARE_OWNER_RBC2: 'COMPARE_OWNER_RBC2',
      COMPARE_OWNER_UAT: 'COMPARE_OWNER_UAT',
      APPUSER_JPT: 'APPUSER_JPT',
      APPUSER_PERF: 'APPUSER_PERF',
      APPUSER_RBC2: 'APPUSER_RBC2',
      APPUSER_UAT: 'APPUSER_UAT',
    };
  }
  return {
    COMPARE_OWNER_JPT: null,
    COMPARE_OWNER_PERF: null,
    COMPARE_OWNER_RBC2: null,
    COMPARE_OWNER_UAT: null,
    APPUSER_JPT: null,
    APPUSER_PERF: null,
    APPUSER_RBC2: null,
    APPUSER_UAT: null,
    APPUSER_DEFAULT: 'APPUSER_DEFAULT'
  };
})();