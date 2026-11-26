'use client';

export async function getSharedDealCanvas(teamName, assistantName, smartNoteId) {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/dealCanvas`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch deal canvas: ${response.statusText}`);
  }

  return await response.json();
}

export async function saveSharedDealCanvas(teamName, assistantName, smartNoteId, payload) {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/dealCanvas`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));
  if (response.status === 409) {
    return {
      conflict: true,
      canvas: body?.canvas || null,
      error: body?.error || 'Conflict while saving deal canvas.'
    };
  }

  if (!response.ok) {
    throw new Error(body?.error || `Failed to save deal canvas: ${response.statusText}`);
  }

  return {
    conflict: false,
    canvas: body?.canvas || null
  };
}
