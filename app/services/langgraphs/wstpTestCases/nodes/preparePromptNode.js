export const preparePromptNode = async (state) => {
  const {
    fileDescription,
    filteredUploadedFilesSearchResults,
    filteredDesignIndexSearchResults,
    filteredWebsiteURLsSearchResults,
    filteredSavedResponseSearchResults,
    filteredSharePointFilesearchResults,
    filteredJiraIssueSearchResults,
    workflowNotes
  } = state;

  let prompt = state.prompt;

  // Add workflow notes if available
  if (workflowNotes?.length > 0) {
    const notesContent = workflowNotes.map(note => note.content || note).join('\n');
    prompt += `\n\nWorkflow Instructions:\n${notesContent}`;
  }

  // Add uploaded files context if available
  if (filteredUploadedFilesSearchResults?.length > 0) {
    prompt += `\n\nRelevant Uploaded Files: ${JSON.stringify(filteredUploadedFilesSearchResults)}`;
  }

  // Add search results context if available
  if (filteredDesignIndexSearchResults?.length > 0) {
    prompt += `\n\nRelevant Design Index Results: ${JSON.stringify(filteredDesignIndexSearchResults)}`;
  }
  if (filteredWebsiteURLsSearchResults?.length > 0) {
    prompt += `\n\nRelevant Website URLs: ${JSON.stringify(filteredWebsiteURLsSearchResults)}`;
  }
  if (filteredSavedResponseSearchResults?.length > 0) {
    prompt += `\n\nRelevant Saved Responses: ${JSON.stringify(filteredSavedResponseSearchResults)}`;
  }
  if (filteredSharePointFilesearchResults?.length > 0) {
    prompt += `\n\nRelevant SharePoint Files: ${JSON.stringify(filteredSharePointFilesearchResults)}`;
  }
  if (filteredJiraIssueSearchResults?.length > 0) {
    prompt += `\n\nRelevant Jira Issues: ${JSON.stringify(filteredJiraIssueSearchResults)}`;
  }

  // Add instructions for output format
  prompt += `\n\nCreate well-structured test cases that include testCaseId, testCaseName, description, preCondition, requirementIds, requirements, steps (with data, stepNumber, stepDescription, and expectedResult), testCaseType, testCaseStatus, testCasePriority, testCaseDesignerName, testCaseAssignedTo, module, method, market, application, workstream, feature, category, persona, union. If no value, leave blank.`;

  return { enrichedPrompt: prompt };
};
