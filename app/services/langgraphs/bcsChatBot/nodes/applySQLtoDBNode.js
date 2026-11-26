'use server';

import { getOracleConnection } from '../../../oracleService';

export async function applySQLtoDBNode(state) {
  let connection;
  try {
    // Get a connection from the pool
    connection = await getOracleConnection();

    if (!state.updateSQL || !state.updateSQL.trim()) {
      throw new Error('No SQL update query provided in state');
    }

    // Execute the update query
    const result = await connection.execute(
      state.updateSQL,
      state.queryBindings || [], // use bindings if provided, empty array if not
      {
        autoCommit: true // ensure the transaction is committed
      }
    );

    // Return updated state with rows affected
    return {
      ...state,
      rowsAffected: result.rowsAffected,
      dbOperationSuccess: true
    };

  } catch (error) {
    console.error('Error in applySQLtoDBNode:', error);
    return {
      ...state,
      dbOperationSuccess: false,
      dbError: error.message
    };
  } finally {
    if (connection) {
      try {
        // Release the connection back to the pool
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}
