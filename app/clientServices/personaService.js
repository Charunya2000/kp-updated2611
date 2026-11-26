'use client';

export const clearCurrentChat = async (teamName, assistantName, smartNote, chatHistory, chat) => {
  chat.current = false;
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat/${chat.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(chat),
  });
  return await result.json();
};

export const getAllPersonas = async (teamName, assistantName) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/persona`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await result.json();
};

export const createPersona = async (teamName, assistantName, persona) => {
  const result = await fetch(`/api/admin/${teamName}/${assistantName}/persona`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(persona),
  });
  return await result.json();
}

export const updatePersona = async (teamName, assistantName, persona) => {
  const result = await fetch(`/api/admin/${teamName}/${assistantName}/persona/${persona.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(persona),
  });
  return await result.json();
};

export const deletePersona = async (teamName, assistantName, persona) => {
  const result = await fetch(`/api/admin/${teamName}/${assistantName}/persona/${persona.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(persona),
  });
  return await result.json();
};