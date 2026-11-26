import { vectorizeAndIndexETSDocument } from '@/app/services/insertChunckedFileIntoVectorDataService';

const ETS_INDEX_NAME = 'ets-001';

export async function uploadETSDocuments(files, projectId, projectName, tag) {
  try {
    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }

    if (!projectId || !projectName) {
      throw new Error('Project ID and Project Name are required');
    }

    const results = [];
    const errors = [];

    for (const file of files) {
      try {

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Create document object matching the expected format
        const document = {
          fileName: file.name,
          fileContent: buffer,
          projectId: projectId,
          projectName: projectName,
          tag: tag
        };

        // Use vectorizeAndIndexDocument with ETS index
        const result = await vectorizeAndIndexETSDocument(document, ETS_INDEX_NAME);
        
        results.push({
          fileName: file.name,
          status: 'success',
          result: result
        });
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        errors.push({
          fileName: file.name,
          status: 'error',
          error: error.message
        });
      }
    }

    if (errors.length > 0 && results.length === 0) {
      throw new Error('All files failed to upload');
    }

    return {
      message: `Successfully uploaded ${results.length} of ${files.length} file(s)`,
      projectId,
      projectName,
      tag,
      results,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    console.error('Error uploading ETS documents:', error);
    throw new Error(`Failed to upload documents: ${error.message}`);
  }
}
