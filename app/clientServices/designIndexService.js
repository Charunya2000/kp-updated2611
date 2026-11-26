'use client';

export const createDesignIndex = async (teamName, assistantName, designIndex) => {
  let insertedDesignIndex = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${designIndex.parentId}/designIndex`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(designIndex),
    });
    insertedDesignIndex = await result.json();
  } catch (error) {
    console.error(error);
    throw new Error(error.message);
  }
  return insertedDesignIndex;
};

export const updateDesignIndex = async (teamName, assistantName, designIndex) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${designIndex.parentId}/designIndex/${designIndex.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(designIndex),
  });
  return await result.json();
};


export const deleteDesignIndex = async (teamName, assistantName, designIndex) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${designIndex.parentId}/designIndex/${designIndex.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(designIndex),
  });
  return await result.json();
};
