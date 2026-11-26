'use client';

/**
 * Client-side function to validate incidents from an uploaded file
 * @param {File} file - The uploaded JSON file containing incidents
 * @param {string[]} requiredFields - Array of required field names to validate against
 * @returns {Promise<Object>} Validation results with isValid, missingProperties, message, and incidents
 */
export const getValidatedIncidents = async (file, requiredFields) => {
  try {
    const fileContent = await file.text();

    const response = await fetch('/api/admin/bcs/index/incidents/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileContent: fileContent,
        requiredFields: requiredFields
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      return errorData;
    }

    return await response.json();
  } catch (error) {
    console.error('Error validating incidents:', error);
    throw new Error(`Failed to validate incidents: ${error.message}`);
  }
};

/**
 * Client-side function to upload validated incidents to the search index
 * @param {Object[]} incidents - Array of validated incident objects (JSON)
 * @returns {Promise<Object>} Upload results
 */
export const uploadIncidentsToIndex = async (incidents) => {
  try {
    if (!incidents || !Array.isArray(incidents) || incidents.length === 0) {
      throw new Error('No valid incidents provided for upload');
    }

    const response = await fetch('/api/admin/bcs/index/incidents/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ incidents: incidents })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading incidents to index:', error);
    throw new Error(`Failed to upload incidents: ${error.message}`);
  }
};

export const getJobStatus = async (jobId) => {
  try {
    const response = await fetch(`/api/admin/bcs/job/IncidentUpload/${jobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching job status:', error);
    throw new Error(`Failed to fetch job status: ${error.message}`);
  }
};
