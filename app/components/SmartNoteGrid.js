'use client';

import React, { useState, useMemo } from 'react';
import { Box, Grid2, Typography, IconButton, Menu, MenuItem, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Button, Divider } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PropTypes from 'prop-types';
import { smartNoteStatus } from '@/utils/constants';
import Link from 'next/link';

const SmartNoteGrid = ({ smartNotes, sortOrder, handleCardClick, handleDelete, handleEditTitle, handleArchive, handleRestore, isArchivedView, isDeleteSmartNoteEnabled }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedSmartNote, setSelectedSmartNote] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const orderedSmartNotes = useMemo(() => {
    if (sortOrder === 'updatedAt') {
      return [...smartNotes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    if (sortOrder === 'title') {
      return [...smartNotes].sort((a, b) => a.title.localeCompare(b.title));
    }
    return smartNotes;
  }, [smartNotes, sortOrder]);

  const handleMenuOpen = (event, smartNote) => {
    event.stopPropagation(); // Prevent event propagation
    setAnchorEl({ [smartNote.id]: event.currentTarget });
    setSelectedSmartNote(smartNote);
  };

  const handleMenuClose = (clearSelected) => {
    setAnchorEl(null);
    if (clearSelected) {
      setSelectedSmartNote(null);
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
    handleMenuClose(false);
  };

  const handleConfirmDelete = () => {
    handleDelete(selectedSmartNote);
    setIsDeleteDialogOpen(false);
    setSelectedSmartNote(null);
  };

  const handleCancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setSelectedSmartNote(null);
  };

  const handleEditTitleClick = (event, smartNote) => {
    event.stopPropagation();
    setNewTitle(selectedSmartNote.title);
    setIsEditDialogOpen(true);
    handleMenuClose(false);
    setSelectedSmartNote(smartNote);
  };

  const handleEditDialogClose = () => {
    setIsEditDialogOpen(false);
    setSelectedSmartNote(null);
  };

  const handleEditDialogSave = () => {
    handleEditTitle(selectedSmartNote, newTitle);
    setIsEditDialogOpen(false);
    setSelectedSmartNote(null);
  };

  return (
    <Grid2 container spacing={2}>
      {orderedSmartNotes.map((smartNote) => (
        <Grid2 key={smartNote.id}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid',
              borderColor: 'color.dolphin',
              padding: 2,
              borderRadius: 4,
              backgroundColor: 'card.body.main',
              position: 'relative'
            }}
          >
            <IconButton
              sx={{ position: 'absolute', top: 8, right: 2 }}
              onClick={(event) => {
                event.stopPropagation(); // Prevent event propagation
                handleMenuOpen(event, smartNote);
              }}
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl && anchorEl[smartNote.id]}
              open={Boolean(anchorEl && anchorEl[smartNote.id])}
              onClose={() => handleMenuClose(true)}
            >
              <MenuItem onClick={(event) => handleEditTitleClick(event, smartNote)}>Edit Title</MenuItem>
              {isArchivedView ? (
                <MenuItem onClick={() => { handleRestore(selectedSmartNote); handleMenuClose(true); }}>Restore</MenuItem>
              ) : (
                <MenuItem disabled={selectedSmartNote?.status === smartNoteStatus.Cloning} onClick={() => { handleArchive(selectedSmartNote); handleMenuClose(true); }}>Archive</MenuItem>
              )}
              {isDeleteSmartNoteEnabled && (
                <MenuItem disabled={selectedSmartNote?.status === smartNoteStatus.Cloning} onClick={handleDeleteClick}>Delete</MenuItem>
              )}
            </Menu>
            <Typography variant="h6" sx={{ paddingRight: 4 }}>{smartNote.title}</Typography>
            <>
              {
                smartNote.assistantName !== 'case-360-assistant' && (
                  <>
                    <Typography sx={{ mt: 1 }} variant="body1">Notes: {smartNote.savedNoteCount}</Typography>
                    <Typography variant="body1">Uploaded Documents: {smartNote.uploadedDocumentCount}</Typography>
                    <Typography variant="body1">References: {smartNote.designReferenceCount}</Typography>
                    <Typography variant="body1">Jira Issues: {smartNote.jiraIssueCount}</Typography>
                  </>
                )
              }
              <Typography sx={{ mt: 1 }} variant="body1">Created: {smartNote.createdAt ? new Date(smartNote.createdAt).toLocaleString() : '-'}</Typography>
              <Typography variant="body1">Updated: {smartNote.updatedAt ? new Date(smartNote.updatedAt).toLocaleString() : '-'}</Typography>
            </>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              {isArchivedView ? (
                <Button
                  onClick={() => handleRestore(smartNote)}
                  variant="action"
                >
                  Restore
                </Button>
              ) : (
                <Link href={`/${smartNote.teamName}/${smartNote.assistantName}/smartNote/${smartNote.id}`} style={{ textDecoration: 'none' }}>
                  <Button
                    disabled={smartNote.disabled || smartNote.status === smartNoteStatus.Cloning}
                    onClick={() => handleCardClick(smartNote)}
                    variant="action"
                  >
                    {smartNote.status && smartNote.status === smartNoteStatus.Cloning ? `Cloning...` : `Edit smartnote`}
                  </Button>
                </Link>
              )}
            </Box>
          </Box>
        </Grid2>
      ))}
      <Dialog open={isEditDialogOpen} onClose={handleEditDialogClose}>
        <DialogTitle>Edit Title</DialogTitle>
        <Divider />
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            type="text"
            fullWidth
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleEditDialogClose}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleEditDialogSave}
            variant="primary"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isDeleteDialogOpen}
        onClose={handleCancelDelete}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <Divider />
        <DialogContent>
          {
            selectedSmartNote?.templateId ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant='body1' sx={{ fontWeight: 'bold', color: 'red' }}>
                  STOP!
                </Typography>
                <Typography>
                  This smart note is being shared as a template. If you delete this smart note, you will also delete the template.
                </Typography>
                <Typography>
                  Are you sure you want to delete both?
                </Typography>
              </Box>
            ) : (
              <Typography>
                Are you sure you want to delete this smart note?
              </Typography>
            )
          }
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCancelDelete}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="destructive"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Grid2 >
  );
};

SmartNoteGrid.propTypes = {
  smartNotes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      savedNoteCount: PropTypes.number.isRequired,
      uploadedDocumentCount: PropTypes.number.isRequired,
      designReferenceCount: PropTypes.number.isRequired,
      jiraIssueCount: PropTypes.number.isRequired,
      parentId: PropTypes.string,
    })
  ).isRequired,
  sortOrder: PropTypes.string.isRequired,
  handleCardClick: PropTypes.func.isRequired,
  handleDelete: PropTypes.func.isRequired,
  handleEditTitle: PropTypes.func.isRequired,
  handleArchive: PropTypes.func.isRequired,
  handleRestore: PropTypes.func.isRequired,
  isArchivedView: PropTypes.bool,
  isDeleteSmartNoteEnabled: PropTypes.bool,
};

export default SmartNoteGrid;