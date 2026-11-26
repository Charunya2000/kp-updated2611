'use client';

export const getValueStreams = async (teamName, assistantName, smartNote) => {
  let valueStreams = null;
  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/sourceRetrieve/jiraIssue/valueStream`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    valueStreams = await response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return valueStreams;
};

export const getFilters = async (teamName, assistantName, smartNote) => {
  let filters = null;
  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/sourceRetrieve/jiraIssue/filter`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    filters = await response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return filters;
};

export const getJiraProjects = async (teamName, assistantName, smartNote) => {
  let projects = null;
  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/sourceRetrieve/jiraIssue/project`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    projects = await response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return projects;
};

export const getJiraIssuesByValueStream = async (teamName, assistantName, smartNote, valueStreamId, filterKey, filterText, alignment, startAt = 0, maxResults = 5) => {

  const alignmentString = '"' + alignment.join('","') + '"';

  let jiraIssues = [];
  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/sourceRetrieve/jiraIssue/valueStream/${valueStreamId}?filterKey=${filterKey}&filterText=${filterText}&alignmentString=${alignmentString}&startAt=${startAt}&maxResults=${maxResults}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    jiraIssues = await response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return jiraIssues;
};


export const getJiraIssuesByFilterId = async (teamName, assistantName, smartNote, filterId, startAt = 0, maxResults = 5) => {
  let jiraIssues = [];
  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/sourceRetrieve/jiraIssue/filter/${filterId}?startAt=${startAt}&maxResults=${maxResults}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    jiraIssues = await response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return jiraIssues;
};

export const getJiraIssuesByJQL = async (teamName, assistantName, smartNote, jql, startAt = 0, maxResults = 10) => {
  let jiraIssues = [];
  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/sourceRetrieve/jiraIssue/jiraQuery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jql, startAt, maxResults })
    });
    jiraIssues = await response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return jiraIssues;
};

export const getJiraIssuesByProject = async (teamName, assistantName, smartNote, projectName, filterKey, filterText, alignment, startAt = 0, maxResults = 5) => {
  const alignmentString = '"' + alignment.join('","') + '"';
  let jiraIssues = [];
  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/sourceRetrieve/jiraIssue/project/${projectName}?filterKey=${filterKey}&filterText=${filterText}&alignmentString=${alignmentString}&startAt=${startAt}&maxResults=${maxResults}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    jiraIssues = await response.json();
  } catch (error) {
    console.error(error);
  }
  return jiraIssues;
};

