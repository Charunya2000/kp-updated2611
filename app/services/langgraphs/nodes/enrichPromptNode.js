
export const enrichPromptNode = async (state) => {

  const totalMessages = [
    ...state.filteredMessages,
    ...state.filteredDesignReferenceSearchResults,
    ...state.filteredSavedResponseSearchResults,
    ...state.filteredDesignIndexSearchResults,
    ...state.confluenceSearchResults,
    ...state.filteredUploadedDocumentSearchResults,
    ...state.filteredSharePointFilesearchResults,
    ...state.filteredWebsiteURLsSearchResults
  ];

  const enrichedPrompt = totalMessages.map(result => result.content).join("\n") + "\n\nUser question is: " + state.chatInteraction.prompt;
  return { enrichedPrompt };
};
