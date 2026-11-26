'use client';

export async function uploadEdiWorkbenchFile(teamName, assistantName, smartNoteId, file, fileCategory) {
  const uploadParams = new URLSearchParams({
    fileName: file.name,
    fileCategory: fileCategory || 'edi',
  });

  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/upload?${uploadParams}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to upload file');
  }

  return data;
}

export async function ingestEditableCompanionGuide(teamName, assistantName, smartNoteId, payload) {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/companion-guide/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to ingest companion guide');
  }

  return data;
}

export async function listSavedEditableCompanionGuides(teamName, assistantName, smartNoteId) {
  const url = `/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/companion-guide/saved`;
  const requestOptions = {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  };
  const retryDelaysMs = [250, 500, 1000];
  let response;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    response = await fetch(url, requestOptions);
    if (response.status !== 404 || attempt === retryDelaysMs.length) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load saved companion guides');
  }

  return data?.guides || [];
}

export async function saveEditableCompanionGuide(teamName, assistantName, smartNoteId, payload) {
  const response = await fetch(
    `/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/companion-guide/saved`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to save companion guide');
  }

  return data?.guide || null;
}

export async function getSavedEditableCompanionGuide(teamName, assistantName, smartNoteId, guideId) {
  const response = await fetch(
    `/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/companion-guide/saved/${encodeURIComponent(guideId)}`,
    {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load saved companion guide');
  }

  return data?.guide || null;
}

export async function parseEdiWorkbenchFiles(teamName, assistantName, smartNoteId, payload) {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to parse EDI files');
  }

  return data;
}

export async function startEdiWorkbenchParseJob(teamName, assistantName, smartNoteId, payload) {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/parse/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to start EDI parse job');
  }

  return data;
}

export async function getEdiWorkbenchParseJobStatus(teamName, assistantName, smartNoteId, jobId) {
  const cacheBust = Date.now();
  const controller = new AbortController();
  const statusTimeoutMsRaw = Number.parseInt(process.env.NEXT_PUBLIC_EDI_WORKBENCH_STATUS_TIMEOUT_MS || '20000', 10);
  const statusTimeoutMs = Number.isFinite(statusTimeoutMsRaw) && statusTimeoutMsRaw > 0
    ? statusTimeoutMsRaw
    : 20000;
  const timeoutId = setTimeout(() => controller.abort(), statusTimeoutMs);
  let response;

  try {
    response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/parse/status?jobId=${encodeURIComponent(jobId)}&t=${cacheBust}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Status check timed out while waiting for server response');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const rawText = await response.text();
  let data = null;

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`Status endpoint returned non-JSON response (HTTP ${response.status})`);
    }
  }

  if (!rawText) {
    throw new Error(`Status endpoint returned an empty response (HTTP ${response.status})`);
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to fetch EDI parse job status');
  }

  return data;
}

export async function refreshEdiWorkbenchReportDownload(teamName, assistantName, smartNoteId, jobId) {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/parse/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to refresh validation report download');
  }
  return data;
}

export async function listEdiCompanionGuideTemplates(teamName, assistantName, smartNoteId, includeInactive = false) {
  const response = await fetch(
    `/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/reference-templates?includeInactive=${includeInactive ? '1' : '0'}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load companion guide templates');
  }

  return data?.templates || [];
}

export async function createEdiCompanionGuideTemplate(teamName, assistantName, smartNoteId, payload) {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/reference-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to create companion guide template');
  }

  return data?.template;
}

export async function updateEdiCompanionGuideTemplate(teamName, assistantName, smartNoteId, templateId, payload) {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/reference-templates/${encodeURIComponent(templateId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to update companion guide template');
  }

  return data?.template;
}

export async function listEdiCompanionGuideRunConfigs(teamName, assistantName, smartNoteId, templateId = null) {
  const templateFilter = templateId ? `?templateId=${encodeURIComponent(templateId)}` : '';
  const response = await fetch(
    `/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/run-configs${templateFilter}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load run configs');
  }

  return data?.runConfigs || [];
}

export async function createEdiCompanionGuideRunConfig(teamName, assistantName, smartNoteId, payload) {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/run-configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to create run config');
  }

  return data?.runConfig;
}

export async function updateEdiCompanionGuideRunConfig(teamName, assistantName, smartNoteId, runConfigId, payload) {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/edi-workbench/run-configs/${encodeURIComponent(runConfigId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to update run config');
  }

  return data?.runConfig;
}
