'use client';

function buildMemoryBaseUrl(teamName, assistantName, smartNoteId) {
  return `/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/memory`;
}

function buildMemoryItemUrl(teamName, assistantName, smartNoteId, memoryId) {
  return `${buildMemoryBaseUrl(teamName, assistantName, smartNoteId)}/${memoryId}`;
}

export async function listMemoryItems(teamName, assistantName, smartNoteId, params = {}) {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && typeof value !== 'undefined' && value !== '') {
      queryParams.set(key, String(value));
    }
  });

  const response = await fetch(`${buildMemoryBaseUrl(teamName, assistantName, smartNoteId)}?${queryParams.toString()}`);
  if (!response.ok) {
    const errorPayload = await safeJson(response);
    throw new Error(errorPayload?.error || 'Unable to load memory items');
  }

  return response.json();
}

export async function createMemoryItem(teamName, assistantName, smartNoteId, payload) {
  const response = await fetch(buildMemoryBaseUrl(teamName, assistantName, smartNoteId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorPayload = await safeJson(response);
    throw new Error(errorPayload?.error || 'Unable to create memory item');
  }

  return response.json();
}

export async function updateMemoryItem(teamName, assistantName, smartNoteId, memoryId, payload) {
  const response = await fetch(buildMemoryItemUrl(teamName, assistantName, smartNoteId, memoryId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorPayload = await safeJson(response);
    throw new Error(errorPayload?.error || 'Unable to update memory item');
  }

  return response.json();
}

export async function deleteMemoryItem(teamName, assistantName, smartNoteId, memoryId) {
  const response = await fetch(buildMemoryItemUrl(teamName, assistantName, smartNoteId, memoryId), {
    method: 'DELETE'
  });

  if (!response.ok) {
    const errorPayload = await safeJson(response);
    throw new Error(errorPayload?.error || 'Unable to delete memory item');
  }

  return response.json();
}

export async function extractMemoryCandidates(teamName, assistantName, smartNoteId, payload) {
  const response = await fetch(`${buildMemoryBaseUrl(teamName, assistantName, smartNoteId)}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorPayload = await safeJson(response);
    throw new Error(errorPayload?.error || 'Unable to extract memory candidates');
  }

  return response.json();
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
