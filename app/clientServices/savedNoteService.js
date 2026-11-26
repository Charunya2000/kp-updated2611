'use client';

export const createSavedNote = async (teamName, assistantName, savedNote) => {
  let insertedSavedNote = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${savedNote.parentId}/savedNote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(savedNote),
    });
    insertedSavedNote = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return insertedSavedNote;
};

export const updateSavedNote = async (teamName, assistantName, savedNote) => {
  let updatedSavedNote = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${savedNote.parentId}/savedNote/${savedNote.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(savedNote),
    });
    updatedSavedNote = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return updatedSavedNote;
};

export const deleteSavedNote = async (teamName, assistantName, savedNote) => {
  let insertedSavedNote = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${savedNote.parentId}/savedNote/${savedNote.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(savedNote),
    });
    insertedSavedNote = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return insertedSavedNote;
};

export const getSavedNotes = async (teamName, assistantName, smartNote) => {
  let savedNotes = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/savedNote`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    savedNotes = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return savedNotes;
};

export const addNotesToSource = async (teamName, assistantName, savedNotes) => {
  let responses = [];
  try {
    responses = await Promise.all(savedNotes.map(async savedNote => {
      const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${savedNote.parentId}/context/savedNote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(savedNote),
      });
      const res = await result.json();
      return res;
    }));
  } catch (error) {
    console.error(error);
    throw error;
  }
  return responses;
};

export const deleteNoteFromSource = async (teamName, assistantName, savedNote) => {
  let response;
  try {
    response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${savedNote.parentId}/context/savedNote/${savedNote.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
  return response;
};
