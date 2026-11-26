export const getAllRoleTemplates = async () => {
  const result = await fetch('/api/admin/role-templates', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  return await result.json();
};

export const createRoleTemplate = async (roleTemplate) => {
  const result = await fetch('/api/admin/role-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(roleTemplate),
  });
  return await result.json();
};

export const updateRoleTemplate = async (roleTemplate) => {
  const result = await fetch(`/api/admin/role-templates/${roleTemplate.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(roleTemplate),
  });
  return await result.json();
};

export const deleteRoleTemplate = async (id) => {
  const result = await fetch(`/api/admin/role-templates/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  return await result.json();
};
