import oracledb from 'oracledb';

import { setProcessEnvironment } from './configActions.js';
import { loadEnvLocal } from '../utils/envLoader.js';

function oracleConnectString(jdbcUrl) {
  return String(jdbcUrl || '').trim().replace(/^jdbc:oracle:thin:@/i, '');
}

async function main() {
  loadEnvLocal();
  await setProcessEnvironment();

  const envName = process.env.envName || 'dev';
  const keyPrefix = `host.${envName}-aiportal-web-2.rcnoa.mdw`;
  const user = process.env.RCNOA_MDW_USERNAME;
  const password = process.env.RCNOA_MDW_PASSWORD;
  const connectString = oracleConnectString(process.env.RCNOA_MDW_JDBC_URL);
  const missing = [
    !user && `${keyPrefix}.username`,
    !password && `${keyPrefix}.password`,
    !connectString && `${keyPrefix}.jdbc.url`,
  ].filter(Boolean);

  if (missing.length) throw new Error(`Missing KP Config properties: ${missing.join(', ')}`);

  let pool;
  let connection;
  try {
    pool = await oracledb.createPool({
      poolAlias: 'rcnoa-mdw-connection-test',
      user,
      password,
      connectString,
      poolMin: 0,
      poolMax: 4,
      poolIncrement: 1,
      poolTimeout: 60,
      connectTimeout: 60000,
    });
    connection = await pool.getConnection();
    await connection.execute('SELECT 1 AS CONNECTION_TEST FROM DUAL');
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'testRcnoaMdwConnection',
        detail: { stage: 'connectionSucceeded' },
      },
    }));
  } finally {
    await connection?.close();
    await pool?.close(0);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'testRcnoaMdwConnection',
      detail: {
        stage: 'connectionFailed',
        errorCode: error.code || null,
        errorNumber: error.errorNum || null,
        error: String(error.message || error),
      },
    },
  }));
  process.exitCode = 1;
});