import sql from 'mssql';

const normalizeQueryOptions = (queryOrOptions) => {
  if (typeof queryOrOptions === 'string') {
    return { query: queryOrOptions, parameters: [] };
  }

  return {
    query: queryOrOptions?.query,
    parameters: Array.isArray(queryOrOptions?.parameters) ? queryOrOptions.parameters : []
  };
};

export async function getSNOWRecords(queryOrOptions) {
  let SNOWDB = 'SM_DW'
  const dbConfig = {
    user: process.env["kp.servicenow.reporting.database.user"],
    password: process.env["kp.servicenow.reporting.database.password"],
    server: process.env["kp.servicenow.reporting.database.host"],

    database: SNOWDB,
    port: 1433,
    options: { encrypt: true, trustServerCertificate: true }
  };
  const { query, parameters } = normalizeQueryOptions(queryOrOptions);

  if (!query) {
    throw new Error('A SQL query is required.');
  }

  let snowResponse = []
  let pool;
  try {
    // STEP 1: Run the Query
    console.log(`[ODW SQL] Running SNOW Database Query`);
    pool = await sql.connect(dbConfig);
    const request = pool.request();

    parameters.forEach(({ name, type, value }) => {
      request.input(name, type || sql.NVarChar, value);
    });

    const snowResults = await request.query(query);


    console.log(`[ODW SQL]  Found ${snowResults.recordset.length} records: `);
    if (snowResults.recordset.length > 0) {
      for (const result of snowResults.recordset) {
        snowResponse.push(result)
      }
    }


    return snowResponse;
  } catch (e) {
    console.warn('[ODW SQL] Failed to process :', e.message);
    return []
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

