'use client';

export const getAllPrompts = async (teamName, assistantName) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/prompt-library`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await result.json();
};

export const createPrompt = async (teamName, assistantName, prompt) => {
  const result = await fetch(`/api/admin/${teamName}/${assistantName}/prompt-library`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(prompt),
  });
  return await result.json();
}

export const updatePrompt = async (teamName, assistantName, prompt) => {
  const result = await fetch(`/api/admin/${teamName}/${assistantName}/prompt-library/${prompt.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(prompt),
  });
  return await result.json();
};

export const deletePrompt = async (teamName, assistantName, prompt) => {
  const result = await fetch(`/api/admin/${teamName}/${assistantName}/prompt-library/${prompt.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(prompt),
  });
  return await result.json();
};