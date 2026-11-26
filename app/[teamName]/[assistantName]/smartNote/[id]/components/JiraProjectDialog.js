import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Table, TableBody, TableCell, TableHead, TableRow, TextField, Select, MenuItem, InputLabel, FormControl, Typography, Button, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PropTypes from 'prop-types';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useJiraIssues, useJiraIssuesDispatch } from '@reducers/JiraIssueContext';
import { useSourcesDispatch } from '@reducers/SourceContext';
import { getJiraProjects, getJiraIssuesByProject } from '@clientServices/jiraIntegrationService';
import { addJiraIssueToSources } from '@clientServices/sourceService';
import { prepDocument } from '@clientServices/insertDocument';
import { useTheme } from '@mui/material/styles';
import { useUserAssistants } from '@/reducers/UserAssistantContext';
import { useParams } from 'next/navigation';
import JiraIssueTable from './JiraIssueTable';
import JiraCheckedIssues from './JiraCheckedIssues';

const JiraProjectDialog = ({ open, onClose }) => {
  const theme = useTheme();
  const [selectedTypes, setSelectedTypes] = useState(['SAFe Capability', 'Epic', 'Story', 'Test']);
  const smartNote = useSmartNote();
  const jiraIssuesDispatch = useJiraIssuesDispatch();
  const sourcesDispatch = useSourcesDispatch();
  const [filterText, setFilterText] = useState('');
  const [filterKey, setFilterKey] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [jiraIssues, setJiraIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const { jiraIssues: existingSources } = useJiraIssues();
  const [startAt, setStartAt] = useState(0);
  const [maxResults, setMaxResults] = useState(10);
  const [loading, setLoading] = useState(false);
  const [checkedIssues, setCheckedIssues] = useState([]);
  const { selectedUserAssistant } = useUserAssistants()
  const { teamName, assistantName, id: smartNoteId } = useParams();

  useEffect(() => {
    const fetchProjects = async () => {
      if (smartNote) {
        let projectList = await getJiraProjects(teamName, assistantName, smartNote);
        projectList = projectList.filter(project => project.assistant === selectedUserAssistant.name);
        setProjects(projectList);
        setSelectedProject(projectList.length > 0 ? projectList[0].projectName : '');
      }
    };
    if (open) {
      fetchProjects();
    }
  }, [smartNote, open]);

  const handleTypeClick = async (type) => {
    const newSelectedTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    setSelectedTypes(newSelectedTypes);

    if (!selectedProject) return;

    if (newSelectedTypes.length === 0) {
      setJiraIssues([]);
      return;
    }

    setLoading(true);
    try {
      const result = await getJiraIssuesByProject(
        teamName,
        assistantName,
        smartNote,
        selectedProject,
        filterKey,
        filterText,
        newSelectedTypes,
        startAt,
        maxResults
      );
      setJiraIssues(result.issues || []);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (event) => {
    setFilterText(event.target.value);
  };

  const handleFilterKeyChange = (event) => {
    setFilterKey(event.target.value);
  };

  const handleProjectChange = async (event) => {
    const projectName = event.target.value;
    setSelectedProject(projectName);
    const result = await getJiraIssuesByProject(teamName, assistantName, smartNote, projectName, filterKey, filterText, selectedTypes, startAt, maxResults);
    setJiraIssues(result.issues || []);
    setTotal(result.total || 0);
  };

  const handleNextPage = async () => {
    // if did not project and no types selected, return early
    if (!selectedProject || selectedTypes.length === 0) return;
    const newStartAt = startAt + maxResults;
    const result = await getJiraIssuesByProject(teamName, assistantName, smartNote, selectedProject, filterKey, filterText, selectedTypes, newStartAt, maxResults);
    setStartAt(newStartAt);
    setJiraIssues(result.issues || []);
    setTotal(result.total || 0);
  };

  const handlePreviousPage = async () => {
    if (!selectedProject || selectedTypes.length === 0) return;
    const newStartAt = Math.max(0, startAt - maxResults);
    const result = await getJiraIssuesByProject(teamName, assistantName, smartNote, selectedProject, filterKey, filterText, selectedTypes, newStartAt, maxResults);
    setStartAt(newStartAt);
    setJiraIssues(result.issues || []);
    setTotal(result.total || 0);
  };

  const handleRefresh = async () => {
    if (!selectedProject || selectedTypes.length === 0) {
      setJiraIssues([]); // Clear issues if no project or no types
      return;
    }
    setLoading(true);
    try {
      const result = await getJiraIssuesByProject(
        teamName,
        assistantName,
        smartNote,
        selectedProject,
        filterKey,
        filterText,
        selectedTypes,
        0,
        maxResults
      );
      setStartAt(0);
      setJiraIssues(result.issues || []);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setJiraIssues([]); // Clear issues on error
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

  const handleAddIssuesToSources = async () => {
    for (const issue of checkedIssues) {
      let jiraIssueItem = jiraIssues.find(jiraIssue => jiraIssue.key === issue.key);

      jiraIssueItem = Object.fromEntries(Object.entries(jiraIssueItem)
        .filter(([key, value]) => value !== null && value !== undefined));

      const jiraIssueDocument = prepDocument({
        type: 'JiraIssue',
        smartNoteId: smartNote.id,
        issueType: jiraIssueItem.issueType, // Jira Type (e.g., Story, Epic)
        jiraKey: jiraIssueItem.key,
        jiraDescription: jiraIssueItem.description,
        jiraSummary: jiraIssueItem.summary,
        parentId: smartNote.id,

        // List of additional fields requested by Anand 
        jiraStatus: jiraIssueItem.status,
        jiraEpicName: jiraIssueItem.epicName, // missing
        // jiraEpicLink: jiraIssueItem.epicLink,
        jiraFixVersions: jiraIssueItem.fixVersions, // missing
        jiraAcceptanceCriteria: jiraIssueItem.acceptanceCriteria, // missing

        jiraAssigneeName: jiraIssueItem.assigneeName,
        jiraAssigneeEmail: jiraIssueItem.assigneeEmail,
        jiraAssigneeNUID: jiraIssueItem.assigneeNUID,

        jiraReporterName: jiraIssueItem.reporterName,
        jiraReporterEmail: jiraIssueItem.reporterEmail,
        jiraReporterNUID: jiraIssueItem.reporterNUID,
        jiraStoryPoints: jiraIssueItem.storyPoints,
      });
      const jiraIssueSourceDocument = prepDocument({
        type: 'Source',
        smartNoteId: smartNote.id,
        sourceType: 'JiraIssue',
        sourceId: jiraIssueDocument.id,
        parentId: jiraIssueDocument.parentId,
        selected: true
      });
      addJiraIssueToSources(teamName, assistantName, jiraIssueDocument, jiraIssueSourceDocument); // debug here 
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

  const textFieldStyles = {
    borderRadius: '10px',
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" sx={{
      '& .MuiPaper-root': {
        borderRadius: '20px',
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
      <DialogContent>
        <Box sx={{ display: 'flex', minHeight: '550px', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
          <FormControl fullWidth sx={{ mt: 0.75 }}>
            <InputLabel id="project-label">Project</InputLabel>
            <Select
              labelId="project-label"
              value={selectedProject || ''}
              onChange={handleProjectChange}
              label="Project"
              sx={textFieldStyles}
            >
              {projects.map((project) => (
                <MenuItem key={project.projectName} value={project.projectName}>
                  {project.projectName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ padding: 2, border: 'solid', borderColor: '#b0c4de', borderWidth: '2px', borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom>
              Search Parameters
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, marginBottom: 2 }}>
              <TextField
                label="Jira Key"
                variant="outlined"
                value={filterKey || ''}
                onChange={handleFilterKeyChange}
                sx={{ flex: '1 1 20%', ...textFieldStyles }}
              />
              <TextField
                label="Jira Description"
                variant="outlined"
                value={filterText || ''}
                onChange={handleFilterChange}
                sx={{ flex: '1 1 80%', ...textFieldStyles }}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1 }}>
                {['SAFe Capability', 'Epic', 'Story', 'Test'].map((type) => (
                  <Button
                    key={type}
                    onClick={() => handleTypeClick(type)}
                    variant={selectedTypes.includes(type) ? 'primary' : 'secondary'}
                  >
                    {type}
                  </Button>
                ))}
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="action"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="userSettings"
                  sx={{ alignSelf: 'flex-end' }}
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
              </Box>
            </Box>
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

JiraProjectDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default JiraProjectDialog;
