'use client'

export const getAllTemplateDocuments = async (teamName) => {
  const result = await fetch(`/api/admin/${teamName}/templateDocument`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await result.json();
}

export const getTemplateDocument = async (teamName, id) => {
  const result = await fetch(`/api/admin/${teamName}/templateDocument/${id}`);
  return await result.json();
}

export const createTemplateDocument = async (teamName, document) => {
  let insertedTemplateDocument = null;
  try {
    const result = await fetch(`/api/admin/${teamName}/templateDocument`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    });
    insertedTemplateDocument = await result.json();
  } catch (error) {
    console.error(error);
  }
  return insertedTemplateDocument;
}

export const updateTemplateDocument = async (teamName, document) => {
  let updatedTemplateDocument = null;
  try {
    const result = await fetch(`/api/admin/${teamName}/templateDocument/${document.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    });
    updatedTemplateDocument = await result.json();
  } catch (error) {
    console.error(error);
  }
  return updatedTemplateDocument;
}

export const deleteTemplateDocument = async (teamName, id) => {
  let success = { success: false };
  try {
    const result = await fetch(`/api/admin/${teamName}/templateDocument/${id}`, {
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