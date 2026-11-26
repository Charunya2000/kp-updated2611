export const getGraphConfigurationById = async (teamName, graphId) => {
  const response = await fetch(`/api/${teamName}/graph-configuration/${graphId}`, {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch graph configuration');
  }
  return response.json();
};

export const getAllGraphConfigurations = async (teamName) => {
  const response = await fetch(`/api/${teamName}/graph-configuration`, {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch graph configurations');
  }
  return response.json();
};

export const createGraphConfiguration = async (teamName, graphConfig) => {
  const response = await fetch(`/api/${teamName}/graph-configuration`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(graphConfig),
  });
  if (!response.ok) {
    throw new Error('Failed to create graph configuration');
  }
  return response.json();
};

export const updateGraphConfiguration = async (teamName, graphId, graphConfig) => {
  const response = await fetch(`/api/${teamName}/graph-configuration/${graphId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(graphConfig),
  });
  if (!response.ok) {
    throw new Error('Failed to update graph configuration');
  }
  return response.json();
};

export const deleteGraphConfiguration = async (teamName, graphId) => {
  const response = await fetch(`/api/${teamName}/graph-configuration/${graphId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete graph configuration');
  }
  return response.json();
};
