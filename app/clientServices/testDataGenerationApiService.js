export const generateTestData = async (teamName, assistantName, requestData) => {
  try {
    const formData = new FormData();
    Object.entries(requestData).forEach(([key, value]) => {
      if (key === 'file') {
        if (value instanceof File) {
          formData.append('file', value);
        }
      } else if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    const result = await fetch(`/api/${teamName}/${assistantName}/testDataGeneration/generate`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: formData,
    });

    return await result.json();
  } catch (error) {
    console.error("Error generating test data:", error);
    throw new Error("Failed to generate test data");
  }
}

export const checkJobStatus = async (teamName, assistantName, taskId) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/testDataGeneration/status/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
    });

    return await result.json();
  } catch (error) {
    console.error("Error fetching test data generation status:", error);
    throw new Error("Failed to fetch test data generation status");
  }
}

export const getAllTestDataGenJobs = async (teamName, assistantName) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/testDataGeneration/job`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
    });

    return await result.json();
  } catch (error) {
    console.error("Error fetching jobs:", error);
    throw new Error("Failed to fetch jobs");
  }
}

export const saveTestDataGenJob = async (teamName, assistantName, jobData) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/testDataGeneration/job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(jobData),
    });

    return await result.json();
  } catch (error) {
    console.error("Error saving job:", error);
    throw new Error("Failed to save job");
  }
}

export const updateTestDataGenJob = async (teamName, assistantName, jobUpdate) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/testDataGeneration/job`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(jobUpdate),
    });

    return await result.json();
  } catch (error) {
    console.error("Error updating job:", error);
    throw new Error("Failed to update job");
  }
}