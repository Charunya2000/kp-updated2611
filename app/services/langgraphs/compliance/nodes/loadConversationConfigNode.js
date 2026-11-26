import { selectGeisingerConfigContextDocuments } from "@/app/services/geisingerConfigService";

/**
 * Node to load config and extract embedded JSON schema from context message.
 * Adds both the system prompt and the extracted schema to state.config.userIntent.
 */
export const loadConfigNode = async (state) => {

  const configQuery = {
    type: 'GeisingerConfig',
    collectionName: 'Document Conversation',
  }

  const { data: configDocuments } = await selectGeisingerConfigContextDocuments(configQuery);
  const validatedConfigDocuments = (Array.isArray(configDocuments) ? configDocuments : [])
    .map((doc) => ({ ...doc, documentText: String(doc?.documentText || '').trim() }))
    .filter((doc) => !!doc.documentText);

  return {
    ...state,
    configDocuments: validatedConfigDocuments
  };
};
