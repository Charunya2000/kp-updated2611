'use client'

import { getAllAssistants } from '@/app/clientServices/assistantService';
import { getUserAssistants, upsertUserAssistants } from '@/app/clientServices/userAssistantService';
import { getTeamMembers } from '@/app/clientServices/teamMemberService';
import { getUserNames } from '@/app/clientServices/userService';
import {
  Box,
  Button,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  CircularProgress,
  Divider,
  Chip,
  Stack,
  TextField,
  Alert
} from "@mui/material";
import { useEffect, useMemo, useState } from 'react';
import useSnackbar from '@/app/hooks/useSnackbar';

const AssignUserAssistants = ({ teamName, allowedAssistants = null }) => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [allAssistants, setAllAssistants] = useState([]);
  const [userAssistants, setUserAssistants] = useState([]);
  const [userAssignedAssistants, setUserAssignedAssistants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assistantsLoading, setAssistantsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const allowedAssistantsSet = useMemo(
    () => (Array.isArray(allowedAssistants) ? new Set(allowedAssistants) : null),
    [allowedAssistants]
  );

  // Use the custom snackbar hook
  const { SnackbarComponent, showSnackbar } = useSnackbar();

  // Fetch team members on component mount
  useEffect(() => {
    fetchTeamMembers();
    fetchAllAssistants();
  }, [teamName, allowedAssistantsSet]);

  // Fetch user assistants when a member is selected
  useEffect(() => {
    if (selectedMember) {
      fetchUserAssistants(selectedMember);
    } else {
      setUserAssistants([]);
      setUserAssignedAssistants([]);
    }
  }, [selectedMember]);

  // Update user assigned assistants when user assistants or all assistants change
  useEffect(() => {
    if (allAssistants.length > 0) {
      updateUserAssignedAssistants();
    }
  }, [userAssistants, allAssistants]);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      const members = await getTeamMembers(teamName);

      if (members.length > 0) {
        const nuids = members.map(member => member.nuid);
        try {
          const userDetails = await getUserNames(nuids);
          const membersWithDetails = members.map(member => {
            const userDetail = userDetails.find(user => user.nuid === member.nuid);
            return {
              ...member,
              name: userDetail ? userDetail.name : 'Unknown',
              email: userDetail ? userDetail.email : null
            };
          });
          setTeamMembers(membersWithDetails.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
          // If getUserNames fails, just use the members without detailed names
          setTeamMembers(members.map(member => ({
            ...member,
            name: member.nuid
          })).sort((a, b) => a.name.localeCompare(b.name)));
        }
      } else {
        setTeamMembers([]);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
      showSnackbar('Failed to load team members', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAssistants = async () => {
    try {
      let assistants = await getAllAssistants(teamName);
      if (assistants) {
        assistants = assistants.map(assistant => ({
          name: assistant.name,
          category: assistant.category,
          displayName: assistant.displayName,
          isPublic: assistant.isPublic || false
        }));

        if (allowedAssistantsSet) {
          assistants = assistants.filter(assistant => allowedAssistantsSet.has(assistant.name));
        }

        // Sort by category, then by name
        assistants.sort((a, b) => {
          const categoryA = a.category?.toLowerCase() || '';
          const categoryB = b.category?.toLowerCase() || '';
          if (categoryA < categoryB) return -1;
          if (categoryA > categoryB) return 1;
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
      }
      setAllAssistants(assistants || []);
    } catch (error) {
      console.error('Error fetching assistants:', error);
      showSnackbar('Failed to load assistants', 'error');
    }
  };

  const fetchUserAssistants = async (nuid) => {
    try {
      setAssistantsLoading(true);
      const result = await getUserAssistants(teamName, nuid);
      const assistants = result.assistants?.map(assistant => ({
        name: assistant.name,
        category: assistant.category,
        displayName: assistant.category ? `${assistant.category} - ${assistant.name}` : assistant.name
      })) || [];
      setUserAssistants(assistants);
    } catch (error) {
      console.error('Error fetching user assistants:', error);
      showSnackbar('Failed to load user assistants', 'error');
      setUserAssistants([]);
    } finally {
      setAssistantsLoading(false);
    }
  };

  const updateUserAssignedAssistants = () => {
    // Separate public and private assistants
    const privateAssistants = allAssistants.filter(assistant => !assistant.isPublic);
    const publicAssistants = allAssistants.filter(assistant => assistant.isPublic);

    // Map private assistants with assignment status
    const privateAssigned = privateAssistants.map(assistant => ({
      ...assistant,
      assigned: userAssistants.some(userAssistant => userAssistant.name === assistant.name),
      isPublic: false
    }));

    // Map public assistants (always assigned and disabled)
    const publicAssigned = publicAssistants.map(assistant => ({
      ...assistant,
      assigned: true,
      isPublic: true
    }));

    setUserAssignedAssistants([...privateAssigned, ...publicAssigned]);
  };

  const handleMemberSelect = (nuid) => {
    setSelectedMember(nuid);
  };

  const handleSearchChange = (event) => {
    setSearchFilter(event.target.value);
  };

  // Filter team members based on search input
  const filteredTeamMembers = teamMembers.filter(member => {
    if (!searchFilter.trim()) return true;

    const searchTerm = searchFilter.toLowerCase().trim();
    const nuid = member.nuid?.toLowerCase() || '';
    const name = member.name?.toLowerCase() || '';
    const email = member.email?.toLowerCase() || '';

    // Split name into potential first and last names
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return nuid.includes(searchTerm) ||
      name.includes(searchTerm) ||
      firstName.includes(searchTerm) ||
      lastName.includes(searchTerm) ||
      email.includes(searchTerm);
  });

  const handleToggle = (assistantName) => {
    // Only allow toggling for private assistants
    setUserAssignedAssistants(prev =>
      prev.map(assistant =>
        assistant.name === assistantName && !assistant.isPublic
          ? { ...assistant, assigned: !assistant.assigned }
          : assistant
      )
    );
  };

  const handleApplyChanges = async () => {
    if (!selectedMember || userAssignedAssistants.length === 0) return;

    try {
      // Only send private assistants for update (exclude public ones)
      const privateAssistants = userAssignedAssistants.filter(assistant => !assistant.isPublic);
      const results = await upsertUserAssistants(teamName, selectedMember, privateAssistants);

      if (results.error) {
        showSnackbar(results.error, "error");
      } else if (results.success === 'false' && results.deleted === 0 && results.inserted === 0) {
        showSnackbar('No changes were made to assistants', "info");
      } else {
        const successMessage = (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant='body1'>Assistants updated successfully</Typography>
            <Typography variant='body2'>Inserted: {results.inserted}, Deleted: {results.deleted}</Typography>
          </Box>
        );
        showSnackbar(successMessage, "success");

        // Refresh user assistants
        fetchUserAssistants(selectedMember);
      }
    } catch (error) {
      console.error('Error updating assistants:', error);
      showSnackbar('Failed to update assistants', 'error');
    }
  };

  // Group assistants by isPublic (first level) and then by category (second level)
  const groupedAssistants = userAssignedAssistants.reduce((acc, assistant) => {
    const publicKey = assistant.isPublic ? 'Shared' : 'Assignable';
    const categoryKey = assistant.category || 'Uncategorized';

    if (!acc[publicKey]) acc[publicKey] = {};
    if (!acc[publicKey][categoryKey]) acc[publicKey][categoryKey] = [];

    acc[publicKey][categoryKey].push(assistant);
    return acc;
  }, {});

  const selectedMemberInfo = teamMembers.find(member => member.nuid === selectedMember);

  return (
    <Box sx={{
      display: 'flex',
      height: '100%',
      p: 2,
      gap: 2
    }}>
      {/* Left Side - Team Member Selection */}
      <Box sx={{
        width: '50%',
        border: '1px solid',
        borderColor: 'color.slate',
        borderRadius: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Team Members</Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by NUID, name, or email..."
            value={searchFilter}
            onChange={handleSearchChange}
            variant="outlined"
            sx={{ mb: 1 }}
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List sx={{
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            flexGrow: 1,
            overflow: 'auto'
          }}>
            {filteredTeamMembers.length > 0 ? (
              filteredTeamMembers.map((member, index) => (
                <Box key={member.nuid}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => handleMemberSelect(member.nuid)}
                      selected={selectedMember === member.nuid}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={member.nuid}
                              size="small"
                              variant="outlined"
                            />
                            <Typography
                              variant="body1"
                            >
                              {member.name}
                            </Typography>
                          </Box>
                        }
                        secondary={member.email && (
                          <Typography
                            variant="body2"
                            sx={{
                              opacity: 0.8
                            }}
                          >
                            {member.email}
                          </Typography>
                        )}
                      />
                    </ListItemButton>
                  </ListItem>
                  {index < filteredTeamMembers.length - 1 && <Divider />}
                </Box>
              ))
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {searchFilter.trim() ? 'No team members found matching your search.' : 'No team members available.'}
                </Typography>
              </Box>
            )}
          </List>
        )}

        {/* Apply Changes Button */}
        {selectedMember && userAssignedAssistants.length > 0 && (
          <Box sx={{ alignSelf: 'flex-end', p: 2, mt: 'auto' }}>
            <Button
              variant="primary"
              onClick={handleApplyChanges}
              disabled={assistantsLoading}
            >
              Apply Assistant Changes
            </Button>
          </Box>
        )}
      </Box>

      {/* Right Side - Assistants Section */}
      <Box sx={{
        flex: 1, minHeight: 0, width: '50%',
        border: '1px solid',
        borderColor: 'color.slate',
        borderRadius: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {selectedMember ? (
          <>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
              <Typography variant="h6">
                Assistants for {selectedMemberInfo?.name}
              </Typography>
              {allowedAssistantsSet && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Showing only assistants you have permission to manage.
                </Alert>
              )}
            </Box>
            {assistantsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
                <CircularProgress />
              </Box>
            ) : userAssignedAssistants.length > 0 ? (
              <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                <AssistantsList
                  groupedAssistants={groupedAssistants}
                  handleToggle={handleToggle}
                />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
                <Typography color="text.secondary">
                  No assistants available for this team member.
                </Typography>
              </Box>
            )}
          </>
        ) : (
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'text.secondary'
          }}>
            <Typography variant="h6" sx={{ px: 2 }}>
              Select a team member to view and manage their assistants
            </Typography>
          </Box>
        )}
      </Box>

      <SnackbarComponent />
    </Box>
  );
};

// Separate component for assistants list
const AssistantsList = ({ groupedAssistants, handleToggle }) => {
  // Get assignable and shared assistants with their categories
  const assignableCategories = groupedAssistants['Assignable'] || {};
  const sharedCategories = groupedAssistants['Shared'] || {};

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Assignable Assistants Section - 75% height */}
      <Box sx={{
        flex: '0 0 75%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        py: 1
      }}>
        <Typography variant="h6" sx={{ mb: 1, px: 2, color: 'primary.main' }}>
          Assignable Assistants
        </Typography>

        <Box sx={{ flexGrow: 1, overflow: 'auto', px: 2 }}>
          {Object.keys(assignableCategories).length > 0 ? (
            Object.entries(assignableCategories).map(([category, assistants]) => (
              <Box key={category} sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, px: 1, color: 'text.secondary', fontSize: '0.9rem' }}>
                  {category}
                </Typography>
                <List sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  py: 0
                }}>
                  {assistants.map((assistant, assistantIndex) => {
                    const labelId = `checkbox-list-label-${assistant.name}`;
                    const isDisabled = assistant.isPublic;

                    return (
                      <Box key={assistant.name}>
                        <ListItem disablePadding>
                          <ListItemButton
                            onClick={() => !isDisabled && handleToggle(assistant.name)}
                            dense
                            disabled={isDisabled}
                            sx={{
                              '&.Mui-disabled': {
                                opacity: 0.7,
                                backgroundColor: 'action.hover'
                              }
                            }}
                          >
                            <ListItemIcon>
                              <Checkbox
                                edge="start"
                                checked={assistant.assigned}
                                tabIndex={-1}
                                disableRipple
                                disabled={isDisabled}
                                inputProps={{ 'aria-labelledby': labelId }}
                              />
                            </ListItemIcon>
                            <ListItemText
                              id={labelId}
                              primary={assistant.displayName}
                            />
                          </ListItemButton>
                        </ListItem>
                        {assistantIndex < assistants.length - 1 && <Divider />}
                      </Box>
                    );
                  })}
                </List>
              </Box>
            ))
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No assignable assistants available.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Shared Assistants Section - 25% height */}
      <Box sx={{
        flex: '0 0 25%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        pt: 1,
        borderTop: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, px: 2, gap: 1 }}>
          <Typography variant="h6" sx={{ color: 'primary.main' }}>
            Shared Assistants
          </Typography>
          <Chip
            label="Always Active"
            size="small"
            color="default"
          />
        </Box>

        <Box sx={{ flexGrow: 1, overflow: 'auto', px: 2 }}>
          {Object.keys(sharedCategories).length > 0 ? (
            Object.entries(sharedCategories).map(([category, assistants]) => (
              <Box key={category} sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, px: 1, color: 'text.secondary', fontSize: '0.9rem' }}>
                  {category}
                </Typography>
                <List sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  py: 0
                }}>
                  {assistants.map((assistant, assistantIndex) => {
                    const labelId = `checkbox-list-label-shared-${assistant.name}`;
                    const isDisabled = assistant.isPublic;

                    return (
                      <Box key={assistant.name}>
                        <ListItem disablePadding>
                          <ListItemButton
                            onClick={() => !isDisabled && handleToggle(assistant.name)}
                            dense
                            disabled={isDisabled}
                            sx={{
                              '&.Mui-disabled': {
                                opacity: 0.7,
                                backgroundColor: 'action.hover'
                              }
                            }}
                          >
                            <ListItemIcon>
                              <Checkbox
                                edge="start"
                                checked={assistant.assigned}
                                tabIndex={-1}
                                disableRipple
                                disabled={isDisabled}
                                inputProps={{ 'aria-labelledby': labelId }}
                              />
                            </ListItemIcon>
                            <ListItemText
                              id={labelId}
                              primary={assistant.displayName}
                              secondary="Shared assistant - always available"
                            />
                          </ListItemButton>
                        </ListItem>
                        {assistantIndex < assistants.length - 1 && <Divider />}
                      </Box>
                    );
                  })}
                </List>
              </Box>
            ))
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No shared assistants available.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default AssignUserAssistants;