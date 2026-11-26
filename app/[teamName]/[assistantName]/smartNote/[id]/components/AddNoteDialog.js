'use client';

import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import { useSavedNotesDispatch } from '@reducers/SavedNoteContext';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { prepDocument } from '@clientServices/insertDocument';
import { createSavedNote } from '@clientServices/savedNoteService';
import { useParams } from 'next/navigation';

export default function AddNoteDialog() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState({ noteTitle: '', noteContent: '' });
  const savedNotesDispatch = useSavedNotesDispatch();
  const smartNote = useSmartNote();
  const { teamName, assistantName } = useParams();

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNote(prevNote => ({
      ...prevNote,
      [name]: value,
    }));
  };

  const onSave = async (savedNote) => {
    savedNote.type = 'SavedNote';
    savedNote.parentId = smartNote.id;
    savedNote.smartNoteId = smartNote.id;
    const preparedSavedNote = prepDocument(savedNote);
    savedNotesDispatch({ type: 'CREATE_SAVED_NOTE', savedNote: preparedSavedNote });
    createSavedNote(teamName, assistantName, preparedSavedNote);
  };

  const handleSave = () => {
    onSave(note);
    handleClose();
    setNote({ noteTitle: '', noteContent: '' });
  };

  return (
    <Box>
      <Button
        variant="action"
        startIcon={<AddOutlinedIcon />}
        onClick={handleClickOpen}
        sx={{ marginBottom: 2, width: '100%' }}
      >
        Add note
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiPaper-root': {
            borderRadius: '20px', // More rounded border
          },
        }}
      >
        <form onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}>
          <DialogTitle>Add Note</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflow: 'auto', maxHeight: '80vh' }}>
            <TextField
              autoFocus
              margin="dense"
              name="noteTitle"
              label="Title"
              type="text"
              fullWidth
              variant="outlined"
              value={note.noteTitle}
              onChange={handleChange}
            />
            <TextField
              margin="dense"
              name="noteContent"
              label="Content"
              type="text"
              fullWidth
              variant="outlined"
              multiline
              minRows={8}
              value={note.noteContent}
              onChange={handleChange}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handleClose}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="primary"
              variant="primary"
            >
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}