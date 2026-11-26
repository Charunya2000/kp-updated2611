'use client';

export const createSavedResponse = async (teamName, assistantName, savedResponse) => {
  let insertedSavedResponse = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${savedResponse.parentId}/savedResponse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(savedResponse),
    });
    insertedSavedResponse = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return insertedSavedResponse;
};

export const updateSavedResponse = async (teamName, assistantName, savedResponse) => {
  let updatedSavedResponse = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${savedResponse.parentId}/savedResponse/${savedResponse.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(savedResponse),
    });
    updatedSavedResponse = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return updatedSavedResponse;
};

export const deleteSavedResponse = async (teamName, assistantName, savedResponse) => {
  let deletedSavedResponse = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${savedResponse.parentId}/savedResponse/${savedResponse.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(savedResponse),
    });
    deletedSavedResponse = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return deletedSavedResponse;
};

export const getSavedResponses = async (teamName, assistantName, smartNote) => {
  let savedResponses = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/savedResponse`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    savedResponses = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return savedResponses;
};

export const addResponsesToSource = async (teamName, assistantName, savedResponses) => {
  let responses = [];
  try {
    responses = await Promise.all(savedResponses.map(async savedResponse => {
      const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${savedResponse.parentId}/context/savedResponse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(savedResponse),
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

export const deleteResponseFromSource = async (teamName, assistantName, savedResponse) => {
  let response;
  try {
    response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${savedResponse.parentId}/context/savedResponse/${savedResponse.id}`, {
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

export const exportResponseToExcel = async (teamName, assistantName, smartNote, chatInteraction) => {
  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/export-excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body: JSON.stringify({ response: chatInteraction.response, sheetName: chatInteraction.sheetName || 'Sheet1' }),
    });

    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    return response.blob();
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
}