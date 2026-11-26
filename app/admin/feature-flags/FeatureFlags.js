'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  ListItem,
  ListItemText,
  FormControlLabel,
  Switch,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import useSnackbar from '@/app/hooks/useSnackbar';
import {
  getAllFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
} from '@/app/clientServices/featureFlagService';
import { formatName } from '@/utils/formatting';

const sortFlags = (flags) =>
  [...flags].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

const FeatureFlags = () => {
  const [flags, setFlags] = useState([]);
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [flagName, setFlagName] = useState('');
  const [flagDescription, setFlagDescription] = useState('');
  const [flagEnabled, setFlagEnabled] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { SnackbarComponent, showSnackbar } = useSnackbar();

  useEffect(() => {
    const fetchFlags = async () => {
      setLoading(true);
      try {
        const response = await getAllFeatureFlags();
        if (response && response.flags) {
          setFlags(sortFlags(response.flags));
        } else if (response && response.error) {
          showSnackbar(`Failed to load feature flags: ${response.error}`, 'error');
        } else {
          setFlags([]);
        }
      } catch (error) {
        showSnackbar('Failed to load feature flags', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchFlags();
  }, [showSnackbar]);

  const handleFlagClick = (flag) => {
    setSelectedFlag(flag);
    setFlagName(flag.name);
    setFlagDescription(flag.description || '');
    setFlagEnabled(flag.enabled);
  };

  const handleCreate = async () => {
    if (!flagName.trim()) {
      showSnackbar('Feature flag name is required', 'error');
      return;
    }

    try {
      const response = await createFeatureFlag({
        name: flagName.trim(),
        description: flagDescription.trim() || null,
        enabled: flagEnabled,
      });

      if (response && !response.error) {
        const created = { ...response.data };
        setFlags(sortFlags([...flags, created]));
        showSnackbar('Feature flag created successfully', 'success');
        clearForm();
      } else {
        showSnackbar(response.error || 'Failed to create feature flag', 'error');
      }
    } catch (error) {
      showSnackbar('Error creating feature flag', 'error');
    }
  };

  const handleUpdate = async () => {
    if (!flagName.trim()) {
      showSnackbar('Feature flag name is required', 'error');
      return;
    }

    // Store the original flag state for rollback
    const originalFlags = flags;

    // Optimistically update UI
    const updatedFlags = flags.map((f) =>
      f.id === selectedFlag.id
        ? { ...f, name: flagName.trim(), description: flagDescription.trim() || null, enabled: flagEnabled }
        : f
    );
    setFlags(sortFlags(updatedFlags));

    try {
      const response = await updateFeatureFlag(selectedFlag.id, {
        name: flagName.trim(),
        description: flagDescription.trim() || null,
        enabled: flagEnabled,
      });

      if (response && !response.error) {
        showSnackbar('Feature flag updated successfully', 'success');
        clearForm();
      } else {
        // Rollback to original state on API error
        setFlags(originalFlags);
        showSnackbar(response.error || 'Failed to update feature flag', 'error');
      }
    } catch (error) {
      // Rollback to original state on exception
      setFlags(originalFlags);
      showSnackbar('Error updating feature flag', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      const response = await deleteFeatureFlag(selectedFlag.id);
      if (response && !response.error) {
        setFlags(flags.filter((f) => f.id !== selectedFlag.id));
        showSnackbar('Feature flag deleted successfully', 'success');
        clearForm();
        setDeleteConfirmOpen(false);
      } else {
        showSnackbar(response.error || 'Failed to delete feature flag', 'error');
      }
    } catch (error) {
      showSnackbar('Error deleting feature flag', 'error');
    }
  };

  const clearForm = () => {
    setSelectedFlag(null);
    setFlagName('');
    setFlagDescription('');
    setFlagEnabled(true);
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', gap: 2, p: 3, maxHeight: 'calc(100vh - 120px)' }}>
      {/* Flags List */}
      <Box
        sx={{
          width: '50%',
          border: '1px solid',
          borderColor: 'color.slate',
          borderRadius: 1,
          overflow: 'auto',
        }}
      >
        <Typography variant="h6" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'color.slate' }}>
          Feature Flags ({flags.length})
        </Typography>
        {loading && flags.length === 0 && (
          <Box sx={{ pt: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={48} />
          </Box>
        )}
        {flags.map((flag) => (
          <ListItem
            key={flag.id}
            button="true"
            onClick={() => handleFlagClick(flag)}
            selected={selectedFlag && selectedFlag.id === flag.id}
            sx={{ cursor: 'pointer' }}
          >
            <ListItemText
              primary={flag.name}
              secondary={flag.description}
            />
            <Chip
              label={flag.enabled ? 'Enabled' : 'Disabled'}
              color={flag.enabled ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
          </ListItem>
        ))}
      </Box>

      {/* Flag Form */}
      <Box
        sx={{
          width: '50%',
          border: '1px solid',
          borderColor: 'color.slate',
          borderRadius: 1,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <Typography variant="h6" sx={{ mb: 2 }}>
          {selectedFlag ? 'Edit Feature Flag' : 'Add Feature Flag'}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
          <TextField
            label="Flag Name"
            value={flagName}
            onChange={(e) => setFlagName(e.target.value)}
            onBlur={(e) => setFlagName(formatName(e.target.value))}
            fullWidth
            required
            helperText="Unique identifier for the feature flag (e.g. pdf-images)"
          />

          <TextField
            label="Description"
            value={flagDescription}
            onChange={(e) => setFlagDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            helperText="Optional: describe what this feature flag controls"
          />

          <FormControlLabel
            control={
              <Switch
                checked={flagEnabled}
                onChange={(e) => setFlagEnabled(e.target.checked)}
              />
            }
            label="Enabled"
          />

          <Box sx={{ display: 'flex', gap: 1, mt: 'auto', flexWrap: 'wrap' }}>
            {selectedFlag ? (
              <>
                <Button variant="primary" onClick={handleUpdate}>
                  Save Changes
                </Button>
                <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
                  Delete
                </Button>
                <Button variant="secondary" onClick={clearForm}>
                  Clear
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={handleCreate}>
                  Add Flag
                </Button>
                <Button variant="secondary" onClick={clearForm}>
                  Clear
                </Button>
              </>
            )}
          </Box>
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete the feature flag?</Typography>
          {selectedFlag && (
            <Typography sx={{ mt: 1, fontWeight: 600 }}>{selectedFlag.name}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <SnackbarComponent />
    </Box>
  );
};

export default FeatureFlags;
