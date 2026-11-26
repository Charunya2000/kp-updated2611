'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  ListItem,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch
} from "@mui/material";
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon
} from "@mui/icons-material";
import useSnackbar from '@/app/hooks/useSnackbar';
import { getAllMessages, createMessage, updateMessage, deleteMessage } from '@/app/clientServices/applicationMessaging';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const MESSAGE_TYPES = {
  INFO: { label: 'Info', color: 'info', icon: <InfoIcon /> },
  WARNING: { label: 'Warning', color: 'warning', icon: <WarningIcon /> },
  ERROR: { label: 'Error', color: 'error', icon: <ErrorIcon /> },
  SUCCESS: { label: 'Success', color: 'success', icon: <SuccessIcon /> }
};

const sortByCreatedDate = (messages) => {
  return [...messages].sort((a, b) => {
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
};

const getMessageStatus = (message) => {
  const now = new Date();
  const startDate = message.startDate ? new Date(message.startDate) : null;
  const endDate = message.endDate ? new Date(message.endDate) : null;

  if (startDate && now < startDate) {
    return { label: 'Inactive', color: 'default' };
  }
  if (endDate && now > endDate) {
    return { label: 'Expired', color: 'error' };
  }
  if (startDate && endDate && now >= startDate && now <= endDate) {
    return { label: 'Active', color: 'success' };
  }
  if (startDate && !endDate && now >= startDate) {
    return { label: 'Active', color: 'success' };
  }
  if (!startDate && !endDate) {
    return { label: 'Active', color: 'success' };
  }
  return { label: 'Inactive', color: 'default' };
};

const ApplicationMessaging = ({ }) => {
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Form state
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('INFO');
  const [isEnabled, setIsEnabled] = useState(true);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const { SnackbarComponent, showSnackbar } = useSnackbar();

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await getAllMessages();
        if (response && response.messages) {
          setMessages(sortByCreatedDate(response.messages));
        } else if (response && response.error) {
          console.error('Error from API:', response.error);
          showSnackbar(`Failed to load messages: ${response.error}`, 'error');
        } else {
          console.log('No messages or empty response');
          setMessages([]);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        showSnackbar('Failed to load messages', 'error');
      }
    };

    fetchMessages();
  }, [showSnackbar]);

  // Handle message selection
  const handleMessageClick = (message) => {
    setSelectedMessage(message);
    setMessageText(message.text || '');
    setMessageType(message.messageType || 'INFO');
    setIsEnabled(message.isEnabled);
    setStartDate(new Date(message.startDate) || new Date());
    setEndDate(new Date(message.endDate) || new Date());
  };

  // Add new message
  const handleAddMessage = async () => {
    if (!messageText.trim()) {
      showSnackbar('Message text is required', 'error');
      return;
    }

    const now = new Date();
    const start = startDate;
    const end = endDate;

    let messageStatus = 'Active';
    if (start && now < start) {
      messageStatus = 'Inactive';
    } else if (end && now > end) {
      messageStatus = 'Expired';
    }

    const newMessage = {
      text: messageText,
      messageType,
      isEnabled,
      startDate: startDate,
      endDate: endDate,
      status: messageStatus
    };

    try {
      const response = await createMessage(newMessage);
      if (response && !response.error) {
        const createdMessage = {
          ...newMessage,
          id: response.data.id,
          createdAt: response.data.createdAt || new Date().toISOString()
        };
        setMessages(sortByCreatedDate([...messages, createdMessage]));
        showSnackbar('Message added successfully', 'success');
        clearForm();
      } else {
        showSnackbar(response.error || 'Failed to add message', 'error');
      }
    } catch (error) {
      showSnackbar('Error adding message', 'error');
    }
  };

  // Update existing message
  const handleUpdateMessage = async () => {
    if (!messageText.trim()) {
      showSnackbar('Message text is required', 'error');
      return;
    }

    const now = new Date();
    const start = startDate;
    const end = endDate;

    let messageStatus = 'Active';
    if (start && now < start) {
      messageStatus = 'Inactive';
    } else if (end && now > end) {
      messageStatus = 'Expired';
    }

    const updatedMessage = {
      id: selectedMessage.id,
      text: messageText,
      messageType,
      isEnabled,
      startDate: startDate,
      endDate: endDate,
      status: messageStatus
    };

    try {
      const response = await updateMessage(updatedMessage.id, updatedMessage);
      if (response && !response.error) {
        const updatedMessages = messages.map(msg =>
          msg.id === selectedMessage.id ? { ...msg, ...updatedMessage } : msg
        );
        setMessages(sortByCreatedDate(updatedMessages));
        showSnackbar('Message updated successfully', 'success');
        clearForm();
      } else {
        showSnackbar(response.error || 'Failed to update message', 'error');
      }
    } catch (error) {
      showSnackbar('Error updating message', 'error');
    }
  };

  // Delete message
  const handleDeleteMessage = async () => {
    try {
      const response = await deleteMessage(selectedMessage.id);
      if (response && !response.error) {
        setMessages(messages.filter(msg => msg.id !== selectedMessage.id));
        showSnackbar('Message deleted successfully', 'success');
        clearForm();
        setDeleteConfirmOpen(false);
      } else {
        showSnackbar(response.error || 'Failed to delete message', 'error');
      }
    } catch (error) {
      showSnackbar('Error deleting message', 'error');
    }
  };

  // Clear form
  const clearForm = () => {
    setSelectedMessage(null);
    setMessageText('');
    setMessageType('INFO');
    setIsEnabled(true);
    setStartDate(new Date());
    setEndDate(new Date());
  };

  const openDeleteConfirmation = () => {
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirmation = () => {
    setDeleteConfirmOpen(false);
  };



  return (
    <Box sx={{
      display: 'flex',
      height: '100%',
      gap: 2,
      p: 3,
      maxHeight: 'calc(100vh - 120px)'
    }}>
      {/* Messages List */}
      <Box sx={{
        width: '50%',
        border: '1px solid',
        borderColor: 'color.slate',
        borderRadius: 1,
        overflow: 'auto'
      }}>
        <Typography variant="h6" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'color.slate' }}>
          Application Messages ({messages.length})
        </Typography>
        {messages.map((message) => (
          <ListItem
            key={message.id}
            button="true"
            onClick={() => handleMessageClick(message)}
            selected={selectedMessage && selectedMessage.id === message.id}
            sx={{
              cursor: 'pointer',
              backgroundColor: selectedMessage && selectedMessage.id === message.id
                ? 'action.selected'
                : 'transparent',
              '&:hover': {
                backgroundColor: 'action.hover'
              },
              '&.Mui-selected': {
                backgroundColor: 'action.selected',
                '&:hover': {
                  backgroundColor: 'action.selected'
                }
              }
            }}
          >
            <Box sx={{ width: '100%', py: 1 }}>
              <Typography variant="body1" component="div" sx={{ fontWeight: 500 }}>
                {message.text}
              </Typography>
              <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <Chip
                  label={MESSAGE_TYPES[message.messageType]?.label || message.messageType}
                  color={MESSAGE_TYPES[message.messageType]?.color || 'default'}
                  size="small"
                  icon={MESSAGE_TYPES[message.messageType]?.icon}
                />
                <Chip
                  label={message.isEnabled ? 'Enabled' : 'Disabled'}
                  color={message.isEnabled ? 'success' : 'default'}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={getMessageStatus(message).label}
                  color={getMessageStatus(message).color}
                  size="small"
                  variant="filled"
                />
              </Box>
              {(message.startDate || message.endDate) && (
                <Box sx={{ mt: 0.5 }}>
                  {message.startDate && (
                    <Typography variant="caption" color="text.secondary" component="div">
                      Start: {new Date(message.startDate).toLocaleDateString()}
                    </Typography>
                  )}
                  {message.endDate && (
                    <Typography variant="caption" color="text.secondary" component="div">
                      End: {new Date(message.endDate).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </ListItem>
        ))}
      </Box>

      {/* Message Form */}
      <Box sx={{
        width: '50%',
        border: '1px solid',
        borderColor: 'color.slate',
        borderRadius: 1,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {selectedMessage ? 'Edit Message' : 'Add Application Messages'}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
          <TextField
            label="Message Text"
            multiline
            rows={4}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            fullWidth
            required
          />

          <FormControl fullWidth>
            <InputLabel>Severity</InputLabel>
            <Select
              value={messageType}
              label="Severity"
              onChange={(e) => setMessageType(e.target.value)}
            >
              {Object.entries(MESSAGE_TYPES).map(([key, value]) => (
                <MenuItem key={key} value={key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {value.icon}
                    <Typography>{value.label}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
              />
            }
            label="Enabled"
          />

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <DateTimePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                format="MM/dd/yyyy hh:mm a"
              />
              <DateTimePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                format="MM/dd/yyyy hh:mm a"
              />
            </Box>
          </LocalizationProvider>

          <Box sx={{ display: 'flex', gap: 1, mt: 'auto', flexWrap: 'wrap' }}>
            {selectedMessage ? (
              <>
                <Button
                  variant="primary"
                  onClick={handleUpdateMessage}
                >
                  Save Message
                </Button>
                <Button
                  variant="destructive"
                  onClick={openDeleteConfirmation}
                >
                  Delete
                </Button>
                <Button
                  variant="secondary"
                  onClick={clearForm}
                >
                  Clear
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  onClick={handleAddMessage}
                >
                  Save Message
                </Button>
                <Button
                  variant="secondary"
                  onClick={clearForm}
                >
                  Clear
                </Button>
              </>
            )}
          </Box>
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={closeDeleteConfirmation}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this message?
          </Typography>
          {selectedMessage && (
            <Typography sx={{ mt: 2, fontStyle: 'italic' }}>
              "{selectedMessage.text}"
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteConfirmation}>Cancel</Button>
          <Button onClick={handleDeleteMessage} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <SnackbarComponent />
    </Box>
  );
};

export default ApplicationMessaging;
