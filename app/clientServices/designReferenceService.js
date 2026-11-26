'use client';

export const createDesignReference = async (teamName, assistantName, designReference) => {
  let insertedDesignReference = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${designReference.parentId}/designReference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(designReference),
    });
    insertedDesignReference = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return insertedDesignReference;
};

export const deleteDesignReference = async (teamName, assistantName, designReference) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${designReference.parentId}/designReference/${designReference.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(designReference),
  });
  return await result.json();
};

export const addDesignReferences = async (teamName, assistantName, designReferences) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/admin/designReference`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(designReferences),
  });
  return await result.json();
};

export const loadReferenceFiles = async (teamName, assistantName, indexName) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/admin/designReference?indexName=${indexName}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const loadCachedReferenceFiles = async (teamName, assistantName, smartNote) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/designReference/cacheSearch`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};
