'use client';

export const getAssistantNews = async (teamName, assistantName) => {
  try {
    const res = await fetch(`/api/${teamName}/${assistantName}/news`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error('Failed to get assistant news:', error);
    return null;
  }
};

export const saveAssistantNews = async (teamName, assistantName, news) => {
  const res = await fetch(`/api/admin/${teamName}/${assistantName}/news`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ news })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to save news');
  }
  return await res.json();
};
