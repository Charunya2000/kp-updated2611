'use client';

export const createSource = async (teamName, assistantName, source) => {
  let insertedSource = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${source.parentId}/source`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(source),
    });
    insertedSource = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return insertedSource;
};

export const getSources = async (teamName, assistantName, smartNote) => {
  let sources = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/source`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    sources = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return sources;
};

export const getSourceBySourceId = async (teamName, assistantName, smartNote, sourceId) => {
  const sources = await getSources(teamName, assistantName, smartNote);
  const relatedSource = sources.find(source => source.sourceId === sourceId);
  return relatedSource;
};

export const getSourceBySearchIndexConfigId = async (teamName, assistantName, configId) => {
  let sources = null;

  try {
    const result = await fetch(`/api/admin/${teamName}/${assistantName}/source/${configId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    sources = await result.json();

  } catch (error) {
    console.error('Error fetching sources by config ID:', error);
    throw error;
  }
  return sources;
};


export const createSources = async (teamName, assistantName, sources) => {
  let savedSources = [];
  try {
    savedSources = await Promise.all(sources.map(async source => {
      const deleteSourceQuery = { type: 'Source', parentId: source.parentId, sourceId: source.sourceId };
      await fetch(`/api/${teamName}/${assistantName}/smartNote/${source.parentId}/source`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deleteSourceQuery),
      });
      const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${source.parentId}/source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(source),
      });
      const res = await result.json();
      return res;
    }));
  } catch (error) {
    console.error(error);
    throw error;
  }
  return savedSources;
};

export const addNotesToSource = async (teamName, assistantName, sources) => {
  let responses = [];
  try {
    responses = await Promise.all(sources.map(async source => {
      const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${source.parentId}/source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(source),
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

export const deleteSource = async (teamName, assistantName, source) => {
  let response;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${source.parentId}/source/${source.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(source),
    });
    response = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return response;
};

export const saveSource = async (teamName, assistantName, source) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${source.parentId}/source/${source.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(source),
  });
  return await result.json();
};

export const saveBulkSources = async (teamName, assistantName, sources) => {
  const result = await fetch(`/api/admin/${teamName}/${assistantName}/source/bulk`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sources),
  });
  return await result.json();
};

export const addJiraIssueToSources = async (teamName, assistantName, jiraIssueDocument, jiraIssueSourceDocument) => {
  await fetch(`/api/${teamName}/${assistantName}/smartNote/${jiraIssueDocument.parentId}/jiraIssue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jiraIssueDocument),
  });
  await fetch(`/api/${teamName}/${assistantName}/smartNote/${jiraIssueSourceDocument.parentId}/source`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jiraIssueSourceDocument),
  });
  await fetch(`/api/${teamName}/${assistantName}/smartNote/${jiraIssueDocument.parentId}/context/jiraIssue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jiraIssueDocument),
  });
};