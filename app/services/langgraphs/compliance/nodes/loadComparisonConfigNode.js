// loadComparisonConfigNode.js
import { selectGeisingerConfigContextDocuments } from "@/app/services/geisingerConfigService";

export const loadComparisonConfigNode = async (state) => {
  const configQuery = {
    type: 'GeisingerConfig',
    collectionName: 'Document Comparison', // Use a distinct collection name for comparison configs
  };

  const { data: configDocuments } = await selectGeisingerConfigContextDocuments(configQuery);
  const validatedConfigDocuments = (Array.isArray(configDocuments) ? configDocuments : [])
    .map((doc) => ({ ...doc, documentText: String(doc?.documentText || '').trim() }))
    .filter((doc) => !!doc.documentText);

  return {
    ...state,
    configDocuments: validatedConfigDocuments
  };
};
