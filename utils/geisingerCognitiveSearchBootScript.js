import { listAllIndexNames, createIndex } from '../app/services/aiSearchIndexService.js';

export const validateOrCreateNeededIndexes = async () => {
  try {
    const requiredIndex = "geisinger-002";

    // Get all existing index names
    const existingIndexes = await listAllIndexNames();

    // Check for missing indexes
    const matchIndexName = existingIndexes.find(index => index === requiredIndex);

    if (!matchIndexName) {
      console.log("Missing index:", requiredIndex);
      // Use dynamic import for fs and synchronous read for consistency
      const fs = await import('fs');
      const path = await import('path');
      const indexJsonPath = path.resolve(process.cwd(), 'geisingerIndex.json');
      const indexJsonText = fs.readFileSync(indexJsonPath, 'utf-8');
      const indexDef = JSON.parse(indexJsonText);
      await createIndex(indexDef);
    } else {
      console.log("All required indexes are present.");
    }
  } catch (error) {
    console.error('Could not connect to or get index names or create needed index with Azure Cognitive Search because of error:', error);
  }
}
