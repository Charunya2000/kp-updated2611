export const getAllTeams = async () => {
  const result = await fetch(`/api/team`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

// export const getTeamsByNUID = async () => {
//   const result = await fetch(`/api/user/team`, {
//     method: 'GET',
//     headers: {
//       'Content-Type': 'application/json',
//     }
//   });
//   return await result.json();
// };

export const addTeam = async (team) => {
  const result = await fetch(`/api/admin/team`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(team)
  });
  return await result.json();
};

export const updateTeam = async (team) => {
  const result = await fetch(`/api/admin/team`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(team)
  });
  return await result.json();
};

export const deleteTeam = async (team) => {
  const result = await fetch(`/api/admin/team`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(team)
  });
  return await result.json();
};

export const getTeamByName = async (teamName) => {
  const result = await fetch(`/api/team/${teamName}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};
