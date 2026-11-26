import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  Typography,
  Divider,
  FormControl,
  FormHelperText,
  Chip,
} from '@mui/material';
import { Save as SaveIcon, Update as UpdateIcon, Close as CloseIcon } from '@mui/icons-material';

/**
 * SaveGraphDialog component for saving or updating graphs
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {Function} props.onClose - Function to call when dialog closes
 * @param {Function} props.onSave - Function to call when saving (graphData, isUpdate) => Promise
 * @param {Object} props.currentGraph - Current graph data (for updates)
 * @param {Array} props.nodes - Current nodes array
 * @param {Array} props.edges - Current edges array
 * @param {boolean} props.loading - Whether save operation is in progress
 * @param {string} props.error - Error message if any
 * @param {string} props.initialName - Initial graph name from parent state
 * @param {string} props.initialDescription - Initial description from parent state  
 * @param {string} props.initialVersion - Initial version from parent state
 */
export default function SaveGraphDialog({
  open,
  onClose,
  onSave,
  currentGraph = null,
  nodes = [],
  edges = [],
  loading = false,
  error = null,
  initialName = '',
  initialDescription = '',
  initialVersion = '1.0.0',
}) {
  const isUpdate = currentGraph && currentGraph.id;

  // Derive initial values directly from props - no useEffect needed!
  const initialGraphName = isUpdate ? (currentGraph.name || '') : (initialName || '');
  const initialGraphDescription = isUpdate ? (currentGraph.description || '') : (initialDescription || '');
  const initialGraphVersion = isUpdate ? (currentGraph.version || '1.0.0') : (initialVersion || '1.0.0');
  const initialGraphTags = isUpdate ? (currentGraph.tags || []) : [];

  const [graphName, setGraphName] = useState(initialGraphName);
  const [description, setDescription] = useState(initialGraphDescription);
  const [version, setVersion] = useState(initialGraphVersion);
  const [tags, setTags] = useState(initialGraphTags);
  const [newTag, setNewTag] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    // Validation
    if (!graphName.trim()) {
      setValidationError('Graph name is required');
      return;
    }

    if (nodes.length === 0) {
      setValidationError('Graph must have at least one node');
      return;
    }

    setValidationError('');

    // Prepare graph data
    const graphData = {
      name: graphName.trim(),
      description: description.trim(),
      version: version.trim(),
      tags: tags,
      nodes,
      edges
    };

    // If updating, preserve the ID and creation date
    if (isUpdate) {
      graphData.id = currentGraph.id;
    }

    try {
      await onSave(graphData, isUpdate);
    } catch (err) {
      // Error handling is done in parent component
      console.error('Save error:', err);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
      PaperProps={{ elevation: 0 }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          {isUpdate ? <UpdateIcon sx={{ fontSize: '24px' }} /> : <SaveIcon sx={{ fontSize: '24px' }} />}
          {isUpdate ? 'Update Graph' : 'Save Graph'}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          {error && (
            <Alert severity="error" onClose={() => { }}>
              {error}
            </Alert>
          )}

          {validationError && (
            <Alert severity="warning">
              {validationError}
            </Alert>
          )}

          <TextField
            label="Graph Name"
            value={graphName}
            onChange={(e) => setGraphName(e.target.value)}
            fullWidth
            required
            disabled={loading}
            error={!graphName.trim() && validationError}
            helperText="A unique name for your graph"
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
            disabled={loading}
            helperText="Optional description of what this graph does"
          />

          <Box display="flex" gap={2}>
            <TextField
              label="Version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              disabled={loading}
              sx={{ flex: 1 }}
              helperText="Semantic version (e.g., 1.0.0)"
            />
          </Box>

          <Box display="flex" gap={1}>
            <TextField
              label="Tags"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyUp={handleTagInputKeyPress}
              disabled={loading}
              size="small"
              sx={{ flex: 1 }}
              helperText="Add tags to organize your graphs"
            />
            <Button
              onClick={handleAddTag}
              disabled={loading || !newTag.trim()}
              variant="action"
              sx={{ alignSelf: 'flex-start', minWidth: '80px' }}
            >
              Add
            </Button>
          </Box>

          {tags.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Tags:
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {tags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    onDelete={() => handleRemoveTag(tag)}
                    deleteIcon={<CloseIcon sx={{ fontSize: '10px' }} />}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{
                      fontSize: '14px',
                      '& .MuiChip-deleteIcon': {
                        color: 'error.dark',
                        '&:hover': {
                          color: 'error.main'
                        }
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ display: 'flex', gap: 1 }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading || !graphName.trim()}
          variant="primary"
          startIcon={loading ? <CircularProgress size={16} /> : (isUpdate ? <UpdateIcon /> : <SaveIcon />)}
        >
          {loading ? 'Saving...' : (isUpdate ? 'Update' : 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}