'use client'

export const getAllTemplateCollections = async (teamName) => {
  const result = await fetch(`/api/${teamName}/templateCollection/`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await result.json();
}

export const getTemplateCollection = async (teamName, assistantName, id) => {
  const result = await fetch(`/api/admin/${teamName}/templateCollection/${id}`);
  return await result.json();
}

export const createTemplateCollection = async (teamName, assistantName, document) => {
  let insertedTemplateCollection = null;
  try {
    const result = await fetch(`/api/admin/${teamName}/templateCollection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    });
    insertedTemplateCollection = await result.json();
  } catch (error) {
    console.error(error);
  }
  return insertedTemplateCollection;
}

export const updateTemplateCollection = async (teamName, assistantName, document) => {
  let updatedTemplateCollection = null;
  try {
    const result = await fetch(`/api/admin/${teamName}/templateCollection/${document.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    });
    updatedTemplateCollection = await result.json();
  } catch (error) {
    console.error(error);
  }
  return updatedTemplateCollection;
}

export const deleteTemplateCollection = async (teamName, assistantName, id) => {
  let success = { success: false };
  try {
    const result = await fetch(`/api/admin/${teamName}/templateCollection/${id}`, {
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