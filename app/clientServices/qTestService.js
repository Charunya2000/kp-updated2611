// qTest Service - Handles all qTest API calls

// NEW: lightweight list of projects
export const getQTestProjects = async () => {
  try {
    const response = await fetch('/api/qtest/qtest-details');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json(); // array of { id, name }
  } catch (error) {
    console.error('Error fetching qTest projects list:', error);
    throw error;
  }
};

// Modified to accept optional projectId (when not provided, falls back to legacy)
export const getProjectDetails = async (projectId) => {
  try {
    const url = projectId
      ? `/api/qtest/project-details?projectId=${encodeURIComponent(projectId)}`
      : '/api/qtest/project-details';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching qTest project details:', error);
    throw error;
  }
};

export const getModuleDetails = async (moduleId, projectId) => {
  if (!projectId) throw new Error('projectId required for module details');
  try {
    const response = await fetch(`/api/qtest/module-details/${moduleId}?project_id=${encodeURIComponent(projectId)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching qTest module details for ${moduleId}:`, error);
    throw error;
  }
};

export const getTestCaseDetails = async (testCaseIds, projectId) => {
  if (!projectId) throw new Error('projectId required for test case details');
  try {
    const payload = { test_case_ids: testCaseIds, project_id: projectId };
    const response = await fetch('/api/qtest/testcase-details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching qTest test case details:', error);
    throw error;
  }
};