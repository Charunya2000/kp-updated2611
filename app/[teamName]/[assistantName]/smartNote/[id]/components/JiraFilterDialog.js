import { prepDocument } from '@clientServices/insertDocument';
import { getFilters, getJiraIssuesByFilterId } from '@clientServices/jiraIntegrationService';
import { addJiraIssueToSources } from '@clientServices/sourceService';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, FormControl, IconButton, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useJiraIssues, useJiraIssuesDispatch } from '@reducers/JiraIssueContext';
import { useSourcesDispatch } from '@reducers/SourceContext';
import PropTypes from 'prop-types';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import JiraIssueTable from './JiraIssueTable';
import JiraCheckedIssues from './JiraCheckedIssues';

const JiraFilterDialog = ({ open, onClose }) => {
  const [selectedFilter, setSelectedFilter] = useState('');
  const [selectedIssue, setSelectedIssue] = useState('');
  const smartNote = useSmartNote();
  const { existingSources } = useJiraIssues();
  const jiraIssuesDispatch = useJiraIssuesDispatch();
  const sourcesDispatch = useSourcesDispatch();
  const [jiraIssues, setJiraIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState([]);
  const [startAt, setStartAt] = useState(0);
  const [maxResults, setMaxResults] = useState(10);
  const [loading, setLoading] = useState(false);
  const [checkedIssues, setCheckedIssues] = useState([]);
  const { teamName, assistantName } = useParams();

  useEffect(() => {
    if (!smartNote) return;
    fetchFilters();
  }, [smartNote]);

  useEffect(() => {
    if (selectedFilter) {
      fetchIssues(selectedFilter, 0);
    }
  }, [selectedFilter]);

  const fetchFilters = async () => {
    try {
      const fetchedFilters = await getFilters(teamName, assistantName, smartNote) || [];
      setFilters(fetchedFilters);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const fetchIssues = async (filter, fetchStartAt) => {
    setLoading(true);
    try {
      const result = await getJiraIssuesByFilterId(teamName, assistantName, smartNote, filter, fetchStartAt, maxResults);
      setStartAt(fetchStartAt);
      setJiraIssues(result.issues || []);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (event) => {
    setSelectedFilter(event.target.value);
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
    fetchIssues(selectedFilter, startAt + maxResults);
  };

  const handlePreviousPage = () => {
    fetchIssues(selectedFilter, Math.max(0, startAt - maxResults));
  };

  const handleClose = () => {
    onClose();
    setJiraIssues([]);
    setTotal(0);
    setStartAt(0);
    setCheckedIssues([]);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth sx={{
      '& .MuiPaper-root': {
        borderRadius: '20px', // More rounded border
      },
    }}>
      <DialogTitle>
        Filter Jira Issues
        <IconButton
          aria-label="close"
          onClick={() => {
            onClose();
            setSelectedFilter('');
            setJiraIssues([]);
            setStartAt(0);
          }}
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
        <Box sx={{ display: 'flex', minHeight: '550px', flexDirection: 'column', mt: 2, gap: 2, pt: 2, overflow: 'hidden' }}>
          <FormControl fullWidth>
            <InputLabel id="filter-label">Filters</InputLabel>
            <Select
              labelId="filter-label"
              value={selectedFilter}
              onChange={handleFilterChange}
              label="Filters"
            >
              {filters && filters.map((filter) => (
                <MenuItem key={filter.filterId} value={filter.filterId}>
                  {filter.filterName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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

JiraFilterDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default JiraFilterDialog;