'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Stack,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import { formatName } from '@/utils/formatting';
import AssignedUsersList from './AssignedUsersList';

const AssistantFormSection = ({
  editingAssistant,
  assistants,
  loading,
  onAddAssistant,
  onUpdateAssistant,
  onClearInputs,
  onEditAssistant,
  showSnackbar,
  assignedUsers,
  loadingUsers,
  bulkAssignLoading,
  onBulkAssignUsers,
  onRemoveUserFromAssistant,
  teamName
}) => {
  // Form state
  const [categoryInput, setCategoryInput] = useState(editingAssistant?.category || '');
  const [nameInput, setNameInput] = useState(editingAssistant?.name || '');
  const [displayNameInput, setDisplayNameInput] = useState(editingAssistant?.displayName || '');
  const [descriptionInput, setDescriptionInput] = useState(editingAssistant?.description || '');
  const [isPublicInput, setIsPublicInput] = useState(editingAssistant?.isPublic || false);
  const [isNavRouteInput, setIsNavRouteInput] = useState(editingAssistant?.isNavRoute || false);
  const [isDeleteSmartNoteEnabledInput, setIsDeleteSmartNoteEnabledInput] = useState(editingAssistant?.isDeleteSmartNoteEnabled ?? true);
  const [isHiddenFromSettingsInput, setIsHiddenFromSettingsInput] = useState(editingAssistant?.isHiddenFromSettings ?? false);
  const [bulkNuidInput, setBulkNuidInput] = useState('');
  const [inputError, setInputError] = useState('');

  // Sync form state when editingAssistant changes
  React.useEffect(() => {
    if (editingAssistant) {
      setCategoryInput(editingAssistant.category || '');
      setNameInput(editingAssistant.name || '');
      setDisplayNameInput(editingAssistant.displayName || '');
      setDescriptionInput(editingAssistant.description || '');
      setIsPublicInput(editingAssistant.isPublic || false);
      setIsNavRouteInput(editingAssistant.isNavRoute || false);
      setIsDeleteSmartNoteEnabledInput(editingAssistant.isDeleteSmartNoteEnabled ?? true);
      setIsHiddenFromSettingsInput(editingAssistant.isHiddenFromSettings ?? false);
    } else {
      setCategoryInput('');
      setNameInput('');
      setDisplayNameInput('');
      setDescriptionInput('');
      setIsPublicInput(false);
      setIsNavRouteInput(false);
      setIsDeleteSmartNoteEnabledInput(true);
      setIsHiddenFromSettingsInput(false);
    }
    setBulkNuidInput('');
    setInputError('');
  }, [editingAssistant]);

  // Optimized input handlers
  const handleCategoryInputChange = useCallback((event) => {
    setCategoryInput(event.target.value);
    setInputError('');
  }, []);

  const handleNameInputChange = useCallback((event) => {
    setNameInput(event.target.value);
    setInputError('');
  }, []);

  const handleNameInputBlur = useCallback((event) => {
    setNameInput(formatName(event.target.value));
  }, []);

  const handleDisplayNameInputChange = useCallback((event) => {
    setDisplayNameInput(event.target.value);
    setInputError('');
  }, []);

  const handleDescriptionInputChange = useCallback((event) => {
    setDescriptionInput(event.target.value);
  }, []);

  // Form submission handlers
  const handleSubmit = useCallback(async () => {
    if (!categoryInput.trim() || !nameInput.trim() || !displayNameInput.trim()) {
      setInputError('Please fill in all fields');
      return;
    }

    if (categoryInput.trim().toLowerCase() === 'admin') {
      setInputError('The category "admin" is reserved and cannot be used.');
      return;
    }

    if (editingAssistant) {
      if (nameInput.trim() !== editingAssistant.name) {
        setInputError('Assistant name cannot be changed after creation');
        return;
      }
      await onUpdateAssistant({
        id: editingAssistant.id,
        name: nameInput.trim(),
        displayName: displayNameInput.trim(),
        description: descriptionInput.trim(),
        category: categoryInput.trim(),
        isPublic: isPublicInput,
        isNavRoute: isNavRouteInput,
        isDeleteSmartNoteEnabled: isDeleteSmartNoteEnabledInput,
        isHiddenFromSettings: isHiddenFromSettingsInput
      });
    } else {
      // Check for duplicates
      const existingAssistant = assistants.find(assistant =>
        assistant.name.toLowerCase() === nameInput.trim().toLowerCase()
      );

      if (existingAssistant) {
        setInputError('An assistant with this name already exists');
        return;
      }

      await onAddAssistant({
        name: nameInput.trim(),
        displayName: displayNameInput.trim(),
        description: descriptionInput.trim(),
        category: categoryInput.trim(),
        isPublic: isPublicInput,
        isNavRoute: isNavRouteInput,
        isDeleteSmartNoteEnabled: isDeleteSmartNoteEnabledInput,
        isHiddenFromSettings: isHiddenFromSettingsInput
      });
    }
  }, [categoryInput, nameInput, displayNameInput, descriptionInput, isPublicInput, isNavRouteInput, isDeleteSmartNoteEnabledInput, isHiddenFromSettingsInput, editingAssistant, assistants, onAddAssistant, onUpdateAssistant]);

  const handleClear = useCallback(() => {
    setCategoryInput('');
    setNameInput('');
    setDisplayNameInput('');
    setDescriptionInput('');
    setIsPublicInput(false);
    setIsNavRouteInput(false);
    setIsDeleteSmartNoteEnabledInput(true);
    setIsHiddenFromSettingsInput(false);
    setBulkNuidInput('');
    setInputError('');
    onClearInputs();
  }, [onClearInputs]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);


  const handleBulkAssignUsers = useCallback(async () => {
    if (!bulkNuidInput.trim()) return;

    const result = await onBulkAssignUsers(bulkNuidInput);
    if (result.success) {
      setBulkNuidInput('');
    }
  }, [bulkNuidInput, onBulkAssignUsers]);

  const handleExportAssignedUsers = useCallback(() => {
    if (!assignedUsers || assignedUsers.length === 0) {
      return;
    }

    const escapeCsvValue = (value) => {
      const normalizedValue = String(value ?? '');
      const escapedValue = normalizedValue.replace(/"/g, '""');
      return `"${escapedValue}"`;
    };

    const csvRows = [
      'NUID,Name',
      ...assignedUsers.map((user) => `${escapeCsvValue(user.nuid)},${escapeCsvValue(user.name)}`),
    ];

    const csvContent = csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const assistantName = editingAssistant?.name || 'assistant';

    link.href = url;
    link.setAttribute('download', `${assistantName}-assigned-users.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [assignedUsers, editingAssistant]);

  return (
    <Box sx={{
      width: '50%',
      p: 1.5,
      border: '1px solid',
      borderColor: 'color.slate',
      borderRadius: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'auto'
    }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {editingAssistant ? 'Edit Assistant' : 'Add New Assistant'}
      </Typography>

      {/* Form Fields */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>
        <TextField
          variant="outlined"
          label="Category"
          placeholder="Enter assistant category (e.g., AI Tools, Utilities)"
          value={categoryInput}
          onChange={handleCategoryInputChange}
          onKeyDown={handleKeyDown}
          disabled={loading}
          size="small"
        />
        <TextField
          variant="outlined"
          label="Assistant Name"
          placeholder="Enter unique assistant name"
          value={nameInput}
          onChange={handleNameInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleNameInputBlur}
          disabled={loading || editingAssistant}
          helperText={editingAssistant ? "Assistant name cannot be changed" : "Name will be auto-formatted to lowercase with dashes, e.g., 'my-assistant-name'"}
          size="small"
        />
        <TextField
          variant="outlined"
          label="Display Name"
          placeholder="Enter display name for the assistant"
          value={displayNameInput}
          onChange={handleDisplayNameInputChange}
          onKeyDown={handleKeyDown}
          disabled={loading}
          size="small"
        />
        <TextField
          variant="outlined"
          label="Assistant Description"
          placeholder="Enter a description shown on the assistant's landing page"
          value={descriptionInput}
          onChange={handleDescriptionInputChange}
          disabled={loading}
          size="small"
          multiline
          minRows={2}
          maxRows={4}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={isPublicInput}
              onChange={(e) => setIsPublicInput(e.target.checked)}
              disabled={loading}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Make this assistant public
              <Tooltip title="This will enable the assistant to be used by every team member even if it is not explicitly assigned to them. (default: disabled)">
                <InfoOutlinedIcon fontSize="small" color="primary" />
              </Tooltip>
            </Box>
          }
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={isNavRouteInput}
              onChange={(e) => setIsNavRouteInput(e.target.checked)}
              disabled={loading}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Prevent auto-navigation
              <Tooltip title="This will prevent the assistant from being remembered in the user's local storage as their last selected assistant. It will no longer be loaded automatically when the user loads the home page. This should be enabled when an assistant uses a custom UI that does not display the left navigation. (default: disabled)">
                <InfoOutlinedIcon fontSize="small" color="primary" />
              </Tooltip>
            </Box>
          }
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={isDeleteSmartNoteEnabledInput}
              onChange={(e) => setIsDeleteSmartNoteEnabledInput(e.target.checked)}
              disabled={loading}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Allow smartnotes to be deleted
              <Tooltip title="If this assistant uses SmartNotes, checking this box will allow permanent deletion of a SmartNote and all of it's related data, including conversational history. Uncheck this if you do not want your users to be allowed to permanently delete data. (default: enabled)">
                <InfoOutlinedIcon fontSize="small" color="primary" />
              </Tooltip>
            </Box>
          }
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={isHiddenFromSettingsInput}
              onChange={(e) => setIsHiddenFromSettingsInput(e.target.checked)}
              disabled={loading}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Hide from assistant settings
              <Tooltip title="When checked, this assistant will not appear on assistant settings pages and cannot be managed via the settings UI. (default: disabled)">
                <InfoOutlinedIcon fontSize="small" color="primary" />
              </Tooltip>
            </Box>
          }
        />

        {inputError && (
          <Typography color="error" variant="body2">
            {inputError}
          </Typography>
        )}

        <Stack direction="row" spacing={1}>
          {editingAssistant ? (
            <>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={loading}
                size="small"
                sx={{ minWidth: '100px' }}
              >
                Update
              </Button>
              <Button
                variant="secondary"
                onClick={handleClear}
                disabled={loading}
                size="small"
                sx={{ minWidth: '100px' }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={loading}
                size="small"
                sx={{ minWidth: '100px' }}
              >
                Add
              </Button>
              <Button
                variant="action"
                onClick={handleClear}
                disabled={loading}
                size="small"
                sx={{ minWidth: '100px' }}
              >
                Clear
              </Button>
            </>
          )}
        </Stack>
      </Box>

      {/* Assigned Users Section */}
      {editingAssistant && (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          minHeight: 0,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}>
          <Typography variant="h6" sx={{ my: 1.5 }}>
            Assigned Members ({assignedUsers?.length || 0})
          </Typography>

          {/* Bulk Assignment Input */}
          <Box sx={{ mb: 1.5, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            <TextField
              multiline
              maxRows={3}
              variant="outlined"
              label="Bulk Assign NUIDs"
              placeholder="Enter NUIDs separated by commas, spaces, or new lines"
              value={bulkNuidInput}
              onChange={(e) => setBulkNuidInput(e.target.value.toUpperCase())}
              disabled={bulkAssignLoading}
              size="small"
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="primary"
                size="small"
                onClick={handleBulkAssignUsers}
                disabled={!bulkNuidInput.trim() || bulkAssignLoading}
                sx={{ minWidth: '120px' }}
              >
                {bulkAssignLoading ? (
                  <CircularProgress size={16} />
                ) : (
                  'Assign Users'
                )}
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => setBulkNuidInput('')}
                disabled={bulkAssignLoading}
              >
                Clear
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={handleExportAssignedUsers}
                disabled={!assignedUsers || assignedUsers.length === 0}
                endIcon={<DownloadIcon fontSize="small" />}
                sx={{ ml: 'auto' }}
              >
                Download User List
              </Button>
            </Box>
          </Box>

          {loadingUsers ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : !assignedUsers || assignedUsers.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              No users assigned to this assistant.
            </Typography>
          ) : (
            <Box sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              flexGrow: 1,
              minHeight: '200px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {/* Import and use AssignedUsersList component */}
                <AssignedUsersList
                  assignedUsers={assignedUsers}
                  onRemoveUser={onRemoveUserFromAssistant}
                />
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default React.memo(AssistantFormSection);