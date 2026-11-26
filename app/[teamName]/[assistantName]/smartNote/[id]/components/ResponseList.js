'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Checkbox, IconButton, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import QuickreplyOutlinedIcon from '@mui/icons-material/QuickreplyOutlined';
import { useSavedResponses, useSavedResponsesDispatch } from '@reducers/SavedResponseContext';
import { getSavedResponses, deleteSavedResponse, updateSavedResponse } from '@clientServices/savedResponseService';
import AddToSourcesFooter from './AddToSourcesFooter';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useParams } from 'next/navigation';

const ResponseList = ({ onSaveResponsesToSources, assistantName: assistantNameProp }) => {
  const smartNote = useSmartNote();
  const { savedResponses } = useSavedResponses();
  const savedResponsesDispatch = useSavedResponsesDispatch();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [hoveredResponse, setHoveredResponse] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editResponse, setEditResponse] = useState({ responseTitle: '', responseMarkdown: '' });
  const [localResponses, setLocalResponses] = useState([]); // Add local state backup
  const { teamName, assistantName: paramsAssistantName } = useParams();
  const assistantName = assistantNameProp || paramsAssistantName;

  // Update local responses when context changes
  useEffect(() => {
    if (savedResponses && savedResponses.length > 0) {
      setLocalResponses(savedResponses);
    }
  }, [savedResponses]);

  // Use local responses as fallback
  const displayResponses = savedResponses && savedResponses.length > 0 ? savedResponses : localResponses;

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      // Only fetch if we have the required parameters
      if (!teamName || !assistantName || !smartNote?.id) {
        return;
      }

      // Only fetch if we don't have any saved responses yet
      if (displayResponses && displayResponses.length > 0) {
        return; // Skip fetching, we already have data
      }

      try {
        const foundSavedResponses = await getSavedResponses(teamName, assistantName, smartNote);

        if (!cancelled && foundSavedResponses) {
          savedResponsesDispatch({ type: 'SET_SAVED_RESPONSES', savedResponses: foundSavedResponses });
          setLocalResponses(foundSavedResponses); // Also update local state
        }
      } catch (error) {
        console.error('Error fetching saved responses:', error);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [teamName, assistantName, smartNote?.id]); // Keep stable dependencies

  const handleCheckboxChange = (savedResponse) => {
    const updatedSavedResponse = { ...savedResponse, selected: !savedResponse.selected };
    savedResponsesDispatch({ type: 'UPDATE_SAVED_RESPONSE', savedResponse: updatedSavedResponse });

    setLocalResponses(prevResponses =>
      prevResponses.map(response =>
        response.id === updatedSavedResponse.id ? updatedSavedResponse : response
      )
    );
  };

  const handleMouseEnter = (savedResponseId) => {
    setHoveredResponse(savedResponseId);
  };

  const handleMenuOpen = (event, savedResponse) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedResponse(savedResponse);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDeleteClick = () => {
    setDialogType('Delete');
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogType('');
    setNewTitle('');
    setSelectedResponse(null);
  };

  const handleRename = () => {
    const updatedSavedResponse = { ...selectedResponse, responseTitle: newTitle };
    savedResponsesDispatch({ type: 'UPDATE_SAVED_RESPONSE', savedResponse: updatedSavedResponse });
    handleDialogClose();
  };

  const handleDelete = async () => {
    await deleteSavedResponse(teamName, assistantName, selectedResponse);
    savedResponsesDispatch({ type: 'DELETE_SAVED_RESPONSE', id: selectedResponse.id });

    setLocalResponses(prevResponses =>
      prevResponses.filter(response => response.id !== selectedResponse.id)
    );

    handleDialogClose();
  };

  const handleListItemClick = (savedResponse) => {
    setEditResponse(savedResponse);
    setEditDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    setSelectedResponse(null);
  };

  const handleEditSave = async () => {
    const updatedSavedResponse = { ...editResponse, responseTitle: editResponse.responseTitle, responseMarkdown: editResponse.responseMarkdown };
    await updateSavedResponse(teamName, assistantName, updatedSavedResponse);
    savedResponsesDispatch({ type: 'UPDATE_SAVED_RESPONSE', savedResponse: updatedSavedResponse });

    setLocalResponses(prevResponses =>
      prevResponses.map(response =>
        response.id === updatedSavedResponse.id ? updatedSavedResponse : response
      )
    );

    setEditDialogOpen(false);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditResponse(prevResponse => ({
      ...prevResponse,
      [name]: value,
    }));
  };

  return (
    <Box sx={{ flexGrow: 1, overflowY: 'auto', padding: 0 }}>
      {displayResponses && displayResponses.length > 0 && (
        displayResponses.map((savedResponse) => (
          <Box
            key={savedResponse.id}
            onMouseEnter={() => handleMouseEnter(savedResponse.id)}
            onMouseLeave={() => setHoveredResponse(null)}
            sx={{ display: 'flex', flexGrow: 0, justifyContent: 'space-between', alignItems: 'center', padding: 0, cursor: 'pointer' }}
          >
            <Box
              sx={{ display: 'flex', flexGrow: 0, overflow: 'hidden', alignItems: 'center' }}
              onClick={() => handleListItemClick(savedResponse)}>
              <Box sx={{ display: 'flex', flexGrow: 0, overflow: 'hidden', alignItems: 'center' }}>
                <IconButton
                  onClick={(event) => handleMenuOpen(event, savedResponse)}
                  onMouseDown={(event) => event.stopPropagation()}
                  sx={{
                    transition: 'opacity 0.3s',
                  }}
                >
                  {hoveredResponse === savedResponse.id ? (
                    <MoreVertIcon sx={{ fontSize: '24px' }} />
                  ) : (
                    <QuickreplyOutlinedIcon sx={{ fontSize: '24px' }} />
                  )}
                </IconButton>
                <Typography sx={{
                  cursor: 'pointer',
                  ml: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>{savedResponse.responseTitle || 'foobar'}</Typography>
              </Box>
            </Box>
            <Checkbox
              onChange={() => handleCheckboxChange(savedResponse)}
              checked={!!savedResponse.selected}
            />
          </Box>
        ))
      )}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleDeleteClick}>Delete</MenuItem>
      </Menu>
      <Dialog open={dialogOpen} onClose={handleDialogClose}>
        <DialogTitle>{dialogType === 'Edit' ? 'Edit Response' : 'Delete Response'}</DialogTitle>
        <DialogContent>
          {dialogType === 'Edit' ? (
            <TextField
              autoFocus
              margin="dense"
              label="New Title"
              type="text"
              fullWidth
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          ) : (
            <Typography>Are you sure you want to delete this response?</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} variant="secondary">Cancel</Button>
          {dialogType === 'Edit' ? (
            <Button onClick={handleRename} variant="primary">Edit</Button>
          ) : (
            <Button onClick={handleDelete} variant="destructive">Delete</Button>
          )}
        </DialogActions>
      </Dialog>
      <Dialog
        maxWidth="md"
        fullWidth
        open={editDialogOpen}
        onClose={handleEditDialogClose}
        sx={{
          '& .MuiPaper-root': {
            borderRadius: '20px', // More rounded border
          },
        }}>
        <DialogTitle>Edit Response</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="responseTitle"
            label="Title"
            type="text"
            fullWidth
            variant="outlined"
            value={editResponse.responseTitle || ''}
            onChange={handleEditChange}
          />
          <TextField
            margin="dense"
            name="responseMarkdown"
            label="Response"
            type="text"
            fullWidth
            variant="outlined"
            multiline
            rows={4}
            value={editResponse.responseMarkdown || ''}
            onChange={handleEditChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditDialogClose} variant="secondary">Cancel</Button>
          <Button onClick={handleEditSave} variant="primary">Save</Button>
        </DialogActions>
      </Dialog>
      <AddToSourcesFooter saveToSources={() => onSaveResponsesToSources(displayResponses)} />
    </Box>
  );
};

export default ResponseList;