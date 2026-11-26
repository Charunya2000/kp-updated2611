import { searchIndex } from '@services/searchVectorDataService';
import { selectRelatedJiraIssues } from '@services/actualSourcesService';

const createMessagesFromSavedResponses = (savedJiraIssue) => {
  const contents = [];

  savedJiraIssue.forEach(jiraIssueArray => {
    jiraIssueArray.forEach(result => {
      contents.push(result.document.content);
    });
  });

  return contents.join(' ');
};

export const jiraIssuesNode = async (state) => {
  const foundSavedJiraIssues = await selectRelatedJiraIssues(state.smartNoteId, state.teamName);
  const filteredSavedJiraIssues = foundSavedJiraIssues.filter(savedJiraIssue =>
    state.actualSources.some(actualSource => actualSource.sourceId === savedJiraIssue.id)
  );
  const savedResponseSearchResults = await Promise.all(
    filteredSavedJiraIssues.map(async (savedJiraIssue) => {
      const filter = `smart_type eq 'JiraIssue' and smartnote_id eq '${savedJiraIssue.parentId}'`;
      const result = await searchIndex({
        searchIndex: 'smartnote-001',
        selectFields: ["smart_type", "content"],
        searchEmbedding: state.originalPromptEmbedding,
        nearestNeighbors: 5,
        filter
      });
      return result;
    })
  );
  const filteredJiraIssueSearchResults = createMessagesFromSavedResponses(savedResponseSearchResults);
  return { filteredJiraIssueSearchResults };
};