import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Alert,
  CircularProgress,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  FolderOpen as LoadIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Code as CodeIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { getAllGraphConfigurations } from '@/app/clientServices/graphConfigurationService';

/**
 * LoadGraphDialog component for loading and managing saved graphs
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {Function} props.onClose - Function to call when dialog closes
 * @param {Function} props.onLoad - Function to call when loading a graph (graph) => void
 * @param {Function} props.onDelete - Function to call when deleting a graph (graphId) => Promise
 * @param {Array} props.graphs - Array of available graphs
 * @param {boolean} props.loading - Whether operation is in progress
 * @param {string} props.error - Error message if any
 * @param {Function} props.onRefresh - Function to refresh graphs list
 */
export default function LoadGraphDialog({
  open,
  onClose,
  onLoad,
  teamName,
}) {
  const [selectedGraph, setSelectedGraph] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [graphs, setGraphs] = useState([]);
  const [error, setError] = useState(null);

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSelectedGraph(null);
      setLoading(true);

      loadGraphs();
    }
  }, [open]);

  const loadGraphs = async () => {
    try {
      const loadedGraphs = await getAllGraphConfigurations(teamName);
      // load graphs when dialog opens
      if (loadedGraphs) {
        setGraphs(loadedGraphs);
      }
    } catch (err) {
      console.error('Error loading graphs:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter graphs based on search query
  const filteredGraphs = graphs.filter(graph => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      graph.name?.toLowerCase().includes(query) ||
      graph.description?.toLowerCase().includes(query) ||
      graph.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  const handleLoad = () => {
    if (selectedGraph && onLoad) {
      onLoad(selectedGraph);
      onClose();
    }
  };


  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getGraphStats = (graph) => {
    const nodeCount = graph.nodes?.length || 0;
    const edgeCount = graph.edges?.length || 0;
    return `${nodeCount} nodes, ${edgeCount} edges`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ elevation: 0 }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <LoadIcon sx={{ fontSize: '24px' }} />
            Load Saved Graph
          </Box>
          <Typography variant="body2" color="text.secondary">
            {filteredGraphs.length} graph{filteredGraphs.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ minHeight: '400px', maxHeight: '900px' }}>
        <Box display="flex" flexDirection="column" gap={2} height="100%">
          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}

          <TextField
            placeholder="Search graphs by name, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={4}>
              <CircularProgress />
            </Box>
          ) : filteredGraphs.length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" py={4} gap={2}>
              <CodeIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
              <Typography variant="h6" color="text.secondary">
                {graphs.length === 0 ? 'No saved graphs' : 'No graphs match your search'}
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {graphs.length === 0
                  ? 'Create and save your first graph to see it here.'
                  : 'Try adjusting your search terms.'
                }
              </Typography>
            </Box>
          ) : (
            <List sx={{ flex: 1, overflow: 'auto' }}>
              {filteredGraphs.map((graph, index) => (
                <Box key={graph.id || index}>
                  <ListItem disablePadding>
                    <ListItemButton
                      selected={selectedGraph?.id === graph.id}
                      onClick={() => setSelectedGraph(graph)}
                      sx={{
                        borderRadius: 1,
                        mb: 1,
                        border: selectedGraph?.id === graph.id ? 2 : 1,
                        borderColor: selectedGraph?.id === graph.id ? 'primary.main' : 'divider',
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {graph.displayName}
                            </Typography>
                            <Chip
                              label={graph.version || '1.0.0'}
                              size="small"
                              variant="outlined"
                            />
                            {graph.isPublic && (
                              <Chip
                                label="Public"
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            )}
                            <Box sx={{ ml: 'auto' }}>{`Created by: ${graph.createdBy || 'Unknown'}`}</Box>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography sx={{ mb: 0.5, display: 'block' }} variant="body2" color="text.secondary" component={'span'}>
                              {graph.description || 'No description'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {getGraphStats(graph)} • Created {formatDate(graph.createdAt)}
                              {
                                graph.updatedAt && graph.updatedAt !== graph.createdAt &&
                                ` • Updated ${formatDate(graph.updatedAt)}`
                              }
                            </Typography>
                            {graph.tags && graph.tags.length > 0 && (
                              <Box mt={0.5} display="flex" gap={0.5} flexWrap="wrap">
                                {graph.tags.map((tag, tagIndex) => (
                                  <Chip
                                    key={tagIndex}
                                    label={tag}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.75rem', height: 20 }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  {index < filteredGraphs.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ display: 'flex', gap: 1 }}>
        <Button onClick={onClose} variant='secondary'>
          Cancel
        </Button>
        <Button
          onClick={handleLoad}
          disabled={!selectedGraph || loading}
          variant="primary"
          startIcon={<LoadIcon />}
        >
          Load Graph
        </Button>
      </DialogActions>
    </Dialog>
  );
}