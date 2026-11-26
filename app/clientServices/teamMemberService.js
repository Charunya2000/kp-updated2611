export const getTeamMembers = async (teamName) => {
  const result = await fetch(`/api/team/${teamName}/member`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const addTeamMembers = async (teamName, memberNuids) => {
  const result = await fetch(`/api/team/${teamName}/member`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ memberNuids })
  });
  return await result.json();
};

export const removeTeamMember = async (teamName, nuid) => {
  const result = await fetch(`/api/team/${teamName}/member/${nuid}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await result.json();
};

export const removeTeamMembers = async (teamName, members) => {
  const result = await fetch(`/api/team/${teamName}/member`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ members })
  });
  return await result.json();
};

export const updateTeamMemberRoles = async (teamName, nuid, roles, grants) => {
  const member = { roles };
  if (grants !== undefined) {
    member.grants = grants;
  }
  const result = await fetch(`/api/team/${teamName}/member/${nuid}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ member })
  });
  return await result.json();
};

export const updateTeamMemberGrants = async (teamName, nuid, grants) => {
  const result = await fetch(`/api/team/${teamName}/member/${nuid}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ member: { grants } })
  });
  return await result.json();
};

export const getTeamMember = async (teamName, nuid) => {
  const result = await fetch(`/api/team/${teamName}/member/${nuid}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};
