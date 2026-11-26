'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  TextField,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  List,
  ListItem,
  ListItemText,
  Divider,
  Paper,
  Button,
  Skeleton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PropTypes from 'prop-types';
import { useUserAssistants } from '@/reducers/UserAssistantContext';
import { upsertSmartNoteTemplate, getSmartNoteTemplate } from '@/app/clientServices/smartNoteTemplateService';
import { getUserNames } from '@/app/clientServices/userService';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { updateSmartNote } from '@/app/clientServices/smartNoteService';
import { useParams } from 'next/navigation';

const ShareSmartNoteDialog = ({ open, onClose }) => {
  const [shareOption, setShareOption] = useState('none');
  const [nuidInput, setNuidInput] = useState('');
  const [sharedUsers, setSharedUsers] = useState([]);
  const [inputError, setInputError] = useState('');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const { selectedUserAssistant } = useUserAssistants();
  const { teamName, assistantName, id: smartNoteId } = useParams();

  // Fetch existing shared users when the dialog opens or smartNoteId changes
  useEffect(() => {
    if (open && smartNoteId) {
      getTemplateDetails(smartNoteId);
    }
  }, [open, smartNoteId]);

  const getTemplateDetails = async (id) => {
    setIsLoadingDetails(true);
    const templateDetails = await getSmartNoteTemplate(teamName, assistantName, id);

    if (templateDetails?.sharedWith) {
      const userDetails = await getUserNames(templateDetails.sharedWith);
      setSharedUsers(userDetails.map(user => ({ nuid: user.nuid, name: user.name })));
    } else {
      const sharedWith = templateDetails?.sharedWith || [];
      setSharedUsers(sharedWith.map(nuid => ({ nuid: nuid, name: `Unknown` })));
    }

    setShareOption(templateDetails?.shared || 'none');
    setIsLoadingDetails(false);
  };

  const handleShareOptionChange = (event) => {
    setShareOption(event.target.value);
  };

  const handleNuidInputChange = (event) => {
    setNuidInput(event.target.value.toUpperCase());
    setInputError('');
  };

  const handleAddUsers = () => {
    if (!nuidInput.trim()) {
      setInputError('Please enter at least one NUID');
      return;
    }

    // Split by comma and trim whitespace
    const nuidsToAdd = nuidInput.split(',').map(nuid => nuid.trim());

    // Validate NUIDs (basic validation)
    const invalidNuids = nuidsToAdd.filter(nuid => !nuid.match(/^[a-zA-Z]\d{6}$|^[^\s@]+@[^\s@]+\.[^\s@]+$/));

    if (invalidNuids.length > 0) {
      setInputError(`Invalid NUID format: ${invalidNuids.join(', ')}. Expected format: Any letter followed by 6 digits or a valid email address.`);
      return;
    }

    const newUsers = nuidsToAdd.map(nuid => ({
      nuid,
      name: `Unknown`
    }));

    const userSet = [...sharedUsers, ...newUsers];
    setSharedUsers(userSet);
    setNuidInput('');

    getUserNames(nuidsToAdd).then(users => {
      const updatedUsers = userSet.map(user => {
        const foundUser = users.find(u => u.nuid === user.nuid);
        return foundUser ? { ...user, name: foundUser.name } : user;
      });
      setSharedUsers(updatedUsers);
    });
  };

  const handleRemoveUser = (nuidToRemove) => {
    setSharedUsers(sharedUsers.filter(user => user.nuid !== nuidToRemove));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddUsers();
    }
  };

  const handleConfirmChanges = async () => {
    // upsert a smart note template with the selected share option and shared users
    const templateData = prepDocument({
      type: 'SmartNoteTemplate',
      shared: shareOption,
      sharedWith: sharedUsers.length > 0 ? sharedUsers.map(user => user.nuid) : null,
    });

    const template = await upsertSmartNoteTemplate(teamName, assistantName, smartNoteId, templateData);
    await updateSmartNote(teamName, assistantName, smartNoteId, { templateId: template.id });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          backgroundColor: 'background.dialog'
        }
      }}
    >
      <DialogTitle sx={{ padding: 3, borderBottom: '1px solid #eaeaea' }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Create a Smart Note Template
          </Typography>
          <IconButton
            edge="end"
            color="inherit"
            onClick={onClose}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          Creating a Smart Note template will allow other users to create their own Smart Note with the Sources you've curated. Everything but the conversation history will be shared. Updates you make to this Smart Note will reflect in the template, but not in Smart Notes already created from it.
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ padding: 3 }}>
        <Box sx={{ my: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
            Manage Access: Who can use this Smart Note Template
          </Typography>

          {isLoadingDetails ? (
            <Skeleton variant="rounded" width="100%" height={200} />
          ) : (
            <>
              <FormControl component="fieldset" sx={{ mb: 3 }}>
                <RadioGroup
                  name="share-option"
                  value={shareOption}
                  onChange={handleShareOptionChange}
                >
                  <FormControlLabel
                    value="none"
                    control={<Radio color="primary" />}
                    label={<ListItemText
                      primary={"Disable Sharing"}
                      secondary={"Default option, no template will be shared"}
                    />}
                    sx={{ mb: 1 }}
                  />
                  <FormControlLabel
                    value="assistant"
                    control={<Radio color="primary" />}
                    label={<ListItemText
                      primary={"Share with assistant"}
                      secondary={`Anyone with access to ${selectedUserAssistant.name} can use this Smart Note as a template`}
                    />}
                    sx={{ mb: 1 }}
                  />
                  <FormControlLabel
                    value="individuals"
                    control={<Radio color="primary" />}
                    label={<ListItemText
                      primary={"Share with individuals"}
                      secondary={"Specify users who can use this Smart Note as a template"}
                    />}
                  />
                </RadioGroup>
              </FormControl>

              {shareOption === 'individuals' && (
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Add people by NUID
                  </Typography>

                  <Box sx={{ display: 'flex', mb: 2, gap: 2 }}>
                    <TextField
                      sx={{ flexGrow: 1 }}
                      variant="outlined"
                      placeholder="Enter NUIDs separated by commas (e.g., N123456, A876543)"
                      value={nuidInput}
                      onChange={handleNuidInputChange}
                      onKeyDown={handleKeyDown}
                      error={!!inputError}
                      helperText={inputError}
                      size={'small'}
                    />
                    <Button
                      variant="action"
                      onClick={handleAddUsers}
                    >
                      Add Users
                    </Button>
                  </Box>

                  <Typography variant="subtitle1" sx={{ mb: 1, mt: 3 }}>
                    People with access
                  </Typography>

                  <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto', borderRadius: '8px' }}>
                    {sharedUsers.length > 0 ? (
                      <List>
                        {sharedUsers.map((user, index) => (
                          <React.Fragment key={user.nuid}>
                            <ListItem
                              secondaryAction={
                                <IconButton
                                  edge="end"
                                  aria-label="remove"
                                  onClick={() => handleRemoveUser(user.nuid)}
                                  sx={{
                                    color: 'error.dark',
                                    '&:hover': { color: 'error.main' }
                                  }}
                                >
                                  <CloseIcon />
                                </IconButton>
                              }
                            >
                              <ListItemText
                                primary={user.nuid}
                                secondary={user.name}
                              />
                            </ListItem>
                            {index < sharedUsers.length - 1 && <Divider />}
                          </React.Fragment>
                        ))}
                      </List>
                    ) : (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          No users have been added yet
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </Box>
              )}
            </>
          )}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          <Button
            variant='secondary'
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmChanges}
            disabled={isLoadingDetails}
          >
            Confirm Changes
          </Button>
        </Box>
      </DialogContent>
    </Dialog >
  );
};

ShareSmartNoteDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

export default ShareSmartNoteDialog;
