'use client';

export const getInfoSourceFilterSettings = async (teamName, assistantName, smartNoteId) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/infoSourceFilterSettings`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  if (!result.ok) {
    throw new Error('Failed to load InfoSource filter settings');
  }

  return await result.json();
};

export const createInfoSourceFilterSettings = async (teamName, assistantName, smartNoteId, document) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/infoSourceFilterSettings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(document),
  });

  if (!result.ok) {
    throw new Error('Failed to create InfoSource filter settings');
  }

  return await result.json();
};

export const updateInfoSourceFilterSettings = async (teamName, assistantName, smartNoteId, document) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/infoSourceFilterSettings/${document.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(document),
  });

  if (!result.ok) {
    throw new Error('Failed to update InfoSource filter settings');
  }

  return await result.json();
};