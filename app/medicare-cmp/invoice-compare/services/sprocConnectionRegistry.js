/**
 * In-memory registry of Oracle connections that are currently executing the
 * MEDICARE_CMP_RUN_BATCH stored procedure.
 *
 * This allows the cancel endpoint to call `connection.break()` on a running
 * sproc, which interrupts execution and causes Oracle to roll back any
 * uncommitted work in the main transaction.
 *
 * The registry is keyed by runId (number). Each entry holds the connection
 * reference. Entries are removed when the sproc completes or is canceled.
 */

/** @type {Map<number, import('oracledb').Connection>} */
const registry = new Map();

/**
 * Register a connection that is executing a sproc for the given runId.
 * @param {number} runId
 * @param {import('oracledb').Connection} connection
 */
export function registerSprocConnection(runId, connection) {
  registry.set(runId, connection);
}

/**
 * Remove a connection from the registry (called on sproc completion or after break).
 * @param {number} runId
 */
export function unregisterSprocConnection(runId) {
  registry.delete(runId);
}

/**
 * Break (interrupt) the Oracle connection running the sproc for the given runId.
 * Returns true if a connection was found and broken, false otherwise.
 * @param {number} runId
 * @returns {Promise<boolean>}
 */
export async function breakSprocConnection(runId) {
  const connection = registry.get(runId);
  if (!connection) return false;

  try {
    await connection.break();
    return true;
  } catch {
    return false;
  }
}
