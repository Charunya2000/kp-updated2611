/**
 * Search for ETS documents in the ets-001 index
 * @param {string} fileName - File name to search for
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Number of results per page
 * @returns {Promise<{documents: Array, totalCount: number, page: number, pageSize: number}>}
 */
export async function searchETSDocuments(fileName = '', page = 1, pageSize = 10) {
  try {
    const params = new URLSearchParams({
      fileName: fileName,
      page: page.toString(),
      pageSize: pageSize.toString()
    });

    const response = await fetch(`/api/admin/ets/manageDocuments/search?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to search documents');
    }

    return await response.json();
  } catch (error) {
    console.error('Error searching ETS documents:', error);
    throw error;
  }
}

/**
 * Delete all documents with a specific file name from ets-001 index
 * @param {string} fileName - The file name to delete
 * @returns {Promise<{success: boolean, message: string, deletedCount: number}>}
 */
export async function deleteETSDocumentsByFileName(fileName) {
  try {
    const params = new URLSearchParams({
      fileName: fileName
    });

    const response = await fetch(`/api/admin/ets/manageDocuments/delete?${params}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete documents');
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting ETS documents:', error);
    throw error;
  }
}

/**
 * Update all documents with a specific file name in ets-001 index
 * @param {string} fileName - The file name to update
 * @param {Object} updates - The updates to apply
 * @param {string} updates.projectId - New project ID
 * @param {string} updates.projectName - New project name
 * @param {string} updates.tag - New tag (optional)
 * @returns {Promise<{success: boolean, message: string, updatedCount: number}>}
 */
export async function updateETSDocumentsByFileName(fileName, updates) {
  try {
    const response = await fetch(`/api/admin/ets/manageDocuments/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        ...updates
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update documents');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating ETS documents:', error);
    throw error;
  }
}
