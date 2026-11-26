function createAuthRequiredError() {
  const error = new Error('Session expired. Please sign in again.');
  error.code = 'AUTH_REQUIRED';
  return error;
}

function isAuthRedirectResponse(response) {
  if (!response) return false;

  const responseUrl = String(response.url || '');
  const redirectedToSignin = Boolean(response.redirected && responseUrl.includes('/api/openid/signin'));
  const locationHeader = String(response.headers?.get('location') || '');
  const locationToSignin = locationHeader.includes('/api/openid/signin');
  const unauthorizedStatus = response.status === 401 || response.status === 403;

  return redirectedToSignin || locationToSignin || unauthorizedStatus;
}

async function readJsonResponse(response) {
  const contentType = String(response.headers?.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function readApiPayload(response) {
  if (isAuthRedirectResponse(response)) {
    throw createAuthRequiredError();
  }

  const data = await readJsonResponse(response);
  if (!data) {
    throw new Error(`Unexpected non-JSON response (status ${response.status}).`);
  }

  return data;
}

export async function startGeisingerPreparation(teamName, payload) {
  const response = await fetch(`/api/admin/${teamName}/geisinger-preparation/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });

  const data = await readApiPayload(response);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Failed to start preparation: ${response.statusText}`);
  }

  return data.job;
}

export async function getGeisingerPreparationStatus(teamName, jobId) {
  const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
  const response = await fetch(`/api/admin/${teamName}/geisinger-preparation/status${query}`);

  const data = await readApiPayload(response);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Failed to fetch preparation status: ${response.statusText}`);
  }

  return data.job;
}

export async function stopGeisingerPreparation(teamName, jobId, {
  resetToNotPrepared = false,
} = {}) {
  const response = await fetch(`/api/admin/${teamName}/geisinger-preparation/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(jobId ? { jobId } : {}),
      resetToNotPrepared: !!resetToNotPrepared,
    }),
  });

  const data = await readApiPayload(response);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Failed to stop preparation: ${response.statusText}`);
  }

  return data.job;
}

export async function discoverGeisingerPreparationDocuments(teamName, {
  siteName,
  rootFolder,
  lobFolders,
  fileName,
} = {}) {
  const params = new URLSearchParams();
  if (siteName) params.set('siteName', siteName);
  if (rootFolder) params.set('rootFolder', rootFolder);
  if (lobFolders) params.set('lobFolders', lobFolders);
  if (fileName) params.set('fileName', fileName);

  const query = params.toString();
  const response = await fetch(`/api/admin/${teamName}/geisinger-preparation/discover${query ? `?${query}` : ''}`);

  const data = await readApiPayload(response);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Failed to discover preparation documents: ${response.statusText}`);
  }

  return data;
}

export async function getGeisingerPreparationDocumentProgress(teamName, {
  jobId,
  relativeAUrl,
  fileAName,
} = {}) {
  const params = new URLSearchParams();
  if (jobId) params.set('jobId', jobId);
  if (relativeAUrl) params.set('relativeAUrl', relativeAUrl);
  if (fileAName) params.set('fileAName', fileAName);

  const response = await fetch(`/api/admin/${teamName}/geisinger-preparation/document-progress?${params.toString()}`);
  const data = await readApiPayload(response);

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Failed to fetch document progress: ${response.statusText}`);
  }

  return data.detail;
}
