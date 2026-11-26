export const getAllAssistants = async (teamName) => {
  const result = await fetch(`/api/${teamName}/assistants`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const addAssistant = async (teamName, assistant) => {
  const result = await fetch(`/api/admin/${teamName}/assistant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(assistant)
  });
  return await result.json();
};

export const updateAssistant = async (teamName, assistant) => {
  const result = await fetch(`/api/admin/${teamName}/assistant/${assistant.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(assistant)
  });
  return await result.json();
}

export const deleteAssistant = async (teamName, assistant) => {
  const result = await fetch(`/api/admin/${teamName}/assistant/${assistant.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(assistant)
  });
  return await result.json();
};