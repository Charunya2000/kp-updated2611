'use client';

/**
 * Submit a batch entry for Medicare comparison processing.
 * @param {object} params
 * @param {string} params.targetDatabase - 'default' | 'jpt' | 'perf'
 * @param {string} params.batchNumber - The batch number to process
 * @param {string} params.processedOn - The processed-on date (YYYY-MM-DD)
 * @param {boolean} [params.refresh=true] - Whether to overwrite an existing entry
 * @returns {Promise<object>} The BackgroundJob document from MongoDB
 */
export async function submitBatchEntry({ targetDatabase, batchNumber, processedOn, refresh = true }) {
  if (!batchNumber) {
    return { error: 'Batch Number is required.' };
  }

  if (!processedOn) {
    return { error: 'Processed On date is required.' };
  }

  const response = await fetch('/api/medicare/batch-entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetDatabase, batchNumber, processedOn, refresh }),
  });

  return response.json();
}

/**
 * Poll the run status of a KPIF comparison batch from the Oracle
 * KPIF_CMP_RUN_STATUS table.
 * @param {object} params
 * @param {number} params.runId - The run ID returned from batch submission
 * @param {string} params.batchNumber - The batch number
 * @param {string} params.targetDatabase - 'default' | 'jpt' | 'perf'
 * @returns {Promise<object>} The current run status
 */
export async function getRunStatus({ runId, batchNumber, targetDatabase }) {
  const params = new URLSearchParams({ runId, batchNumber, targetDatabase });
  const response = await fetch(`/api/medicare/run-status?${params}`);
  return response.json();
}

/**
 * Fetch all currently active (non-terminal) Medicare compare jobs across all
 * target databases.
 * @returns {Promise<object[]>} Array of active job objects
 */
export async function getActiveJobs() {
  const response = await fetch('/api/medicare/active-jobs');
  const data = await response.json();
  return data.jobs || [];
}

/**
 * Cancel a running Medicare compare job by marking it as ERROR in the
 * MEDICARE_CMP_RUN_STATUS table.
 * @param {object} params
 * @param {number} params.runId
 * @param {string} params.batchNumber
 * @param {string} params.targetDatabase
 * @returns {Promise<object>}
 */
export async function cancelJob({ runId, batchNumber, targetDatabase }) {
  const response = await fetch('/api/medicare/run-status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId, batchNumber, targetDatabase }),
  });
  return response.json();
}

/**
 * Fetch paginated run history of terminal Medicare compare jobs.
 * @param {object} params
 * @param {number} [params.page=1] - 1-based page number
 * @param {number} [params.pageSize=10] - Rows per page
 * @param {string} [params.targetDatabase] - Optional database key filter
 * @returns {Promise<{ rows: object[], totalRows: number, page: number, pageSize: number, totalPages: number }>}
 */
export async function getRunHistory({ page = 1, pageSize = 10, targetDatabase } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (targetDatabase) {
    params.set('targetDatabase', targetDatabase);
  }
  const response = await fetch(`/api/medicare/run-history?${params}`);
  return response.json();
}

/**
 * Delete one Medicare run-history row and its generated artifacts.
 * @param {object} params
 * @param {number} params.runId
 * @param {string} params.batchNumber
 * @param {string} params.targetDatabase
 * @returns {Promise<object>}
 */
export async function deleteRunHistory({ runId, batchNumber, targetDatabase }) {
  const params = new URLSearchParams({
    runId: String(runId),
    batchNumber: String(batchNumber),
    targetDatabase,
  });

  const response = await fetch(`/api/medicare/run-history?${params}`, {
    method: 'DELETE',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Failed to delete run history');
  }

  return data;
}

/**
 * Check whether a batch already exists in terminal run history for one
 * target database.
 * @param {object} params
 * @param {string} params.targetDatabase - 'jpt' | 'perf'
 * @param {string|number} params.batchNumber
 * @returns {Promise<{ exists: boolean }>}
 */
export async function checkRunHistoryBatchExists({ targetDatabase, batchNumber }) {
  const params = new URLSearchParams({ targetDatabase, batchNumber: String(batchNumber || '').trim() });
  const response = await fetch(`/api/medicare/run-history/exists?${params}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Failed to validate batch history');
  }

  return { exists: !!data.exists };
}

/**
 * Check whether the final results blob exists in blob storage.
 * @param {object} params
 * @param {number} params.runId
 * @param {string} params.batchNumber
 * @param {string} params.targetDatabase - 'jpt' | 'perf'
 * @returns {Promise<{ exists: boolean }>}
 */
export async function checkFinalResultsExist({ runId, batchNumber, targetDatabase, invoiceType = 'med' }) {
  const params = new URLSearchParams({ runId, batchNumber, targetDatabase, invoiceType });
  const response = await fetch(`/api/medicare/final-results/check?${params}`);
  const data = await response.json().catch(() => ({ exists: false }));
  return data;
}

/**
 * Kick off the upload of final comparison results to blob storage.
 * The server returns immediately; callers should poll with
 * {@link checkFinalResultsExist} to know when the file is ready.
 * @param {object} params
 * @param {number} params.runId - The run ID
 * @param {string} params.batchNumber - The batch number
 * @param {string} params.targetDatabase - 'jpt' | 'perf'
 * @returns {Promise<object>} `{ accepted: true }` on success
 */
export async function uploadFinalResults({ runId, batchNumber, targetDatabase, invoiceType = 'med' }) {
  const response = await fetch('/api/medicare/final-results/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId, batchNumber, targetDatabase, invoiceType }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Failed to upload final results');
  }

  return data;
}

/**
 * Download the final comparison results for a completed run as .xlsx file(s).
 * The file is served from blob storage (uploaded after batch completion).
 *
 * For result sets with more than 100 k rows the server stores multiple
 * part files.  This function detects that via the check endpoint and
 * downloads each part sequentially, triggering a browser file-save for each.
 *
 * @param {object} params
 * @param {number} params.runId - The run ID
 * @param {string} params.batchNumber - The batch number
 * @param {string} params.invoiceType - 'med'
 */
function buildDownloadFilename({ runId, batchNumber, invoiceType = 'med', partNumber }) {
  const label = 'Medicare';
  const partSuffix = partNumber ? ` Part-${partNumber}` : '';
  return `IPB0001 Run-${runId} ${label} Results Batch-${batchNumber}${partSuffix}.xlsx`;
}

export async function downloadFinalResults({ runId, batchNumber, targetDatabase, invoiceType = 'med' }) {
  // Determine how many parts there are so we know whether to pass a part param.
  const checkData = await checkFinalResultsExist({ runId, batchNumber, targetDatabase, invoiceType });
  const totalParts = checkData.totalParts || 1;

  if (totalParts > 1) {
    // Multi-part: download each part sequentially.
    for (let part = 1; part <= totalParts; part++) {
      const params = new URLSearchParams({ runId, batchNumber, targetDatabase, invoiceType, part });
      const response = await fetch(`/api/medicare/final-results/download?${params}`);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `Download of part ${part} failed`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildDownloadFilename({
        runId,
        batchNumber,
        invoiceType,
        partNumber: part,
      });
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
    return;
  }

  // Single-file download (backward compatible).
  const params = new URLSearchParams({ runId, batchNumber, targetDatabase, invoiceType, part: 1 });
  const response = await fetch(`/api/medicare/final-results/download?${params}`);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Download failed');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildDownloadFilename({ runId, batchNumber, invoiceType });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Fetch YES/NO IPB rule counts for one run/batch.
 * @param {object} params
 * @param {number} params.runId
 * @param {string|number} params.batchNumber
 * @param {string} params.targetDatabase - 'jpt' | 'perf'
 */
export async function getIpbCount({ runId, batchNumber, targetDatabase }) {
  const params = new URLSearchParams({ runId, batchNumber, targetDatabase });
  const response = await fetch(`/api/medicare/ipb-count?${params}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch IPB count');
  }

  return data;
}
