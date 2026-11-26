export const getUserAssistants = async (teamName, nuid) => {
  const result = await fetch(`/api/admin/${teamName}/user/${nuid}/assistant`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const getUserAssistantsByAssistantId = async (teamName, assistantId) => {
  const result = await fetch(`/api/admin/${teamName}/assistant/${assistantId}/user-assistants`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const upsertUserAssistants = async (teamName, nuid, userAssistants) => {
  const result = await fetch(`/api/admin/${teamName}/user/${nuid}/assistant`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userAssistants)
  });

  return await result.json();
};

export const removeUserFromAssistant = async (teamName, assistantId, nuid) => {
  const result = await fetch(`/api/admin/${teamName}/assistant/${assistantId}/user/${nuid}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  return await result.json();
};

export const addUserToAssistant = async (teamName, assistantId, nuid) => {
  const result = await fetch(`/api/admin/${teamName}/assistant/${assistantId}/user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nuid })
  });

  return await result.json();
};

export const bulkAddUsersToAssistant = async (teamName, assistantId, nuids) => {
  const result = await fetch(`/api/admin/${teamName}/assistant/${assistantId}/user-assistants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nuids })
  });

  return await result.json();
};