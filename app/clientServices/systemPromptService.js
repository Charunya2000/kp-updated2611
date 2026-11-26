'use client';

export const getAllSystemPrompts = async (teamName, assistantName) => {
  const res = await fetch(`/api/${teamName}/${assistantName}/system-prompt`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await res.json();
};

export const createSystemPrompt = async (teamName, assistantName, prompt) => {
  const res = await fetch(`/api/admin/${teamName}/${assistantName}/system-prompt`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(prompt)
  });
  return await res.json();
};

export const updateSystemPrompt = async (teamName, assistantName, prompt) => {
  const res = await fetch(`/api/admin/${teamName}/${assistantName}/system-prompt/${prompt.id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(prompt)
  });
  return await res.json();
};

export const deleteSystemPrompt = async (teamName, assistantName, prompt) => {
  const res = await fetch(`/api/admin/${teamName}/${assistantName}/system-prompt/${prompt.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(prompt)
  });
  return await res.json();
};
