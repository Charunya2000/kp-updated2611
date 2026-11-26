'use client';

export const getQuery = async (teamName, queryName) => {
  const response = await fetch(`/api/admin/${teamName}/insight-360/query?name=${queryName}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  if (response.status === 404) {
    return response.json();
  }

  if (!response.ok) {
    throw new Error('Failed to fetch query');
  }

  return response.json();
}

export const getQueryWithoutFilter = async (teamName) => {
  const response = await fetch(`/api/admin/${teamName}/insight-360/query`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  if (response.status === 404) {
    return response.json();
  }

  if (!response.ok) {
    throw new Error('Failed to fetch query');
  }

  return response.json();
}

export const updateQuery = async (teamName, query, id) => {
  const response = await fetch(`/api/admin/${teamName}/insight-360/query`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, id }),
  });

  if (!response.ok) {
    throw new Error('Failed to update query');
  }

  return response.json();
}

export const initializeQueries = async (teamName) => {
  const response = await fetch(`/api/admin/${teamName}/insight-360/query/initialize`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to initialize queries: ${response.statusText}`);
  }

  return response.json();
}