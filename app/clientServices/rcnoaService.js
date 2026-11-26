const ASSISTANT_NAME = 'rcno-rcna-834';

async function apiRequest(url, options) {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    redirect: 'manual',
  });
  if (response.type === 'opaqueredirect' || [301, 302, 303, 307, 308].includes(response.status)) {
    throw new Error('Your session has expired. Sign in again in another tab, then retry without leaving this page.');
  }
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `RCNOA request failed with status ${response.status}`);
  }
  return payload;
}

function baseUrl(teamName) {
  return `/api/${encodeURIComponent(teamName)}/${ASSISTANT_NAME}/rcnoa`;
}

export async function getRcnoaAdminState(teamName, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  return apiRequest(`${baseUrl(teamName)}/runs?${params}`);
}

export async function saveRcnoaSchedule(teamName, schedule) {
  return apiRequest(`${baseUrl(teamName)}/schedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schedule),
  });
}

export async function saveRcnoaQueryConfiguration(teamName, queryConfiguration) {
  return apiRequest(`${baseUrl(teamName)}/queries`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(queryConfiguration),
  });
}

export async function diagnoseRcnoaRow(teamName, rcnoRow) {
  return apiRequest(`${baseUrl(teamName)}/diagnostic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rcnoRow }),
  });
}

export async function uploadAndStartRcnoaRun(teamName, file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  onProgress?.('uploading');
  return apiRequest(`${baseUrl(teamName)}/runs/upload`, {
    method: 'POST',
    body: formData,
  });
}

export async function createMockRcnoaRun(teamName, fixtureId) {
  return apiRequest(`${baseUrl(teamName)}/runs/mock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fixtureId }),
  });
}

export async function getRcnoaRun(teamName, runId) {
  return apiRequest(`${baseUrl(teamName)}/runs/${encodeURIComponent(runId)}`);
}

export async function deleteRcnoaRun(teamName, runId) {
  return apiRequest(`${baseUrl(teamName)}/runs/${encodeURIComponent(runId)}`, { method: 'DELETE' });
}

export async function saveRcnoaRunNote(teamName, runId, note) {
  return apiRequest(`${baseUrl(teamName)}/runs/${encodeURIComponent(runId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
}

export async function getRcnoaRunFailures(teamName, runId, page = 1, pageSize = 25) {
  return apiRequest(`${baseUrl(teamName)}/runs/${encodeURIComponent(runId)}/items?page=${page}&pageSize=${pageSize}`);
}

export async function retryRcnoaRun(teamName, runId) {
  return apiRequest(`${baseUrl(teamName)}/runs/${encodeURIComponent(runId)}/retry`, { method: 'POST' });
}

export async function processNextAdhocRcnoaRun(teamName, lookupSource = 'live') {
  return apiRequest(`${baseUrl(teamName)}/runs/process-next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lookupSource }),
  });
}

export async function downloadRcnoaArtifact(teamName, runId, artifactId) {
  const params = new URLSearchParams({ artifactId });
  const payload = await apiRequest(
    `${baseUrl(teamName)}/runs/${encodeURIComponent(runId)}?${params}`,
  );
  const link = document.createElement('a');
  link.href = payload.download.url;
  link.download = payload.download.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function saveRcnoaBusinessConfiguration(teamName, businessConfiguration) {
  return apiRequest(`${baseUrl(teamName)}/configuration`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(businessConfiguration),
  });
}

export async function generateRcnoa834(teamName, runId) {
  return apiRequest(`${baseUrl(teamName)}/runs/${encodeURIComponent(runId)}/generate-834`, {
    method: 'POST',
  });
}

async function uploadRcnoaOperationFile(teamName, path, file, fields = {}) {
  const formData = new FormData();
  formData.append('file', file);
  Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
  return apiRequest(`${baseUrl(teamName)}/runs/${path}`, {
    method: 'POST',
    body: formData,
  });
}

export async function uploadRcnaForPriorLookup(teamName, file, reconciliationCycle) {
  return uploadRcnoaOperationFile(teamName, 'upload-rcna', file, { reconciliationCycle });
}

export async function upload834ForDelivery(teamName, file) {
  return uploadRcnoaOperationFile(teamName, 'upload-834', file);
}