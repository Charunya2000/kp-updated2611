export async function queryDB2(sql, params = []) {
  let finalSql = sql;

  // 1. Replace all '?' in the SQL string with the actual parameters
  if (params && params.length > 0) {
    params.forEach(param => {
      let formattedParam = 'NULL';
      if (param !== null && param !== undefined) {
        // If the parameter is a string, wrap it in single quotes for SQL
        formattedParam = typeof param === 'string' ? `'${param}'` : param;
      }
      finalSql = finalSql.replace('?', formattedParam);
    });
  }

  // 2. Define the Python API Endpoint
  const ORCHESTRATION_APP_URL = process.env.ORCHESTRATION_APP_URL;
  const DB2_API_URL = `${ORCHESTRATION_APP_URL}/api/db2/query`;

  console.log(`[API REQUEST] Sending Query to Python DB2: ${finalSql}`);

  try {
    // 3. Make the POST request to the Python API
    const response = await fetch(DB2_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql_query: finalSql })
    });

    if (!response.ok) {
      throw new Error(`Python DB2 API failed with status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.detail || "Python API returned success: False");
    }

    // Return the data array exactly how the old IBM DB2 driver used to!
    return result.data;

  } catch (error) {
    console.error("[DB2 PYTHON WRAPPER ERROR]:", error.message);
    throw error;
  }
}