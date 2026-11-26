export const createMessagesNode = (state) => {
  const messageParts = [
    state.filteredSavedNotes,
    state.filteredUploadedFilesSearchResults,
    state.filteredDesignIndexSearchResults,
    state.filteredWebsiteURLsSearchResults,
    state.filteredSavedResponseSearchResults,
    state.filteredSharePointFilesearchResults,
    state.filteredJiraIssueSearchResults,
    state.workflowNotes ? `Workflow Instructions: ${JSON.stringify(state.workflowNotes)}` : '',
  ].filter(Boolean);

  const messages = messageParts.join('\n\n');

  return { messages };
}