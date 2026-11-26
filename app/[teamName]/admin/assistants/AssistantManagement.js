'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Chip,
  Stack,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  useTheme
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import LockIcon from '@mui/icons-material/Lock';
import LockOpen from '@mui/icons-material/LockOpen';
import { addAssistant, deleteAssistant, getAllAssistants, updateAssistant } from '@/app/clientServices/assistantService';
import { getUserAssistantsByAssistantId, bulkAddUsersToAssistant, removeUserFromAssistant } from '@/app/clientServices/userAssistantService';
import AssistantFormSection from './AssistantFormSection';
import useSnackbar from '@/app/hooks/useSnackbar';

const AssistantManagement = ({ teamName }) => {
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [assistantToDelete, setAssistantToDelete] = useState(null);
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false);
  const theme = useTheme();

  // Use the custom snackbar hook
  const { SnackbarComponent, showSnackbar } = useSnackbar();

  // Sort assistants by category then by name (memoized)
  const sortAssistants = useCallback((assistants) => {
    return [...assistants].sort((a, b) => {
      const categoryA = a.category?.toLowerCase() || '';
      const categoryB = b.category?.toLowerCase() || '';
      if (categoryA < categoryB) return -1;
      if (categoryA > categoryB) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }, []);

  // Fetch assistants
  const fetchAssistants = useCallback(async () => {

    try {
      setLoading(true);
      const assistantsList = await getAllAssistants(teamName);
      setAssistants(sortAssistants(assistantsList || []));
    } catch (error) {
      console.error('Error fetching assistants:', error);
      showSnackbar('Failed to load assistants', 'error');
    } finally {
      setLoading(false);
    }
  }, [teamName, showSnackbar]);

  useEffect(() => {
    if (teamName) {
      fetchAssistants();
    }
  }, [teamName, fetchAssistants]);

  // Fetch assigned users for an assistant
  const fetchAssignedUsers = useCallback(async (assistantId) => {
    if (!assistantId) {
      setAssignedUsers([]);
      return;
    }

    try {
      setLoadingUsers(true);
      const response = await getUserAssistantsByAssistantId(teamName, assistantId);
      setAssignedUsers(response?.users || []);
    } catch (error) {
      console.error('Error fetching assigned users:', error);
      showSnackbar('Failed to load assigned users', 'error');
      setAssignedUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [teamName, showSnackbar]);

  // Remove user from assistant (optimistic)
  const handleRemoveUserFromAssistant = async (nuid) => {
    if (!editingAssistant) {
      return;
    }

    // Store original state for potential rollback
    const originalAssignedUsers = [...assignedUsers];

    // Optimistically remove from UI
    setAssignedUsers(prev => prev.filter(user => user.nuid !== nuid));

    try {
      const response = await removeUserFromAssistant(teamName, editingAssistant.id, nuid);

      if (response && !response.error) {
        showSnackbar('User removed from assistant successfully', 'success');
      } else {
        // Rollback on failure
        setAssignedUsers(originalAssignedUsers);
        showSnackbar(response?.error || 'Failed to remove user', 'error');
      }
    } catch (error) {
      console.error('Error removing user from assistant:', error);
      // Rollback on failure
      setAssignedUsers(originalAssignedUsers);
      showSnackbar('Error removing user', 'error');
    }
  };

  // Clear editing state
  const handleClearInputs = useCallback(() => {
    setEditingAssistant(null);
    setAssignedUsers([]);
  }, []);

  // Memoize expensive computations to prevent re-calculation on every render
  const groupedAssistants = useMemo(() => {
    return assistants.reduce((acc, assistant) => {
      const category = assistant.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(assistant);
      return acc;
    }, {});
  }, [assistants]);

  const categories = useMemo(() => {
    return Object.keys(groupedAssistants).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
  }, [groupedAssistants]);

  // Memoize sorted assistants within each category to prevent re-sorting on every render
  const sortedGroupedAssistants = useMemo(() => {
    const sorted = {};
    Object.keys(groupedAssistants).forEach(category => {
      sorted[category] = [...groupedAssistants[category]].sort(
        (a, b) => a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase())
      );
    });
    return sorted;
  }, [groupedAssistants]);

  // Add new assistant (memoized)
  const handleAddAssistant = useCallback(async (newAssistant) => {
    try {
      setLoading(true);
      const response = await addAssistant(teamName, newAssistant);

      if (response && !response.error) {
        const assistantWithId = { ...newAssistant, id: response.id };
        setAssistants(sortAssistants([...assistants, assistantWithId]));
        showSnackbar('Assistant added successfully', 'success');
        return { success: true };
      } else {
        showSnackbar(response?.error || 'Failed to add assistant', 'error');
        return { success: false, error: response?.error };
      }
    } catch (error) {
      console.error('Error adding assistant:', error);
      showSnackbar('Error adding assistant', 'error');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [assistants, teamName, showSnackbar, sortAssistants]);

  // Bulk assign users to assistant (optimistic)
  const handleBulkAssignUsers = useCallback(async (bulkNuidInput) => {
    if (!bulkNuidInput.trim() || !editingAssistant) {
      return { success: false, error: 'Missing input or assistant' };
    }

    // Parse NUIDs from input (split by commas, or white-space)
    const nuids = bulkNuidInput
      .split(/[,\s]+/)
      .map(nuid => nuid.trim())
      .filter(nuid => nuid.length > 0)
      .filter((nuid, index, arr) => arr.indexOf(nuid) === index);

    if (nuids.length === 0) {
      return { success: false, error: 'No valid NUIDs provided' };
    }

    // Filter out NUIDs that are already assigned
    const existingNuids = assignedUsers.map(user => user.nuid);
    const newNuids = nuids.filter(nuid => !existingNuids.includes(nuid));

    if (newNuids.length === 0) {
      showSnackbar('All NUIDs are already assigned to this assistant', 'info');
      return { success: true };
    }

    // Store original state for potential rollback
    const originalAssignedUsers = [...assignedUsers];

    // Optimistically add new users to the UI
    const newUsers = newNuids.map(nuid => ({
      nuid,
      name: 'Loading...'
    }));
    setAssignedUsers(prev => [...prev, ...newUsers]);

    try {
      setBulkAssignLoading(true);
      const response = await bulkAddUsersToAssistant(teamName, editingAssistant.id, newNuids);

      if (response && !response.error) {
        showSnackbar(`Successfully assigned ${newNuids.length} user(s) to assistant`, 'success');
        // Refresh the assigned users list to get actual user names
        await fetchAssignedUsers(editingAssistant.id);
        return { success: true };
      } else {
        // Rollback on failure
        setAssignedUsers(originalAssignedUsers);
        showSnackbar(response?.error || 'Failed to assign users', 'error');
        return { success: false, error: response?.error };
      }
    } catch (error) {
      console.error('Error bulk assigning users:', error);
      // Rollback on failure
      setAssignedUsers(originalAssignedUsers);
      showSnackbar('Error assigning users', 'error');
      return { success: false, error: error.message };
    } finally {
      setBulkAssignLoading(false);
    }
  }, [assignedUsers, editingAssistant, teamName, showSnackbar, fetchAssignedUsers]);

  // Edit assistant (memoized)
  const handleEditAssistant = useCallback((assistant) => {
    setEditingAssistant(assistant);
    fetchAssignedUsers(assistant.id);
  }, [fetchAssignedUsers]);

  // Update assistant (memoized) 
  const handleUpdateAssistant = useCallback(async (updatedAssistant) => {
    try {
      setLoading(true);
      const response = await updateAssistant(teamName, updatedAssistant);

      if (response && !response.error) {
        setAssistants(sortAssistants(assistants.map(assistant =>
          assistant.id === updatedAssistant.id
            ? { ...assistant, ...updatedAssistant }
            : assistant
        )));
        showSnackbar('Assistant updated successfully', 'success');
        return { success: true };
      } else {
        showSnackbar(response?.error || 'Failed to update assistant', 'error');
        return { success: false, error: response?.error };
      }
    } catch (error) {
      console.error('Error updating assistant:', error);
      showSnackbar('Error updating assistant', 'error');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [editingAssistant, assistants, teamName, showSnackbar, handleClearInputs]);

  // Remove assistant (optimistic)
  const handleRemoveAssistant = async (assistant) => {
    // Store original assistant for rollback
    const assistantToRemove = { ...assistant };

    // Optimistically remove from UI
    setAssistants(prev => prev.filter(a => a.id !== assistant.id));

    try {
      const response = await deleteAssistant(teamName, assistant);

      if (response && !response.error) {
        showSnackbar('Assistant removed successfully', 'success');
        // Clear editing state if this was the assistant being edited
        if (editingAssistant && editingAssistant.id === assistant.id) {
          handleClearInputs();
        }
      } else {
        // Rollback on failure
        setAssistants(prev => sortAssistants([...prev, assistantToRemove]));
        showSnackbar('Failed to remove assistant', 'error');
      }
    } catch (error) {
      console.error('Error removing assistant:', error);
      // Rollback on failure
      setAssistants(prev => sortAssistants([...prev, assistantToRemove]));
      showSnackbar('Error removing assistant', 'error');
    }
  };

  // Confirm delete dialog (memoized handlers)
  const handleDeleteClick = useCallback((assistant) => {
    setAssistantToDelete(assistant);
    setDeleteConfirmationOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (assistantToDelete) {
      handleRemoveAssistant(assistantToDelete);
    }
    setDeleteConfirmationOpen(false);
    setAssistantToDelete(null);
  }, [assistantToDelete, handleRemoveAssistant]);

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%', overflow: 'hidden' }}>
      {/* Assistants List */}
      <Box sx={{
        width: '50%',
        border: '1px solid',
        borderColor: 'color.slate',
        borderRadius: 1,
        height: '100%',
        overflowY: 'auto'
      }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6">
            Current Assistants ({assistants.length})
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <CircularProgress fontSize={'32px'} />
          </Box>
        ) : assistants.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No assistants added yet.
            </Typography>
          </Box>
        ) : (
          <List dense>
            {categories.map((category) => (
              <React.Fragment key={category}>
                {/* Category Header */}
                <ListItem
                  sx={{
                    py: 1,
                    backgroundColor: 'background.subtle',
                    opacity: 0.9
                  }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                          sx={{
                            fontWeight: 'bold',
                            borderColor: 'primary.main',
                            color: 'primary.main'
                          }}
                        >
                          {category}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          ({sortedGroupedAssistants[category].length} assistant{sortedGroupedAssistants[category].length !== 1 ? 's' : ''})
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
                <Divider />

                {/* Assistants in Category */}
                {sortedGroupedAssistants[category].map((assistant, index) => (
                  <React.Fragment key={assistant.id}>
                    <ListItem
                      button="true"
                      onClick={() => handleEditAssistant(assistant)}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          aria-label="remove"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the list item click
                            handleDeleteClick(assistant);
                          }}
                          sx={{
                            color: 'error.dark',
                            '&:hover': { color: 'error.main' }
                          }}
                          size="small"
                          disabled={loading}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      }
                      sx={{
                        py: 1,
                        pl: 4,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'action.hover'
                        },
                        ...(editingAssistant && editingAssistant.id === assistant.id && {
                          backgroundColor: 'action.selected'
                        })
                      }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            {assistant.isPublic ? (
                              <LockOpen fontSize='medium' sx={{ color: 'text.secondary' }} />
                            ) : (
                              <LockIcon fontSize='medium' sx={{ color: 'text.secondary' }} />
                            )}
                            <Typography variant="body2">
                              {assistant.displayName}
                            </Typography>
                            <Chip
                              label={assistant.name}
                              size="small"
                              variant="outlined"
                              sx={{ fontFamily: 'monospace' }}
                            />
                          </Stack>
                        }
                      />
                    </ListItem>
                    {index < sortedGroupedAssistants[category].length - 1 && <Divider />}
                  </React.Fragment>
                ))}
                {category !== categories[categories.length - 1] && <Divider sx={{ my: 1 }} />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      {/* Form Section */}
      <AssistantFormSection
        editingAssistant={editingAssistant}
        assistants={assistants}
        loading={loading}
        onAddAssistant={handleAddAssistant}
        onUpdateAssistant={handleUpdateAssistant}
        onClearInputs={handleClearInputs}
        showSnackbar={showSnackbar}
        assignedUsers={assignedUsers}
        loadingUsers={loadingUsers}
        bulkAssignLoading={bulkAssignLoading}
        onBulkAssignUsers={handleBulkAssignUsers}
        onRemoveUserFromAssistant={handleRemoveUserFromAssistant}
        teamName={teamName}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmationOpen} onClose={() => setDeleteConfirmationOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body1">Are you sure you want to delete the <Typography sx={{ fontWeight: 'bold', color: theme.palette.mode === 'dark' ? theme.palette.error.light : theme.palette.error.main }} variant="body1" component="span">{assistantToDelete?.name}</Typography> assistant?<br />This will also clear all member assignments, and can not be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmationOpen(false)} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <SnackbarComponent />
    </Box>
  );
};

export default AssistantManagement;