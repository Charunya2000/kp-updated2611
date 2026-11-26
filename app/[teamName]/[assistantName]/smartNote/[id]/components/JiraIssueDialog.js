import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Table, TableBody, TableCell, TableHead, TableRow, TextField, Select, MenuItem, InputLabel, FormControl, Typography, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PropTypes from 'prop-types';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useJiraIssues, useJiraIssuesDispatch } from '@reducers/JiraIssueContext';
import { useSourcesDispatch } from '@reducers/SourceContext';
import { getValueStreams, getJiraIssuesByValueStream } from '@clientServices/jiraIntegrationService';
import { addJiraIssueToSources } from '@clientServices/sourceService';
import { prepDocument } from '@clientServices/insertDocument';
import { useTheme } from '@mui/material/styles';
import { useParams } from 'next/navigation';
import JiraIssueTable from './JiraIssueTable';
import JiraCheckedIssues from './JiraCheckedIssues';

const JiraIssueDialog = ({ open, onClose }) => {
  const theme = useTheme();
  const [selectedTypes, setSelectedTypes] = useState(['SAFe Capability', 'Epic', 'User Story', 'Functional User Story', 'Test', 'Defect']);
  const smartNote = useSmartNote();
  const jiraIssuesDispatch = useJiraIssuesDispatch();
  const sourcesDispatch = useSourcesDispatch();
  const [filterText, setFilterText] = useState('');
  const [filterKey, setFilterKey] = useState('');
  const [valueStreams, setValueStreams] = useState([]);
  const [selectedValueStream, setSelectedValueStream] = useState('');
  const { jiraIssues: existingSources } = useJiraIssues();
  const [jiraIssues, setJiraIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [startAt, setStartAt] = useState(0);
  const [maxResults, setMaxResults] = useState(10);
  const [loading, setLoading] = useState(false);
  const [checkedIssues, setCheckedIssues] = useState([]);
  const { teamName, assistantName } = useParams();

  useEffect(() => {
    const fetchValueStreams = async () => {
      if (smartNote) {
        const streams = await getValueStreams(teamName, assistantName, smartNote);
        setValueStreams(streams);
      }
    };
    if (open) {
      fetchValueStreams();
    }
  }, [smartNote, open]);

  const handleTypeClick = async (type) => {
    setSelectedTypes((prevSelectedTypes) =>
      prevSelectedTypes.includes(type)
        ? prevSelectedTypes.filter((t) => t !== type)
        : [...prevSelectedTypes, type]
    );
    if (selectedValueStream) {
      setLoading(true);
      try {
        const result = await getJiraIssuesByValueStream(teamName, assistantName, smartNote, selectedValueStream, filterKey, filterText, [...selectedTypes, type], startAt, maxResults);
        setJiraIssues(result.issues || []);
        setTotal(result.total || 0);
      } catch (error) {
        console.error('Error fetching issues:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFilterChange = (event) => {
    setFilterText(event.target.value);
  };

  const handleFilterKeyChange = (event) => {
    setFilterKey(event.target.value);
  };

  const handleValueStreamChange = async (event) => {
    const valueStreamId = event.target.value;
    setSelectedValueStream(valueStreamId);
    const result = await getJiraIssuesByValueStream(teamName, assistantName, smartNote, valueStreamId, filterKey, filterText, selectedTypes, startAt, maxResults);
    setJiraIssues(result.issues || []);
    setTotal(result.total || 0);
  };

  const handleNextPage = async () => {
    const newStartAt = startAt + maxResults;
    const result = await getJiraIssuesByValueStream(teamName, assistantName, smartNote, selectedValueStream, filterKey, filterText, selectedTypes, newStartAt, maxResults);
    setStartAt(newStartAt);
    setJiraIssues(result.issues || []);
    setTotal(result.total || 0);
  };

  const handlePreviousPage = async () => {
    const newStartAt = Math.max(0, startAt - maxResults);
    const result = await getJiraIssuesByValueStream(teamName, assistantName, smartNote, selectedValueStream, filterKey, filterText, selectedTypes, newStartAt, maxResults);
    setStartAt(newStartAt);
    setJiraIssues(result.issues || []);
    setTotal(result.total || 0);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const result = await getJiraIssuesByValueStream(teamName, assistantName, smartNote, selectedValueStream, filterKey, filterText, selectedTypes, 0, maxResults);
      setStartAt(0);
      setJiraIssues(result.issues || []);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (jiraIssueItem) => {
    setCheckedIssues(prevChecked =>
      prevChecked.find(ji => ji.key === jiraIssueItem.key)
        ? prevChecked.filter(ji => ji.key !== jiraIssueItem.key)
        : [...prevChecked, jiraIssueItem]
    );
  };

  const textFieldStyles = {
    borderRadius: '10px', // Updated border radius
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

  const handleClose = () => {
    onClose();
    setJiraIssues([]);
    setTotal(0);
    setStartAt(0);
    setCheckedIssues([]);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" sx={{
      '& .MuiPaper-root': {
        borderRadius: '20px', // More rounded border
        height: { xs: '95vh', md: '92vh' },
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
      },
    }}
    >
      <DialogTitle>
        Select Jira issue
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ overflowX: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <FormControl fullWidth sx={{ marginY: 2 }}>
          <InputLabel id="value-stream-label">Value Stream</InputLabel>
          <Select
            labelId="value-stream-label"
            value={selectedValueStream || ''}
            onChange={handleValueStreamChange}
            label="Value Stream"
            sx={textFieldStyles}
          >
            {valueStreams.map((stream) => (
              <MenuItem key={stream.id} value={stream.id}>
                {stream.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ padding: 2, marginBottom: 2, border: 'solid', borderColor: '#b0c4de', borderWidth: '2px', borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom>
            Search Parameters
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, marginBottom: 2 }}>
            <TextField
              label="Jira Key"
              variant="outlined"
              value={filterKey || ''}
              onChange={handleFilterKeyChange}
              sx={{ flex: '1 1 20%', ...textFieldStyles }} // Reduced width
            />
            <TextField
              label="Jira Description"
              variant="outlined"
              value={filterText || ''}
              onChange={handleFilterChange}
              sx={{ flex: '1 1 80%', ...textFieldStyles }} // Increased width
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'nowrap', alignItems: 'stretch' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, flex: 1, border: '2px dashed', borderColor: '#b0c4de', borderRadius: 2, padding: 1.5 }}>
              {['SAFe Capability', 'Epic', 'User Story', 'Functional User Story', 'Test', 'Defect'].map((type) => (
                <Button
                  key={type}
                  onClick={() => handleTypeClick(type)}
                  variant={selectedTypes.includes(type) ? 'primary' : 'secondary'}
                  sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {type}
                </Button>
              ))}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', alignSelf: 'flex-start', border: '2px dashed', borderColor: '#b0c4de', borderRadius: 2, padding: 1.5, flex: '0 0 auto', height: 'stretch' }}>
              <Button
                variant="action"
                onClick={handleRefresh}
                disabled={loading}
                className="userSettings"
                sx={{ whiteSpace: 'nowrap' }}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </Box>
          </Box>
        </Box>
        <Box sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1, minHeight: 0 }}>
          <JiraIssueTable jiraIssues={jiraIssues} handleRowClick={handleRowClick} checkedIssues={checkedIssues} existingSources={existingSources} />
          <JiraCheckedIssues checkedIssues={checkedIssues} handleRowClick={handleRowClick} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', gap: 1.5, flexWrap: 'wrap' }}>
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
            <Button onClick={handleAddIssuesToSources} variant="primary" disabled={checkedIssues.length === 0} sx={{ whiteSpace: 'normal', width: { xs: '100%', md: 'auto' } }}>
              Add Selected Issues to Sources
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog >
  );
};

JiraIssueDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default JiraIssueDialog;