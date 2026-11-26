import { searchIndex } from "@/app/services/searchVectorDataService";

const smartNoteIndex = 'smartnote-001';

export const searchIndexNode = async (state) => {
  const filter = `nuid eq '${state.nuid}' and smartnote_id eq '${state.smartNoteId}' and (smart_type eq 'ChatInteraction' or smart_type eq 'SavedNote' or smart_type eq 'JiraIssue' or smart_type eq 'UploadedDocument')`;

  const searchResults = await searchIndex({
    searchIndex: smartNoteIndex,
    selectFields: ["id", "nuid", "smartnote_id", "smart_type", "content"],
    searchEmbedding: state.promptEmbedding,
    nearestNeighbors: 5,
    filter
  });

  return { searchResults };
};