import { selectRelatedSharePointFiles } from "@/app/services/actualSourcesService";
import { searchIndex } from "@/app/services/searchVectorDataService";

export const addSharePointMessagesNode = async (state) => {
  const foundSharePointFiles = await selectRelatedSharePointFiles(state.smartNoteId, state.teamName);
  const filteredSharePointFiles = foundSharePointFiles.filter(sharePointFile =>
    state.actualSources.some(actualSource => actualSource.sourceId === sharePointFile.id)
  );
  const SharePointFilesearchResults = await Promise.all(
    filteredSharePointFiles.map(async (sharePointFile) => {
      const filter = `smartnote_id eq '${sharePointFile.parentId}' and file_name eq '${sharePointFile.fileName}' and  site_name eq '${sharePointFile.siteName}'`;

      const result = await searchIndex({
        searchIndex: 'sharepoint-uploads',
        selectFields: ["file_name", "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 5,
        filter
      });

      return result;
    })
  );
  const filteredSharePointFilesearchResults = createMessagesFromSharePointFiles(SharePointFilesearchResults);

  const totalMessages = [
    ...(Array.isArray(state.totalMessages) ? state.totalMessages : []),
    ...filteredSharePointFilesearchResults
  ];

  return { totalMessages };
}

const createMessagesFromSharePointFiles = (sharePointFiles) => {
  const messages = [];

  sharePointFiles.forEach(filesArray => {
    filesArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `file name: ${result.document.file_name}, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};