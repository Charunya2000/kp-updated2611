'use client'

export const getAllTemplatePurposes = async (teamName) => {
  const result = await fetch(`/api/${teamName}/templatePurpose`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await result.json();
}

export const getTemplatePurpose = async (teamName, id) => {
  const result = await fetch(`/api/admin/${teamName}/templatePurpose/${id}`);
  return await result.json();
}

export const createTemplatePurpose = async (teamName, document) => {
  let insertedTemplatePurpose = null;
  try {
    const result = await fetch(`/api/admin/${teamName}/templatePurpose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    });
    insertedTemplatePurpose = await result.json();
  } catch (error) {
    console.error(error);
  }
  return insertedTemplatePurpose;
}

export const updateTemplatePurpose = async (teamName, document) => {
  let updatedTemplatePurpose = null;
  try {
    const result = await fetch(`/api/admin/${teamName}/templatePurpose/${document.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    });
    updatedTemplatePurpose = await result.json();
  } catch (error) {
    console.error(error);
  }
  return updatedTemplatePurpose;
}

export const deleteTemplatePurpose = async (teamName, id) => {
  let success = { success: false };
  try {
    const result = await fetch(`/api/admin/${teamName}/templatePurpose/${id}`, {
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