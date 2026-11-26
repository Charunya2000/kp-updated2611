import { prepDocument } from '@clientServices/insertDocument';
import { getJiraIssuesByJQL } from '@clientServices/jiraIntegrationService';
import { addJiraIssueToSources } from '@clientServices/sourceService';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, FormControl, IconButton, TextField, Chip, Typography } from '@mui/material';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useJiraIssues, useJiraIssuesDispatch } from '@reducers/JiraIssueContext';
import { useSourcesDispatch } from '@reducers/SourceContext';
import PropTypes from 'prop-types';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import JiraIssueTable from './JiraIssueTable';
import JiraCheckedIssues from './JiraCheckedIssues';

const JiraCustomFilterDialog = ({ open, onClose }) => {
  const [jqlQuery, setJqlQuery] = useState('');
  const smartNote = useSmartNote();
  const jiraIssuesDispatch = useJiraIssuesDispatch();
  const { jiraIssues: existingSources } = useJiraIssues();
  const sourcesDispatch = useSourcesDispatch();
  const [jiraIssues, setJiraIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [startAt, setStartAt] = useState(0);
  const [maxResults, setMaxResults] = useState(10);
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);
  const [checkedIssues, setCheckedIssues] = useState([]);
  const { teamName, assistantName } = useParams();

  const fetchIssues = async (jql, fetchStartAt = 0) => {
    setLoading(true);
    try {
      setQueryError(null);
      const result = await getJiraIssuesByJQL(teamName, assistantName, smartNote, jql, fetchStartAt, maxResults);
      if (result.error) {
        setQueryError(result.error);
        setJiraIssues([]);
        setTotal(0);
        return;
      }
      setStartAt(fetchStartAt);
      setJiraIssues(result.issues || []);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJqlChange = (event) => {
    setQueryError(null);
    setJqlQuery(event.target.value);
  };

  const handleRowClick = (jiraIssueItem) => {
    setCheckedIssues(prevChecked =>
      prevChecked.find(ji => ji.key === jiraIssueItem.key)
        ? prevChecked.filter(ji => ji.key !== jiraIssueItem.key)
        : [...prevChecked, jiraIssueItem]
    );
  };

  const handleAddIssuesToSources = async () => {
    for (const issue of checkedIssues) {
      let jiraIssueItem = jiraIssues.find(jiraIssue => jiraIssue.key === issue.key);
      // filter out any k/v pairs that have a null or undefined value, then
      // capitalize the first letter of the first letter of each key, then prefix it with 'jira'
      // e.g. key -> jiraKey, summary -> jiraSummary, description -> jiraDescription
      jiraIssueItem = Object.fromEntries(Object.entries(jiraIssueItem)
        .filter(([key, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [`jira${key.charAt(0).toUpperCase()}${key.slice(1)}`, value]));

      const jiraIssueDocument = prepDocument({
        ...jiraIssueItem,
        type: 'JiraIssue',
        smartNoteId: smartNote.id,
        issueType: jiraIssueItem.jiraIssueType,
        jiraKey: jiraIssueItem.jiraKey,
        jiraDescription: jiraIssueItem.jiraDescription,
        jiraSummary: jiraIssueItem.jiraSummary,
        parentId: smartNote.id,
        status: 'PENDING'
      });
      const jiraIssueSourceDocument = prepDocument({
        type: 'Source',
        smartNoteId: smartNote.id,
        sourceType: 'JiraIssue',
        sourceId: jiraIssueDocument.id,
        parentId: jiraIssueDocument.parentId,
        selected: true
      });

      addJiraIssueToSources(teamName, assistantName, jiraIssueDocument, jiraIssueSourceDocument);
      jiraIssuesDispatch({ type: 'CREATE_JIRA_ISSUE', jiraIssue: jiraIssueDocument });
      sourcesDispatch({ type: 'CREATE_SOURCE', source: jiraIssueSourceDocument });
      handleClose();
    }
  };

  const handleNextPage = () => {
    fetchIssues(jqlQuery, startAt + maxResults);
  };

  const handlePreviousPage = () => {
    fetchIssues(jqlQuery, Math.max(0, startAt - maxResults));
  };

  const handleSubmit = async () => {
    await fetchIssues(jqlQuery, 0);
  };

  const handleClose = () => {
    onClose();
    setJqlQuery('');
    setJiraIssues([]);
    setTotal(0);
    setStartAt(0);
    setCheckedIssues([]);
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      sx={{
        '& .MuiPaper-root': {
          borderRadius: '20px', // More rounded border
        },
      }}>
      <DialogTitle>
        Filter Jira Issues
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 6
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', minHeight: '550px', maxHeight: '700px', flexDirection: 'column', mt: 2, gap: 2, pt: 2, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ flexGrow: 1 }}>
              <TextField
                label="Jira Query Language (JQL)"
                value={jqlQuery}
                onChange={handleJqlChange}
                onKeyDown={(e) => { e.key === 'Enter' && handleSubmit(); }}
                variant="outlined"
                placeholder='e.g. project = "ABC" AND status = "To Do"'
                error={!!queryError}
                helperText={queryError && queryError}
              />
            </FormControl>
            <Button variant="action" size='large' onClick={handleSubmit}>Submit</Button>
          </Box>
          <Box sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              <JiraIssueTable jiraIssues={jiraIssues} handleRowClick={handleRowClick} checkedIssues={checkedIssues} existingSources={existingSources} />
            )}
            <JiraCheckedIssues checkedIssues={checkedIssues} handleRowClick={handleRowClick} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant="secondary"
                onClick={handlePreviousPage}
                disabled={loading || startAt === 0}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={handleNextPage}
                disabled={loading || startAt + jiraIssues.length >= total}
              >
                Next
              </Button>
              {total > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {startAt + 1}–{startAt + jiraIssues.length} of {total}
                </Typography>
              )}
            </Box>
            <Button onClick={handleAddIssuesToSources} variant="primary" disabled={checkedIssues.length === 0}>
              Add Selected Issues to Sources
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

JiraCustomFilterDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default JiraCustomFilterDialog;