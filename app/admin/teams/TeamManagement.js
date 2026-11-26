'use client';

import React from 'react';
import { addTeam, deleteTeam, getAllTeams, updateTeam } from '@/app/clientServices/teamService';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, ListItem, ListItemText, TextField, Typography, Paper, List, IconButton, Divider, CircularProgress, ListItemIcon, Select, MenuItem, FormControl, InputLabel, Tooltip, Accordion, AccordionSummary, AccordionDetails, Checkbox } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useEffect, useState, useCallback } from "react";
import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import useSnackbar from '@/app/hooks/useSnackbar';
import { formatName } from '@/utils/formatting';
import { getUserNames } from '@/app/clientServices/userService';
import { PERMISSION_METADATA, getPermissionCategories, getPermissionsByCategory } from '@/app/config/permissions';
import Link from 'next/link';

const sortTeams = (teams) => {
  return [...teams].sort((a, b) => {
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
};

const TeamManagement = () => {
  const [applicationTeams, setApplicationTeams] = useState([]);
  const [teamFilter, setTeamFilter] = useState('');
  const [debouncedTeamFilter, setDebouncedTeamFilter] = useState('');
  const [selectedTeam, setSelectedTeam] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamDisplayName, setTeamDisplayName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [teamOwners, setTeamOwners] = useState([]);
  const [nuidInput, setNuidInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [teamIconUrl, setTeamIconUrl] = useState("");
  const [teamSize, setTeamSize] = useState(1000);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [loadingTeamList, setLoadingTeamList] = useState(false);
  const [loadingOwnerList, setLoadingOwnerList] = useState(false);
  const [enabledPermissions, setEnabledPermissions] = useState([]);

  // Use the custom snackbar hook
  const { SnackbarComponent, showSnackbar } = useSnackbar();

  // Get current user session
  const { user } = useAuth();

  // Check if current user is an owner of a team
  const isCurrentUserOwner = useCallback((team) => {
    if (!user?.nuid) return false;
    return team.owners && team.owners.some(owner => owner.nuid === user.nuid);
  }, [user?.nuid]);

  useEffect(() => {
    const handleGetAllTeams = async () => {
      setLoadingTeamList(true);
      let teams = await getAllTeams();
      setLoadingTeamList(false);
      setApplicationTeams(sortTeams(teams));
    }

    handleGetAllTeams();
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedTeamFilter(teamFilter.trim().toLowerCase());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [teamFilter]);

  const filteredTeams = applicationTeams.filter((team) => (
    (team.name || '').toLowerCase().includes(debouncedTeamFilter)
    || (team.displayName || '').toLowerCase().includes(debouncedTeamFilter)
  ));

  // Handle team name blur formatting
  const handleTeamNameBlur = useCallback(() => {
    const formattedName = formatName(teamName);
    if (formattedName !== teamName) {
      setTeamName(formattedName);
    }
  }, [teamName]);

  // Handle NUID input functions
  const handleNuidInputChange = (event) => {
    setNuidInput(event.target.value?.toUpperCase());
    setInputError('');
  };

  const handleAddUsers = async () => {
    if (!nuidInput.trim()) {
      setInputError('Please enter at least one NUID');
      return;
    }

    // Split by comma and trim whitespace
    const nuidsToAdd = nuidInput.split(',').map(nuid => nuid.trim());

    // Validate NUIDs or emails (basic validation)
    const invalidNuids = nuidsToAdd.filter(nuid => !nuid.match(/^[a-zA-Z]\d{6}$|^[^\s@]+@[^\s@]+\.[^\s@]+$/));

    if (invalidNuids.length > 0) {
      setInputError(`Invalid NUID or email format: ${invalidNuids.join(', ')}. Expected format: Any letter followed by 6 digits or a valid email address.`);
      return;
    }

    // Check for duplicates
    const existingNuids = teamOwners.map(owner => owner.nuid);
    const duplicateNuids = nuidsToAdd.filter(nuid => existingNuids.includes(nuid));

    if (duplicateNuids.length > 0) {
      setInputError(`These NUIDs are already added: ${duplicateNuids.join(', ')}`);
      return;
    }

    const newUsers = nuidsToAdd.map(nuid => ({
      nuid,
      name: 'Unknown'
    }));

    const userSet = [...teamOwners, ...newUsers];
    setTeamOwners(userSet);
    setNuidInput('');

    try {
      const users = await getUserNames(nuidsToAdd);
      const updatedUsers = userSet.map(user => {
        const foundUser = users.find(u => u.nuid === user.nuid);
        return foundUser ? { ...user, name: foundUser.name } : user;
      });
      setTeamOwners(updatedUsers);
    } catch (error) {
      // If getUserNames fails, keep the users with 'Unknown' names
      console.warn('Failed to fetch user names:', error);
    }
  };

  const handleRemoveUser = (nuidToRemove) => {
    setTeamOwners(teamOwners.filter(owner => owner.nuid !== nuidToRemove));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddUsers();
    }
  };

  const handleTeamClick = async (team) => {
    setSelectedTeam(team);
    setTeamName(team.name);
    setTeamDisplayName(team.displayName);
    setTeamDescription(team.description || "");
    setTeamIconUrl(team.iconUrl || "");
    setTeamSize(team.size || 1000);
    setTeamOwners([]);
    setInputError('');
    setLoadingOwnerList(true);
    setEnabledPermissions(team.authorization?.enabledPermissions || []);

    // Handle team owners
    if (team.owners && team.owners.length > 0) {
      try {
        const userDetails = await getUserNames(team.owners.map(to => to.nuid));
        setTeamOwners(userDetails.map(user => ({ nuid: user.nuid, name: user.name })));
      } catch (error) {
        // If getUserNames fails, just use the NUIDs without names
        setTeamOwners(team.owners.map(nuid => ({ nuid: nuid, name: 'Unknown' })));
      }
    } else {
      setTeamOwners([]);
    }
    setLoadingOwnerList(false);
  }

  const handleAddNewTeam = async () => {
    if (!teamName || !teamDisplayName) {
      showSnackbar("Team name and display name are required", "error");
      return;
    }

    // Validate team name doesn't start with a number
    if (/^\d/.test(teamName)) {
      showSnackbar("Team name cannot start with a number", "error");
      return;
    }

    // teamOwners must have at least one owner
    if (teamOwners.length === 0) {
      setInputError("A team must have at least one owner");
      showSnackbar("A team must have at least one owner", "error");
      return;
    }

    const newTeam = {
      name: teamName,
      displayName: teamDisplayName,
      description: teamDescription,
      size: teamSize,
      owners: teamOwners.map(owner => owner.nuid),
      iconUrl: teamIconUrl,
      createdBy: "current-user" // TODO: Get actual user from session
    };

    try {
      const response = await addTeam(newTeam);
      if (response && !response.error) {
        setApplicationTeams(sortTeams([...applicationTeams, { ...response }]));
        showSnackbar("Team added successfully", "success");
        clearForm();
      } else {
        if (response.error === "Team already exists") {
          showSnackbar("A team with that name already exists", "error");
        } else {
          showSnackbar("Failed to add team", "error");
        }
      }
    } catch (error) {
      showSnackbar("Error adding team", "error");
    }
  }

  const handleEditTeam = async () => {
    if (!teamName || !teamDisplayName) {
      showSnackbar("Team name and display name are required", "error");
      return;
    }

    if (teamName !== selectedTeam.name) {
      showSnackbar("A team name cannot be changed after it's created", "error");
      return;
    }

    // Validate team name doesn't start with a number
    if (/^\d/.test(teamName)) {
      showSnackbar("Team name cannot start with a number", "error");
      return;
    }

    const updatedTeam = {
      id: selectedTeam.id,
      name: teamName,
      displayName: teamDisplayName,
      description: teamDescription,
      size: teamSize,
      owners: teamOwners.map(owner => owner.nuid),
      iconUrl: teamIconUrl,
      authorization: {
        ...(selectedTeam.authorization || {}),
        enabledPermissions,
      },
    };

    try {
      const response = await updateTeam(updatedTeam);
      if (response && !response.error) {
        const updatedTeams = applicationTeams.map(team =>
          team.id === selectedTeam.id ? { ...team, ...response } : team
        );
        setApplicationTeams(sortTeams(updatedTeams));
        showSnackbar("Team updated successfully", "success");
        clearForm();
      } else {
        showSnackbar("Failed to update team", "error");
      }
    } catch (error) {
      showSnackbar("Error updating team", "error");
    }
  }

  const handleDeleteTeam = async () => {
    try {
      const response = await deleteTeam(selectedTeam);
      setDeleteConfirmationOpen(false);
      if (response && !response.error) {
        setApplicationTeams(applicationTeams.filter(team => team.id !== selectedTeam.id));
        showSnackbar("Team deleted successfully", "success");
        clearForm();
      } else if (response.error) {
        showSnackbar("Failed to delete team: " + response.error, "error");
      }

    } catch (error) {
      showSnackbar("Error deleting team", "error");
    }
  }

  const clearForm = () => {
    setSelectedTeam("");
    setTeamName("");
    setTeamDisplayName("");
    setTeamDescription("");
    setTeamSize(1000);
    setTeamOwners([]);
    setNuidInput('');
    setInputError('');
    setTeamIconUrl("");
    setEnabledPermissions([]);
  }

  const openDeleteConfirmation = () => {
    setDeleteConfirmationOpen(true);
  }

  const closeDeleteConfirmation = () => {
    setDeleteConfirmationOpen(false);
  }

  return (
    <Box sx={{
      display: 'flex',
      height: '100%',
      minHeight: 0,
      gap: 2,
      p: 3,
      maxHeight: '100%'
    }}>
      {/* Team List */}
      <Box sx={{
        width: '50%',
        border: '1px solid',
        borderColor: 'color.slate',
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'color.slate', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <Typography variant="h6" sx={{ flexShrink: 0 }}>
            Teams
          </Typography>
          <TextField
            label="Filter teams"
            size="small"
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
            sx={{ ml: 'auto', width: 280, maxWidth: '100%', minWidth: 0 }}
          />
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {loadingTeamList && applicationTeams.length <= 0 && (
            <Box sx={{ pt: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={48} />
            </Box>
          )}
          {!loadingTeamList && filteredTeams.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {debouncedTeamFilter ? 'No matching teams.' : 'No teams available.'}
            </Typography>
          )}
          {filteredTeams.map((team) => (
            <ListItem
              key={team.id}
              button="true"
              onClick={() => handleTeamClick(team)}
              selected={selectedTeam.id === team.id}
              sx={{ cursor: 'pointer' }}
            >
              <ListItemText
                primary={team.displayName}
                secondary={team.name}
              />
              {isCurrentUserOwner(team) && (
                <ListItemIcon sx={{ minWidth: 'auto', ml: 1 }}>
                  <Link
                    href={`/${team.name}/admin`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      textDecoration: 'none'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Admin Panel
                    {/* <IconButton
                      size="small"
                      sx={{
                        color: 'primary.main',
                        '&:hover': {
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText'
                      }
                    }}
                    title={`Admin Panel for ${team.displayName}`}
                  >
                    <AdminPanelSettingsIcon fontSize="small" />
                  </IconButton> */}
                  </Link>
                </ListItemIcon>
              )}
            </ListItem>
          ))}
        </Box>
      </Box>

      {/* Team Form */}
      <Box sx={{
        width: '50%',
        border: '1px solid',
        borderColor: 'color.slate',
        borderRadius: 1,
        p: 2,
        overflow: 'auto'
      }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {selectedTeam ? 'Edit Team' : 'Add New Team'}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Team Name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            onBlur={handleTeamNameBlur}
            fullWidth
            disabled={selectedTeam !== ""}
            helperText={selectedTeam ? "Team name cannot be changed after creation" : "Lowercase letters, numbers, and hyphens only. Cannot start with a number."}
          />

          <TextField
            label="Display Name"
            value={teamDisplayName}
            onChange={(e) => setTeamDisplayName(e.target.value)}
            fullWidth
          />

          <TextField
            label="Description"
            value={teamDescription}
            onChange={(e) => setTeamDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            maxRows={5}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1">Team Size</Typography>
            <Tooltip
              title={
                <Box sx={{ whiteSpace: 'pre-line' }}>
                  <Typography variant="body2" sx={{ display: 'block' }}>Team Size will determine the database throughput your team needs. This can be changed at any time.</Typography>
                  <Typography variant="body2" sx={{ display: 'block' }} style={{ marginTop: '8px' }}>Recommendations:</Typography>
                  <Typography variant="body2" sx={{ display: 'block' }}>1-50 users: Default (1000 RU/s)</Typography>
                  <Typography variant="body2" sx={{ display: 'block' }}>51-200 users: Small (2000 RU/s)</Typography>
                  <Typography variant="body2" sx={{ display: 'block' }}>201-500 users: Medium (4000 RU/s)</Typography>
                  <Typography variant="body2" sx={{ display: 'block' }}>501-1000 users: Large (8000 RU/s)</Typography>
                  <Typography variant="body2" sx={{ display: 'block' }}>1000+ users: Extra Large (10000 RU/s)</Typography>
                </Box>
              }
            >
              <InfoOutlinedIcon sx={{ color: 'primary.main', cursor: 'pointer', alignSelf: 'flex-start' }} />
            </Tooltip>
          </Box>
          <FormControl fullWidth>
            <InputLabel id="team-size-label">Team Size</InputLabel>
            <Select
              labelId="team-size-label"
              id="team-size-select"
              value={teamSize}
              label="Team Size"
              onChange={(e) => setTeamSize(e.target.value)}
            >
              <MenuItem value={1000}>Default (1-50 users)</MenuItem>
              <MenuItem value={2000}>Small (51-200 users)</MenuItem>
              <MenuItem value={4000}>Medium (201-500 users)</MenuItem>
              <MenuItem value={8000}>Large (501-1000 users)</MenuItem>
              <MenuItem value={10000}>Extra Large (1000+ users)</MenuItem>
            </Select>
          </FormControl>

          {/* Team Owners Section */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Team Owners
              </Typography>
              <Tooltip
                title={
                  <Box sx={{ whiteSpace: 'pre-line' }}>
                    <Typography variant="body2">Team owners have full control over the team settings and members. Each team must have at least one owner.</Typography>
                  </Box>
                }
              >
                <InfoOutlinedIcon sx={{ color: 'primary.main', cursor: 'pointer', alignSelf: 'flex-start' }} />
              </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', mb: 2, gap: 2, flexWrap: 'wrap' }}>
              <TextField
                sx={{ flexGrow: 1 }}
                variant="outlined"
                placeholder="Enter NUIDs or emails separated by commas (e.g., NUIDs: N123456, A876543, Emails: user@example.com)"
                value={nuidInput}
                onChange={handleNuidInputChange}
                onKeyDown={handleKeyDown}
                error={!!inputError}
                helperText={inputError}
              />
              <Button
                variant="action"
                size="large"
                onClick={handleAddUsers}
              >
                Add Owners
              </Button>
            </Box>
            {loadingOwnerList && teamOwners.length <= 0 && (
              <Paper variant="outlined" sx={{ height: '200px', p: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                <CircularProgress size={32} />
              </Paper>
            )}
            {teamOwners.length > 0 && (
              <Paper variant="outlined" sx={{ maxHeight: '200px', overflow: 'auto', borderRadius: '8px' }}>
                <List dense>
                  {teamOwners.map((owner, index) => (
                    <React.Fragment key={owner.nuid}>
                      <ListItem
                        secondaryAction={
                          <IconButton
                            edge="end"
                            aria-label="remove"
                            onClick={() => handleRemoveUser(owner.nuid)}
                            sx={{
                              color: 'error.dark',
                              '&:hover': { color: 'error.main' }
                            }}
                            size="small"
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={owner.nuid}
                          secondary={owner.name}
                        />
                      </ListItem>
                      {index < teamOwners.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            )}
          </Box>

          <TextField
            label="Icon URL"
            value={teamIconUrl}
            onChange={(e) => setTeamIconUrl(e.target.value)}
            fullWidth
            helperText="Optional: URL to team icon/logo"
          />

          {/* Enabled Permissions Section */}
          {selectedTeam && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Enabled Permissions</Typography>
                  <Tooltip title="Select which permissions are relevant for this team. Only enabled permissions will be available for role template assignment.">
                    <InfoOutlinedIcon sx={{ color: 'primary.main', cursor: 'pointer', fontSize: '1.2rem' }} />
                  </Tooltip>
                  {enabledPermissions.length > 0 && (
                    <Typography variant="caption" color="text.secondary">({enabledPermissions.length} selected)</Typography>
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {getPermissionCategories().map(category => (
                  <Box key={category} sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
                      {category}
                    </Typography>
                    <List dense disablePadding>
                      {getPermissionsByCategory(category).map(perm => (
                        <ListItem
                          key={perm.key}
                          dense
                          onClick={() => {
                            setEnabledPermissions(prev =>
                              prev.includes(perm.key) ? prev.filter(p => p !== perm.key) : [...prev, perm.key]
                            );
                          }}
                          sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1, py: 0 }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Checkbox edge="start" checked={enabledPermissions.includes(perm.key)} size="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={perm.label}
                            secondary={perm.key}
                            primaryTypographyProps={{ fontSize: '0.85rem' }}
                            secondaryTypographyProps={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
            {selectedTeam ? (
              <>
                <Button
                  variant="primary"
                  onClick={handleEditTeam}
                >
                  Update Team
                </Button>
                <Button
                  variant="destructive"
                  onClick={openDeleteConfirmation}
                >
                  Delete Team
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                onClick={handleAddNewTeam}
              >
                Add Team
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={clearForm}
            >
              Clear
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmationOpen}
        onClose={closeDeleteConfirmation}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete the team "{selectedTeam.displayName}"?
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={closeDeleteConfirmation}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteTeam} autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <SnackbarComponent />
    </Box>
  );
}

export default TeamManagement;
