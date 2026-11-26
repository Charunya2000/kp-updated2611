'use client';

export const getJiraIssues = async (teamName, assistantName, smartNote) => {
  let jiraIssues = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/jiraIssue`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    jiraIssues = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return jiraIssues;
};

export const deleteJiraIssue = async (teamName, assistantName, query) => {
  let response = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${query.parentId}/jiraIssue/${query.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query)
    });
    response = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return response;
};
