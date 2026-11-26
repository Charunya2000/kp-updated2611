import { selectRelatedSharePointFiles } from "@/app/services/actualSourcesService";

const createMessagesFromSharePointFiles = (sharePointFiles) => {
  const contents = [];

  sharePointFiles.forEach(filesArray => {
    filesArray.forEach(result => {
      contents.push(result.document.content);
    });
  });

  return contents.join(' ');
};

export const sharePointFilesNode = async (state) => {

  const foundSharePointFiles = await selectRelatedSharePointFiles(state.smartNoteId, state.teamName);
  const filteredSharePointFiles = foundSharePointFiles.filter(sharePointFile =>
    state.actualSources.some(actualSource => actualSource.sourceId === sharePointFile.id)
  );
  const SharePointFilesearchResults = await Promise.all(
    filteredSharePointFiles.map(async (sharePointFile) => {
      const filter = `smartnote_id eq '${sharePointFile.parentId}' and file_name eq '${sharePointFile.fileName}' and site_name eq '${sharePointFile.siteName}'`;
      const result = await searchIndex({
        searchIndex: 'sharepoint-uploads',
        selectFields: ["file_name", "content"],
        searchEmbedding: state.originalPromptEmbedding,
        nearestNeighbors: 5,
        filter
      });
      return result;
    })
  );
  const filteredSharePointFilesearchResults = createMessagesFromSharePointFiles(SharePointFilesearchResults);

  return { filteredSharePointFilesearchResults };
};
