'use client';

export const getAllSearchIndexes = async (teamName, assistantName) => {
  const result = await fetch(`/api/admin/${teamName}/${assistantName}/index-config`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await result.json();
};

export const getIndexConfigByAssistant = async (teamName, assistantName) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/index-config`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await result.json();
};

export const createSearchIndex = async (searchIndexData, teamName, assistantName) => {
  const result = await fetch(`/api/admin/${teamName}/${assistantName}/index-config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(searchIndexData),
  });
  return await result.json();
};


export const updateSearchIndex = async (searchIndexData, teamName, assistantName) => {
  const result = await fetch(`/api/admin/${teamName}/${assistantName}/index-config/${searchIndexData.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(searchIndexData),
  });
  return await result.json();
};

export const deleteSearchIndex = async (searchIndexData, teamName, assistantName) => {
  const result = await fetch(`/api/admin/${teamName}/${assistantName}/index-config/${searchIndexData.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(searchIndexData),
  });
  return await result.json();
};
