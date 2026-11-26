'use client';

export const getReportStatuses = async (teamName, assistantName, dataset, targetDatabase) => {
  const targetDatabaseQuery = targetDatabase ? `&targetDatabase=${targetDatabase}` : '';
  const response = await fetch(`/api/${teamName}/${assistantName}/cac-control-report/statuses?dataset=${dataset}${targetDatabaseQuery}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 404) {
    console.warn(`No report statuses found for ${dataset}`);
    return [];
  }

  if (!response.ok) {
    throw new Error('Failed to fetch report statuses');
  }

  return response.json();
}

export const requestReportGeneration = async (teamName, assistantName, dataset, entityName, regionName, targetDatabase) => {
  const requestBody = { dataset: dataset, entity: entityName, region: regionName };
  if (targetDatabase) {
    requestBody.targetDatabase = targetDatabase;
  }

  const response = await fetch(`/api/${teamName}/${assistantName}/cac-control-report/sql-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error('Failed to request report generation');
  }

  return response.json();
}

export const selectCacControlReport = async (teamName, assistantName, query) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/cac-control-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(query),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch report');
  }

  return response.json();
}

export const getQuery = async (teamName, dataset, entity) => {
  const response = await fetch(`/api/admin/${teamName}/cac-control-report/query?dataset=${dataset}&entity=${entity}`, {
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

export const createQuery = async (teamName, dataset, entity) => {
  const response = await fetch(`/api/admin/${teamName}/cac-control-report/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dataset, entity }),
  });

  if (!response.ok) {
    throw new Error('Failed to create query');
  }

  return response.json();
}

export const updateQuery = async (teamName, entity, query, id) => {
  const response = await fetch(`/api/admin/${teamName}/cac-control-report/query`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ entity, query, id }),
  });

  if (!response.ok) {
    throw new Error('Failed to update query');
  }

  return response.json();
}

export const deleteQuery = async (teamName, id) => {
  const response = await fetch(`/api/admin/${teamName}/cac-control-report/query`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete query');
  }

  return response.json();
}