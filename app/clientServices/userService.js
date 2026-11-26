export const getUserNames = async (nuids) => {
  if (!nuids || nuids.length === 0) {
    return [];
  }

  const response = await fetch(`/api/user/detail`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nuids }),
  });

  if (!response.ok) {
    console.error('Error fetching user names:');
    return [];
  }

  const users = await response.json();
  const unknownNuids = nuids.filter(nuid => !users.some(user => user.nuid === nuid.toUpperCase()));
  if (unknownNuids.length > 0) {
    console.warn('Unknown NUIDs found:', unknownNuids);
  }

  return users.map(user => ({
    nuid: user.nuid,
    name: user.firstName + ' ' + user.lastName || 'Unknown',
  })).concat(unknownNuids.map(nuid => ({
    nuid,
    name: 'Unknown'
  })));
};

export const getUserAssistantsByNuid = async () => {
  const result = await fetch(`/api/user/assistant`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
}

export const getTeamMemberTeamsListWithRoles = async () => {
  const result = await fetch(`/api/user/teams`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
}
