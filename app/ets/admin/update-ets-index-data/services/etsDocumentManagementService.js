'use server';

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

const ETS_INDEX_NAME = 'ets-001';

let searchClient = null;

function getSearchClient() {
  if (!searchClient) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];

    searchClient = new SearchClient(
      searchEndpoint,
      ETS_INDEX_NAME,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return searchClient;
}

/**
 * Search documents in ets-001 index by file name
 * @param {string} fileName - The file name to search for (partial match)
 * @param {number} page - The page number (1-based)
 * @param {number} pageSize - Number of results per page (default: 10)
 * @returns {Promise<{documents: Array, totalCount: number, page: number, pageSize: number}>}
 */
export async function searchETSDocuments(fileName = '', page = 1, pageSize = 10) {
  try {
    const client = getSearchClient();

    // Build filter for exact file name match if provided
    let filter = null;
    if (fileName && fileName.trim()) {
      // Escape single quotes in fileName for OData filter
      const escapedFileName = fileName.replace(/'/g, "''");
      filter = `doc_name eq '${escapedFileName}'`;
    }

    const skip = (page - 1) * pageSize;

    const searchOptions = {
      filter: filter,
      select: ['doc_id', 'doc_name', 'doc_type', 'project_id', 'project_name', 'tag', 'created_at', 'updated_at'],
      top: pageSize,
      skip: skip,
      includeTotalCount: true,
      orderBy: ['created_at desc']
    };

    // Use wildcard search if no file name filter
    const searchQuery = filter ? null : '*';

    const searchResults = await client.search(searchQuery, searchOptions);

    const documents = [];
    for await (const result of searchResults.results) {
      documents.push(result.document);
    }

    return {
      documents,
      totalCount: searchResults.count || 0,
      page,
      pageSize
    };
  } catch (error) {
    console.error('Error searching ETS documents:', error);
    throw new Error(`Failed to search documents: ${error.message}`);
  }
}

/**
 * Delete a document from ets-001 index by doc_id
 * @param {string} docId - The document ID to delete
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteETSDocument(docId) {
  try {
    const { nuid } = await getServerSession();
    const isAdmin = await isTeamAdmin('ets', nuid);

    if (!isAdmin) {
      throw new Error('User does not have permission to perform this action.');
    }

    if (!docId) {
      throw new Error('Document ID is required');
    }

    const client = getSearchClient();

    // Delete the document
    const batch = [{
      '@search.action': 'delete',
      doc_id: docId
    }];

    await client.uploadDocuments(batch);

    console.log(JSON.stringify({
      kpmsg: {
        id: "AI_PORTAL_NOTEBOOK",
        name: "deleteETSDocument",
        detail: {
          message: `Deleted document with doc_id: ${docId}`,
          nuid
        }
      }
    }));

    return {
      success: true,
      message: 'Document deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting ETS document:', error);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

/**
 * Delete all documents with a specific file name from ets-001 index
 * @param {string} fileName - The file name to delete all occurrences of
 * @returns {Promise<{success: boolean, message: string, deletedCount: number}>}
 */
export async function deleteETSDocumentsByFileName(fileName) {
  try {
    if (!fileName || !fileName.trim()) {
      throw new Error('File name is required');
    }

    const client = getSearchClient();

    // Escape single quotes in fileName for OData filter
    const escapedFileName = fileName.replace(/'/g, "''");
    const filter = `doc_name eq '${escapedFileName}'`;

    // Fetch all documents with this file name
    const searchResults = await client.search(null, {
      filter: filter,
      select: ['doc_id']
    });

    const documentsToDelete = [];
    for await (const result of searchResults.results) {
      documentsToDelete.push({ doc_id: result.document.doc_id });
    }

    if (documentsToDelete.length === 0) {
      return {
        success: true,
        message: 'No documents found with this file name',
        deletedCount: 0
      };
    }

    // Delete documents
    await client.deleteDocuments(documentsToDelete);

    console.log(JSON.stringify({
      kpmsg: {
        id: "AI_PORTAL_NOTEBOOK",
        name: "deleteETSDocumentsByFileName",
        detail: {
          message: `Deleted ${documentsToDelete.length} documents with fileName: ${fileName}`,
          deletedCount: documentsToDelete.length
        }
      }
    }));

    return {
      success: true,
      message: `Successfully deleted ${documentsToDelete.length} document(s)`,
      deletedCount: documentsToDelete.length
    };
  } catch (error) {
    console.error('Error deleting ETS documents by file name:', error);
    throw new Error(`Failed to delete documents: ${error.message}`);
  }
}

/**
 * Update all documents with a specific file name in ets-001 index
 * @param {string} fileName - The file name to update all occurrences of
 * @param {Object} updates - The fields to update
 * @param {string} updates.projectId - New project ID
 * @param {string} updates.projectName - New project name
 * @param {string} updates.tag - New tag (optional)
 * @returns {Promise<{success: boolean, message: string, updatedCount: number}>}
 */
export async function updateETSDocumentsByFileName(fileName, updates) {
  try {
    if (!fileName || !fileName.trim()) {
      throw new Error('File name is required');
    }

    if (!updates.projectId || !updates.projectName) {
      throw new Error('Project ID and Project Name are required');
    }

    const client = getSearchClient();

    // Escape single quotes in fileName for OData filter
    const escapedFileName = fileName.replace(/'/g, "''");
    const filter = `doc_name eq '${escapedFileName}'`;

    // Fetch all documents with this file name
    const searchResults = await client.search(null, {
      filter: filter,
      select: ['doc_id', 'doc_name', 'doc_type', 'project_id', 'project_name', 'tag', 'created_at']
    });

    const documentsToUpdate = [];
    for await (const result of searchResults.results) {
      const doc = result.document;
      documentsToUpdate.push({
        '@search.action': 'merge',
        doc_id: doc.doc_id,
        project_id: updates.projectId,
        project_name: updates.projectName,
        tag: updates.tag || '',
        updated_at: new Date().toISOString()
      });
    }

    if (documentsToUpdate.length === 0) {
      return {
        success: true,
        message: 'No documents found with this file name',
        updatedCount: 0
      };
    }

    // Update documents
    await client.uploadDocuments(documentsToUpdate);

    console.log(JSON.stringify({
      kpmsg: {
        id: "AI_PORTAL_NOTEBOOK",
        name: "updateETSDocumentsByFileName",
        detail: {
          message: `Updated ${documentsToUpdate.length} documents with fileName: ${fileName}`,
          updatedCount: documentsToUpdate.length,
          updates: {
            projectId: updates.projectId,
            projectName: updates.projectName,
            tag: updates.tag
          }
        }
      }
    }));

    return {
      success: true,
      message: `Successfully updated ${documentsToUpdate.length} document(s)`,
      updatedCount: documentsToUpdate.length
    };
  } catch (error) {
    console.error('Error updating ETS documents by file name:', error);
    throw new Error(`Failed to update documents: ${error.message}`);
  }
}
