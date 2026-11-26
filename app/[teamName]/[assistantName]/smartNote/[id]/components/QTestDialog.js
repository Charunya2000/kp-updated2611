'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Collapse,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  TextField
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import {
  Close as CloseIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Description as TestCaseIcon,
  ExpandLess,
  ExpandMore
} from '@mui/icons-material';
import { getQTestProjects, getProjectDetails, getModuleDetails, getTestCaseDetails } from '@clientServices/qTestService';

const QTestDialog = ({ open, onClose, onSubmit }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]); // initial project list
  const [selectedProjectId, setSelectedProjectId] = useState(null); // chosen project
  // Memoized alphabetical sort (case-insensitive) for large project lists
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [projects]);
  const [projectData, setProjectData] = useState(null); // detailed data for selected project
  const projectDetailsCache = useRef(new Map()); // cache to avoid refetching project details
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [moduleChildren, setModuleChildren] = useState(new Map());
  const [selectedTestCases, setSelectedTestCases] = useState(new Map());
  const [loadingModules, setLoadingModules] = useState(new Set());

  useEffect(() => {
    if (open) {
      // Load projects first if not selected
      if (!selectedProjectId && projects.length === 0) {
        loadProjects();
      } else if (selectedProjectId && !projectData) {
        loadProjectDetails(selectedProjectId);
      }
    }
  }, [open, selectedProjectId]);

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getQTestProjects();
      setProjects(data);
    } catch (err) {
      setError('Failed to load qTest projects.');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectDetails = async (projectId) => {
    // Serve from cache if present
    if (projectDetailsCache.current.has(projectId)) {
      setProjectData(projectDetailsCache.current.get(projectId));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getProjectDetails(projectId);
      projectDetailsCache.current.set(projectId, data);
      setProjectData(data);
    } catch (err) {
      setError('Failed to load project details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = (pid) => {
    // On project change, clear module/test case state to avoid cross-project mixing.
    setSelectedProjectId(pid);
    setModuleChildren(new Map());
    setExpandedModules(new Set());
    setSelectedTestCases(new Map());
  };

  const loadModuleChildren = async (moduleId) => {
    if (moduleChildren.has(moduleId)) return;

    setLoadingModules(prev => new Set([...prev, moduleId]));
    try {
      const data = await getModuleDetails(moduleId, selectedProjectId);
      setModuleChildren(prev => new Map([...prev, [moduleId, data.children || []]]));
    } catch (err) {
      setError(`Failed to load module details for ${moduleId}`);
    } finally {
      setLoadingModules(prev => {
        const newSet = new Set(prev);
        newSet.delete(moduleId);
        return newSet;
      });
    }
  };

  const handleModuleClick = async (moduleId) => {
    const isExpanded = expandedModules.has(moduleId);
    
    if (isExpanded) {
      // Collapse
      setExpandedModules(prev => {
        const newSet = new Set(prev);
        newSet.delete(moduleId);
        return newSet;
      });
    } else {
      // Expand
      setExpandedModules(prev => new Set([...prev, moduleId]));
      await loadModuleChildren(moduleId);
    }
  };

  const handleTestCaseSelect = (testCase) => {
    const isSelected = selectedTestCases.has(testCase.id);
    
    if (isSelected) {
      // Deselect
      setSelectedTestCases(prev => {
        const newMap = new Map(prev);
        newMap.delete(testCase.id);
        return newMap;
      });
    } else {
      // Check if we can select more (max 5)
      if (selectedTestCases.size >= 5) {
        setError('Maximum 5 test cases can be selected');
        return;
      }
      
      // Select
      setSelectedTestCases(prev => new Map([...prev, [testCase.id, testCase]]));
      setError(''); // Clear any previous error
    }
  };

  const handleSubmit = async () => {
    if (selectedTestCases.size === 0) {
      setError('Please select at least one test case');
      return;
    }

    setLoading(true);
    try {
      const testCaseIds = Array.from(selectedTestCases.keys());
  const testCaseDetails = await getTestCaseDetails(testCaseIds, selectedProjectId);

      // Build per-test-case plain text blocks (no aggregation) so parent can create individual sources
      const perCaseBlocks = testCaseDetails.test_cases.map(tc => {
        const steps = (tc.test_steps || []).map(step => `Step: ${step.description}\nExpected: ${step.expected}`).join('\n');
        const content = `Test Case: ${tc.name}\nDescription: ${tc.description}\nSteps:\n${steps}`;
        return {
          id: tc.id || tc.test_case_id || tc.name, // fallback if id field differs
          name: tc.name,
          description: tc.description,
            // keep original selected meta if available (from tree) for future enhancements
          content
        };
      });

      // Parent now receives an array of per-case content blocks
      onSubmit(perCaseBlocks);
      handleClose();
    } catch (err) {
      setError('Failed to submit test cases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Preserve moduleChildren to cache previously loaded modules & test cases across dialog openings.
    // Only clear UI expansion and selection state.
    setExpandedModules(new Set());
    setSelectedTestCases(new Map());
    setError('');
    onClose();
  };

  const renderItem = (item, level = 0) => {
    const isModule = item.type === 'module';
    const isExpanded = expandedModules.has(item.id);
    const isLoading = loadingModules.has(item.id);
    const isSelected = selectedTestCases.has(item.id);
    const children = moduleChildren.get(item.id) || [];

    return (
      <Box key={item.id}>
        <ListItem sx={{ pl: level * 2 }} disablePadding>
          <ListItemButton
            onClick={() => isModule ? handleModuleClick(item.id) : handleTestCaseSelect(item)}
            dense
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {isModule ? (
                isLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    {isExpanded ? (
                      <FolderOpenIcon color="primary" sx={{ ml: 0.5 }} />
                    ) : (
                      <FolderIcon sx={{ ml: 0.5 }} />
                    )}
                  </Box>
                )
              ) : (
                <Checkbox
                  checked={isSelected}
                  size="small"
                  color="primary"
                />
              )}
            </ListItemIcon>
            <ListItemText
              primary={item.name}
              primaryTypographyProps={{
                fontSize: '0.9rem',
                fontWeight: isModule ? 'medium' : 'normal'
              }}
            />
          </ListItemButton>
        </ListItem>
        
        {isModule && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {children.map(child => renderItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  // Project selection view (before detailed tree)
  if (open && !selectedProjectId) {
    return (
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        sx={{ '& .MuiPaper-root': { borderRadius: '20px', minHeight: '500px' } }}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={500} fontSize={'18pt'}>
              Select qTest Project
            </Typography>
            <IconButton onClick={handleClose}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
          {loading && projects.length === 0 && (
            <Box sx={{ display:'flex', justifyContent:'center', py:4 }}><CircularProgress /></Box>
          )}
          {!loading && projects.length === 0 && !error && (
            <Typography variant="body2">No projects available.</Typography>
          )}
          {projects.length > 0 && (
            <Autocomplete
              disablePortal
              options={sortedProjects}
              autoHighlight
              getOptionLabel={(option) => option.name}
              onChange={(e, value) => value && handleSelectProject(value.id)}
              slotProps={{
                paper: {
                  sx: {
                    maxHeight: '350px', // Show ~10 items without scrolling
                  },
                },
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search & Select Project"
                  placeholder="Type keywords..."
                  size="small"
                />
              )}
              sx={{ mt: 1 }}
            />
          )}
          {projects.length > 15 && (
            <Typography variant="caption" sx={{ mt: 1, display:'block' }} color="text.secondary">
              Showing {projects.length} projects. Use search to narrow results.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2 }}>
          <Button onClick={handleClose} variant="outlined">Cancel</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiPaper-root': {
          borderRadius: '20px',
          height: '80vh'
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography fontWeight={500} fontSize={'18pt'}>
            Select qTest Cases
          </Typography>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
          {selectedProjectId && (
            <Button
              onClick={() => {
                // User opts to change project: clear project-specific caches.
                setSelectedProjectId(null);
                setProjectData(null);
                setModuleChildren(new Map());
                setExpandedModules(new Set());
                setSelectedTestCases(new Map());
              }}
              variant="outlined"
              size="small"
              sx={{ ml: 2 }}
            >
              Change Project
            </Button>
          )}
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Selected Test Cases Summary */}
        {selectedTestCases.size > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Selected ({selectedTestCases.size}/5):
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Array.from(selectedTestCases.values()).map(tc => (
                <Chip
                  key={tc.id}
                  label={tc.name}
                  size="small"
                  onDelete={() => handleTestCaseSelect(tc)}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
            <Divider sx={{ mt: 2 }} />
          </Box>
        )}

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && !projectData && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Project Tree */}
        {projectData && (
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <List dense>
              {projectData.items.map(item => renderItem(item))}
            </List>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} variant="outlined">
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={selectedTestCases.size === 0 || loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Adding...' : `Add ${selectedTestCases.size} Test Cases`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QTestDialog;