export const getSmartNoteTemplates = async (teamName, assistantName) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/template`);

  if (!response.ok) {
    throw new Error('Failed to fetch smart note templates');
  }

  return response.json();
};

export const getSmartNoteTemplate = async (teamName, assistantName, templateId) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/template/${encodeURIComponent(templateId)}`);

  if (!response.ok) {
    throw new Error('Failed to fetch smart note template');
  }
  return response.json();
}

export const cloneSmartNoteTemplate = async (teamName, assistantName, template) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/template/${encodeURIComponent(template.id)}/clone`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ template }),
  });

  if (!response.ok) {
    if (response.status === 409) {
      return response.json();
    }
    throw new Error('Failed to fetch smart note template sources');
  }

  return response.json();
}

export const upsertSmartNoteTemplate = async (teamName, assistantName, smartNoteId, templateData) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ smartNoteId, templateData }),
  });
  if (!response.ok) {
    throw new Error('Failed to create smart note template');
  }
  return response.json();
}

export const deleteSmartNoteTemplate = async (teamName, assistantName, templateId) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/template/${encodeURIComponent(templateId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete smart note template');
  }
  return response.json();
}

export const updateSmartNoteTemplate = async (teamName, assistantName, templateId, templateData) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/template/${encodeURIComponent(templateId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(templateData),
  });
  if (!response.ok) {
    throw new Error('Failed to update smart note template');
  }
  return response.json();
}

export const getBackgroundJob = async (teamName, smartNoteId) => {
  const response = await fetch(`/api/${teamName}/background-job/type/CloneSmartNote_${smartNoteId}`);

  if (response.status === 404) {
    return response.json();
  }

  if (!response.ok) {
    throw new Error('Failed to fetch background job');
  }

  return response.json();
}
