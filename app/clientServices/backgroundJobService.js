export async function getBackgroundJobById(teamName, id) {
  const response = await fetch(`/api/${teamName}/background-job/${id}/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to fetch background job');
  }

  return response.json();
}

export async function updateJobStatus(teamName, id, status) {
  const response = await fetch(`/api/${teamName}/background-job/${id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error('Failed to update background job status');
  }

  return response.json();
}