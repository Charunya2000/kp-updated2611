/**
 * Script to delete uploaded document from search index manually. This is useful for cleanup if the document was deleted from MongoDB but still exists in the search index, or if you want to remove a document from the search index without deleting it from MongoDB.
 * Usage: node scripts/deleteFromIndex.js
 */

import { loadEnvLocal } from '../../utils/envLoader.js';
import { deleteFromIndex } from '../../app/services/deleteFromVectorDataService.js';
import { setProcessEnvironment } from '../configActions.js';

async function main() {
  // load environment variables
  loadEnvLocal();
  // run setProcessEnvironment
  await setProcessEnvironment();

  // Hardcode your values here
  const query = {
    smartNoteId: '4e6aa0c7-1331-4077-be54-3967a521a0dd',
    fileName: 'VVE Jira Defect Dump_v1.xlsx'
  }
  const request = {
    searchIndex: 'smartnote-file-002',
    filter: `smartnote_id eq '${query.smartNoteId}' and smart_file_name eq '${query.fileName}'`
  };

  console.log('Deleting from index with query:', request);

  try {
    const response = await deleteFromIndex(request);
    console.log('Success! Response:', response);
  } catch (error) {
    console.error('Error deleting from index:', error);
    process.exit(1);
  }
}

main();