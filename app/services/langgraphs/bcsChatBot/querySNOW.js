
import sql from 'mssql';
export async function getSNOWRecords(query) {
  let SNOWDB = 'SM_DW'
  const dbConfig = {
    user: process.env["kp.servicenow.reporting.database.user"],
    password: process.env["kp.servicenow.reporting.database.password"],
    server: process.env["kp.servicenow.reporting.database.host"],

    database: SNOWDB,
    port: 1433,
    options: { encrypt: true, trustServerCertificate: true }
  };
  let snowResponse = []
  try {
    // STEP 1: Get Quote IDs
    console.log(`[getServiceNowNode] Running SNOW Database Query`);
    const pool = await sql.connect(dbConfig);

    const snowResults = await pool.request().query(query);
    await pool.close();


    console.log(`[getServiceNowNode]  Found ${snowResults.recordset.length} records: `);
    if (snowResults.recordset.length > 0) {
      for (const result of snowResults.recordset) {
        snowResponse.push(result)
      }
    }


    return snowResponse;
  } catch (e) {
    console.warn('[getServiceNowData] Failed to process :', e.message);
    return []
  }
}