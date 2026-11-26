'use client'

export const getAllWorkflows = async (teamName) => {
  const result = await fetch(`/api/admin/${teamName}/workflow-config`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await result.json();
}

export const getWorkflow = async (id, teamName) => {
  const result = await fetch(`/api/admin/${teamName}/workflow-config/${id}`);
  return await result.json();
}

export const createWorkflow = async (document, teamName) => {
  let insertedWorkflow = null;
  try {
    const result = await fetch(`/api/admin/${teamName}/workflow-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    });
    insertedWorkflow = await result.json();
  } catch (error) {
    console.error(error);
  }
  return insertedWorkflow;
}

export const updateWorkflow = async (id, document, teamName) => {
  let updatedWorkflow = null;
  try {
    const result = await fetch(`/api/admin/${teamName}/workflow-config/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    });
    updatedWorkflow = await result.json();
  } catch (error) {
    console.error(error);
  }
  return updatedWorkflow;
}

export const deleteWorkflow = async (id, teamName) => {
  let success = { success: false };
  try {
    const result = await fetch(`/api/admin/${teamName}/workflow-config/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    success = await result.json();
  } catch (error) {
    console.error(error);
  }
  return success
}