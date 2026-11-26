import oracledb from 'oracledb';

async function connectToOracle() {
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: 'APPUSER',
      password: '********',
      connectString: 'scan-pzendb221x.pldc.kp.org:1521/MCHUBUT1.pldc.kp.org' // e.g., 'localhost/XE' or an Easy Connect string
    });
    console.log('Successfully connected to Oracle!');
    const result = await connection.execute('SELECT 1 FROM DUAL');
    console.log('Query result:', result.rows[0][0]);
  } catch (err) {
    console.error('Error connecting to Oracle:', err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

connectToOracle();
