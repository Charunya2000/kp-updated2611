'use client';

export const createWebsiteURL = async (teamName, assistantName, websiteURL) => {
  let insertedWebsiteURL = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${websiteURL.parentId}/context/websiteURL`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(websiteURL),
    });
    insertedWebsiteURL = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return insertedWebsiteURL;
};

export const updateWebsiteURL = async (teamName, assistantName, websiteURL) => {
  let updatedWebsiteURL = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${websiteURL.parentId}/context/websiteURL/${websiteURL.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(websiteURL),
    });
    updatedWebsiteURL = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return updatedWebsiteURL;
};

/** Delete Website URL from Mongo DB */
export const deleteWebsiteURL = async (teamName, assistantName, websiteURL) => {
  let deletedWebsiteURL = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${websiteURL.smartNoteId}/websiteURL/${websiteURL.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(websiteURL),
    });
    deletedWebsiteURL = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return deletedWebsiteURL;
};

export const getWebsiteURLs = async (teamName, assistantName, smartNote) => {
  let websiteURLs = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/websiteURL`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    websiteURLs = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return websiteURLs;
};

export const addWebsiteURLsToSource = async (teamName, assistantName, websiteURLs) => {
  let responses = [];
  try {
    responses = await Promise.all(websiteURLs.map(async websiteURL => {
      const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${websiteURL.parentId}/context/websiteURL`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(websiteURL),
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

export const deleteWebsiteURLFromSource = async (teamName, assistantName, websiteURL) => {
  let response;
  try {
    response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${websiteURL.parentId}/context/websiteURL/${websiteURL.id}`, {
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