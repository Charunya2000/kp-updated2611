'use client';

import React, { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  Chip,
  Stack,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  Checkbox,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from "@mui/material";
import { List } from 'react-window';
import CloseIcon from '@mui/icons-material/Close';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import InfoOutlineIcon from '@mui/icons-material/Info';
import TuneIcon from '@mui/icons-material/Tune';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import { getTeamMembers, getTeamMember, addTeamMembers, removeTeamMember, updateTeamMemberRoles, updateTeamMemberGrants } from '@/app/clientServices/teamMemberService';
import { getAllAssistants } from '@/app/clientServices/assistantService';
import { PERMISSIONS, getPermissionCategories, getPermissionsByCategory } from '@/app/config/permissions';
import { reconcileGrantsForRoleChange } from '@/app/services/permissionsService';
import { getUserNames } from '@/app/clientServices/userService';
import useSnackbar from '@/app/hooks/useSnackbar';

const ASSISTANT_SCOPED_PERMISSION_OPTIONS = [
  {
    prefix: PERMISSIONS.ASSISTANT_SETTINGS_MANAGE_SCOPED,
    label: 'Manage Assistant Settings',
    description: 'Can manage prompts, personas, indexes, and other assistant settings.',
  },
  {
    prefix: PERMISSIONS.ASSISTANTS_ASSIGN_USERS_SCOPED,
    label: 'Assign Users to Assistant',
    description: 'Can add and remove team members assigned to this assistant.',
  },
];

const ASSISTANT_SCOPED_PERMISSION_PREFIXES = ASSISTANT_SCOPED_PERMISSION_OPTIONS.map(option => option.prefix);

const RoleSelector = React.memo(function RoleSelector({
  member,
  disabled,
  canManagePermissions,
  canManageMembers,
  availableRoles,
  onRoleChange
}) {
  const currentRoles = member.roles || ['member'];
  const [tempRoles, setTempRoles] = useState(currentRoles);

  // Keep local state in sync when roles are updated externally.
  useEffect(() => {
    setTempRoles(member.roles || ['member']);
  }, [member.roles]);

  const handleSelectChange = (event) => {
    let newRoles = event.target.value;

    if (newRoles.length === 0) {
      newRoles = ['member'];
    }

    setTempRoles(newRoles);
  };

  const handleClose = () => {
    const tempRolesSorted = [...(tempRoles || ['member'])].sort();
    const currentRolesSorted = [...(currentRoles || ['member'])].sort();
    const rolesChanged = JSON.stringify(tempRolesSorted) !== JSON.stringify(currentRolesSorted);

    if (rolesChanged) {
      onRoleChange(member, tempRoles);
    }
  };

  const handleOpen = () => {
    setTempRoles(currentRoles);
  };

  const safeTempRoles = tempRoles || ['member'];

  return (
    <FormControl size="small" disabled={disabled || !canManagePermissions}>
      <Select
        multiple
        value={safeTempRoles}
        onChange={handleSelectChange}
        onClose={handleClose}
        onOpen={handleOpen}
        renderValue={(selected) => {
          const roleOrder = availableRoles.length > 0
            ? availableRoles.map(r => r.name)
            : ['member', 'admin', 'owner'];
          const sortedRoles = [...selected].sort((a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b));

          return (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {sortedRoles.map((value) => {
                const role = availableRoles.find(r => r.name === value);
                return (
                  <Chip
                    key={value}
                    label={role?.label || value}
                    size="small"
                    color={role?.color || 'default'}
                  />
                );
              })}
            </Box>
          );
        }}
        sx={{ minWidth: 120 }}
      >
        {availableRoles.length > 0 ? (
          availableRoles
            .map(role => (
              <MenuItem key={role.name} value={role.name}>
                <Checkbox checked={safeTempRoles.includes(role.name)} />
                <ListItemText
                  primary={role.label}
                  secondary={role.description}
                />
              </MenuItem>
            ))
        ) : (
          <>
            <MenuItem value="admin">
              <Checkbox checked={safeTempRoles.includes('admin')} />
              <ListItemText
                primary="Admin"
                secondary="Can access the admin panel to manage assistants, users, and more"
              />
            </MenuItem>
            <MenuItem value="member">
              <Checkbox checked={safeTempRoles.includes('member')} />
              <ListItemText
                primary="Member"
                secondary="Can access assigned and shared assistants"
              />
            </MenuItem>
            <MenuItem value="owner">
              <Checkbox checked={safeTempRoles.includes('owner')} />
              <ListItemText
                primary="Owner"
                secondary="Has all admin capabilities and can manage team member roles"
              />
            </MenuItem>
          </>
        )}
      </Select>
    </FormControl>
  );
});

const VirtualizedMemberItem = React.memo(function VirtualizedMemberItem({ index, style, data }) {
  const {
    allMembers,
    selectedNuid,
    onSelectMember,
    onOpenScopedGrantsDialog,
    onRemoveMember,
    loading,
    canManagePermissions,
    canManageMembers,
    availableRoles,
    onRoleChange
  } = data;

  const member = allMembers[index];
  const isOwner = member.roles?.includes('owner');
  const isLastItem = index === allMembers.length - 1;
  const isSelected = member.nuid === selectedNuid;

  return (
    <div style={style}>
      <ListItem
        onClick={() => onSelectMember(member)}
        secondaryAction={
          <Stack direction="row" spacing={1} alignItems="center" onClick={(e) => e.stopPropagation()}>
            <RoleSelector
              member={member}
              disabled={loading}
              canManagePermissions={canManagePermissions}
              canManageMembers={canManageMembers}
              availableRoles={availableRoles}
              onRoleChange={onRoleChange}
            />
            <Tooltip title="Assistant-scoped permissions">
              <span>
                <IconButton
                  size="small"
                  onClick={() => onOpenScopedGrantsDialog(member)}
                  disabled={loading || !canManagePermissions}
                >
                  <TuneIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton
              edge="end"
              aria-label="remove"
              onClick={() => onRemoveMember(member.nuid)}
              sx={{
                color: 'error.dark',
                '&:hover': { color: 'error.main' }
              }}
              size="small"
              disabled={isOwner || loading}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        }
        sx={{
          py: 1,
          cursor: 'pointer',
          ...(isSelected && {
            backgroundColor: 'action.selected',
          }),
          ...(isOwner && !isSelected && {
            backgroundColor: 'background.subtle',
            opacity: 0.9
          }),
          '&:hover': {
            backgroundColor: isSelected ? 'action.selected' : 'action.hover',
          }
        }}
      >
        <ListItemText
          primary={
            <Stack direction="row" spacing={1} alignItems="center">
              {isOwner && (
                <AdminPanelSettingsIcon
                  fontSize="small"
                  sx={{ color: 'primary.main' }}
                />
              )}
              <Chip
                label={member.nuid}
                size="small"
                variant="outlined"
                sx={{
                  fontFamily: 'monospace',
                  ...(isOwner && {
                    borderColor: 'primary.main',
                    color: 'primary.main'
                  })
                }}
              />
              <Typography variant="body2" sx={{ color: isOwner ? 'text.secondary' : 'text.primary' }}>
                {member.name}
              </Typography>
            </Stack>
          }
          secondary={member.email}
        />
      </ListItem>
      {!isLastItem && <Divider />}
    </div>
  );
});

const TeamMembers = ({ teamName }) => {
  const [members, setMembers] = useState([]);
  const [teamOwners, setTeamOwners] = useState([]);
  const [nuidInput, setNuidInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [availableRoles, setAvailableRoles] = useState([]);
  const [teamAssistants, setTeamAssistants] = useState([]);
  const [scopedGrantsDialogOpen, setScopedGrantsDialogOpen] = useState(false);
  const [scopedGrantsDialogMember, setScopedGrantsDialogMember] = useState(null);
  const [scopedGrantsDialogSelections, setScopedGrantsDialogSelections] = useState([]);
  const [scopedGrantsFilter, setScopedGrantsFilter] = useState('');
  const [selectedMemberNuid, setSelectedMemberNuid] = useState(null);
  const [editingGrants, setEditingGrants] = useState([]);
  const [enabledPermissions, setEnabledPermissions] = useState([]);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [canManagePermissions, setCanManagePermissions] = useState(false);
  const { user } = useAuth();
  const deferredFilterText = useDeferredValue(filterText);
  const deferredScopedGrantsFilter = useDeferredValue(scopedGrantsFilter);

  // Use the custom snackbar hook
  const { SnackbarComponent, showSnackbar } = useSnackbar();

  const selectedMember = selectedMemberNuid
    ? [...teamOwners, ...members].find(m => m.nuid === selectedMemberNuid)
    : null;

  const enabledSet = new Set(enabledPermissions);
  const permissionCategories = getPermissionCategories().filter(category =>
    getPermissionsByCategory(category).some(p => enabledSet.has(p.key) && !p.isScoped)
  );
  const getEnabledPermissions = (category) =>
    getPermissionsByCategory(category).filter(p => enabledSet.has(p.key) && !p.isScoped);

  // Filter members based on search text and role
  const filterMembers = useCallback((memberList, searchText, roleFilter) => {
    let filtered = memberList;

    // Apply text filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(member =>
        member.nuid?.toLowerCase().includes(searchLower) ||
        member.name?.toLowerCase().includes(searchLower) ||
        member.email?.toLowerCase().includes(searchLower)
      );
    }

    // Apply role filter
    if (roleFilter) {
      filtered = filtered.filter(member =>
        member.roles?.includes(roleFilter)
      );
    }

    return filtered;
  }, []);

  // Get filtered members and owners
  const filteredTeamOwners = useMemo(
    () => filterMembers(teamOwners, deferredFilterText, filterRole),
    [teamOwners, deferredFilterText, filterRole, filterMembers]
  );
  const filteredMembers = useMemo(
    () => filterMembers(members, deferredFilterText, filterRole),
    [members, deferredFilterText, filterRole, filterMembers]
  );
  const filteredScopedAssistants = useMemo(() => {
    if (!deferredScopedGrantsFilter.trim()) {
      return teamAssistants;
    }

    const search = deferredScopedGrantsFilter.toLowerCase().trim();
    return teamAssistants.filter(assistant =>
      assistant.name?.toLowerCase().includes(search) || assistant.displayName?.toLowerCase().includes(search)
    );
  }, [teamAssistants, deferredScopedGrantsFilter]);

  const allMembers = useMemo(
    () => [...filteredTeamOwners, ...filteredMembers],
    [filteredTeamOwners, filteredMembers]
  );

  // Check if current user has permission to manage members
  useEffect(() => {
    if (teamName && user?.nuid) {
      getTeamMember(teamName, user.nuid)
        .then(data => {
          const perms = data?.permissions || [];
          setCanManageMembers(perms.includes(PERMISSIONS.TEAM_MEMBERS_MANAGE) || perms.includes('*'));
          setCanManagePermissions(perms.includes(PERMISSIONS.TEAM_MEMBERS_PERMISSIONS_MANAGE) || perms.includes('*'));
        })
        .catch(() => {
          setCanManageMembers(false);
          setCanManagePermissions(false);
        });
    }
  }, [teamName, user?.nuid]);

  // Get team members
  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);

      // Get team members
      const teamMembers = await getTeamMembers(teamName);
      const teamOwners = teamMembers.filter(member => member.roles?.includes('owner'));

      // Process team owners
      let ownersWithDetails = [];
      if (teamOwners && teamOwners.length > 0) {
        try {
          const ownerDetails = await getUserNames(teamOwners.map(owner => owner.nuid));
          ownersWithDetails = teamOwners.map(owner => {
            const userDetail = ownerDetails.find(user => user.nuid === owner.nuid);
            return {
              ...owner,
              name: userDetail ? userDetail.name : 'Unknown',
              email: userDetail ? userDetail.email : null,
              isOwner: true
            };
          });
        } catch (error) {
          // If getUserNames fails, just use the NUIDs without names
          ownersWithDetails = teamOwners.map(owner => ({
            ...owner,
            name: 'Unknown',
            email: null,
            isOwner: true
          }));
        }
      }
      setTeamOwners(ownersWithDetails);

      // Get member details from UserDetail (non-owners)
      const nonOwnerMembers = teamMembers.filter(member => !member.roles?.includes('owner'));
      if (nonOwnerMembers.length > 0) {
        const nuids = nonOwnerMembers.map(member => member.nuid);
        try {
          const userDetails = await getUserNames(nuids);
          const membersWithDetails = nonOwnerMembers.map(member => {
            const userDetail = userDetails.find(user => user.nuid === member.nuid);
            return {
              ...member,
              name: userDetail ? userDetail.name : 'Unknown',
              email: userDetail ? userDetail.email : null,
              isOwner: false
            };
          });
          setMembers(membersWithDetails);
        } catch (error) {
          // If getUserNames fails, just use the members without detailed names
          setMembers(nonOwnerMembers.map(member => ({ ...member, name: 'Unknown', isOwner: false })));
        }
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
      showSnackbar('Failed to load team members', 'error');
    } finally {
      setLoading(false);
    }
  }, [teamName, showSnackbar]);

  useEffect(() => {
    if (teamName) {
      fetchMembers();
      // Fetch available roles from role templates
      fetch(`/api/team/${teamName}/role-templates`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            // Merge global + team templates (team overrides global by name)
            const map = new Map();
            for (const t of (data.globalTemplates || [])) map.set(t.name, t);
            for (const t of (data.teamTemplates || [])) map.set(t.name, t);
            setAvailableRoles(Array.from(map.values()));
            setEnabledPermissions(data.enabledPermissions || []);
          }
        })
        .catch(() => { /* fall back to empty */ });
      // Fetch team assistants for scoped grants
      getAllAssistants(teamName)
        .then(assistants => {
          if (Array.isArray(assistants)) {
            setTeamAssistants(assistants.sort((a, b) => a.displayName.localeCompare(b.displayName)));
          }
        })
        .catch(() => { /* fall back to empty */ });
    }
  }, [teamName, fetchMembers]);

  // Handle NUID input functions
  const handleNuidInputChange = (event) => {
    setNuidInput(event.target.value.toUpperCase());
    setInputError('');
  };

  const handleAddMembers = async () => {
    if (!nuidInput.trim()) {
      setInputError('Please enter at least one NUID');
      return;
    }

    // Split by comma and trim whitespace
    const nuidsToAdd = nuidInput.split(',').map(nuid => nuid.trim());

    // Validate NUIDs (basic validation)
    const invalidNuids = nuidsToAdd.filter(nuid => !nuid.match(/^[a-zA-Z]\d{6}$|^[^\s@]+@[^\s@]+\.[^\s@]+$/));

    if (invalidNuids.length > 0) {
      setInputError(`Invalid NUID format: ${invalidNuids.join(', ')}. Expected format: Any letter followed by 6 digits, or a valid email address.`);
      return;
    }

    // Check for duplicates (including team owners and existing members)
    const existingMemberNuids = members.map(member => member.nuid);
    const existingOwnerNuids = teamOwners.map(owner => owner.nuid);
    const allExistingNuids = [...existingMemberNuids, ...existingOwnerNuids];
    const duplicateNuids = nuidsToAdd.filter(nuid => allExistingNuids.includes(nuid));

    if (duplicateNuids.length > 0) {
      const duplicateOwners = duplicateNuids.filter(nuid => existingOwnerNuids.includes(nuid));
      const duplicateMembers = duplicateNuids.filter(nuid => existingMemberNuids.includes(nuid));

      let errorMessage = '';
      if (duplicateOwners.length > 0) {
        errorMessage += `These NUIDs are team owners: ${duplicateOwners.join(', ')}`;
      }
      if (duplicateMembers.length > 0) {
        if (errorMessage) errorMessage += '. ';
        errorMessage += `These NUIDs are already members: ${duplicateMembers.join(', ')}`;
      }

      setInputError(errorMessage);
      return;
    }

    try {
      setLoading(true);
      const result = await addTeamMembers(teamName, nuidsToAdd);

      if (result && !result.error) {
        showSnackbar(`Added ${nuidsToAdd.length} member(s) successfully`, 'success');
        setNuidInput('');
        fetchMembers(); // Refresh the list
      } else {
        showSnackbar(result.error || 'Failed to add members', 'error');
      }
    } catch (error) {
      console.error('Error adding members:', error);
      showSnackbar('Error adding members', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (nuidToRemove) => {
    // Find the member being removed (could be in owners or members list)
    const memberToRemove = teamOwners.find(owner => owner.nuid === nuidToRemove) ||
      members.find(member => member.nuid === nuidToRemove);

    if (!memberToRemove) {
      showSnackbar('Member not found', 'error');
      return;
    }

    if (selectedMemberNuid === nuidToRemove) {
      setSelectedMemberNuid(null);
    }

    // Optimistically remove the member from the UI immediately
    const isOwner = teamOwners.some(owner => owner.nuid === nuidToRemove);
    if (isOwner) {
      setTeamOwners(prev => prev.filter(owner => owner.nuid !== nuidToRemove));
    } else {
      setMembers(prev => prev.filter(member => member.nuid !== nuidToRemove));
    }

    try {
      // Make the API call without setting loading state
      const result = await removeTeamMember(teamName, nuidToRemove);

      if (result && result.success) {
        showSnackbar('Member removed successfully', 'success');
      } else {
        // API call failed - restore the member to the list
        if (isOwner) {
          setTeamOwners(prev => [...prev, memberToRemove].sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          setMembers(prev => [...prev, memberToRemove].sort((a, b) => a.name.localeCompare(b.name)));
        }
        showSnackbar('Failed to remove member', 'error');
      }
    } catch (error) {
      console.error('Error removing member:', error);

      // API call failed - restore the member to the list
      if (isOwner) {
        setTeamOwners(prev => [...prev, memberToRemove].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        setMembers(prev => [...prev, memberToRemove].sort((a, b) => a.name.localeCompare(b.name)));
      }
      showSnackbar('Error removing member', 'error');
    }
  };

  const handleRoleChange = async (member, newRoles) => {
    if (!canManagePermissions) {
      showSnackbar('You do not have permission to modify roles', 'error');
      return;
    }

    // Prevent removing the last owner
    const currentOwners = [...teamOwners, ...members.filter(m => m.roles?.includes('owner'))];
    const isRemovingOwnerRole = member.roles?.includes('owner') && !newRoles.includes('owner');

    if (isRemovingOwnerRole && currentOwners.length === 1) {
      showSnackbar('Cannot remove the last team owner', 'error');
      return;
    }

    // Store original state for rollback
    const originalRoles = member.roles;
    const originalGrants = member.grants;
    const wasOwner = member.roles?.includes('owner');
    const willBeOwner = newRoles.includes('owner');
    const newGrants = reconcileGrantsForRoleChange(member, originalRoles || [], newRoles, availableRoles);
    const memberToUpdate = { ...member, roles: newRoles, grants: newGrants };

    // Optimistically update the member's roles immediately
    if (wasOwner && !willBeOwner) {
      // Moving from owner to regular member
      setTeamOwners(prev => prev.filter(owner => owner.nuid !== member.nuid));
      setMembers(prev => [...prev, memberToUpdate].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (!wasOwner && willBeOwner) {
      // Moving from regular member to owner
      setMembers(prev => prev.filter(m => m.nuid !== member.nuid));
      setTeamOwners(prev => [...prev, memberToUpdate].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (wasOwner && willBeOwner) {
      // Staying as owner, just update roles
      setTeamOwners(prev => prev.map(owner =>
        owner.nuid === member.nuid ? memberToUpdate : owner
      ));
    } else {
      // Staying as regular member, just update roles
      setMembers(prev => prev.map(m =>
        m.nuid === member.nuid ? memberToUpdate : m
      ));
    }

    try {
      // Make the API call without setting loading state
      const result = await updateTeamMemberRoles(teamName, member.nuid, newRoles, newGrants);

      if (result && !result.error) {
        showSnackbar('Member roles updated successfully', 'success');
      } else {
        // API call failed - rollback the changes
        const memberWithOriginalRoles = { ...member, roles: originalRoles, grants: originalGrants };

        if (wasOwner && !willBeOwner) {
          // Rollback: move back to owners
          setMembers(prev => prev.filter(m => m.nuid !== member.nuid));
          setTeamOwners(prev => [...prev, memberWithOriginalRoles].sort((a, b) => a.name.localeCompare(b.name)));
        } else if (!wasOwner && willBeOwner) {
          // Rollback: move back to regular members
          setTeamOwners(prev => prev.filter(owner => owner.nuid !== member.nuid));
          setMembers(prev => [...prev, memberWithOriginalRoles].sort((a, b) => a.name.localeCompare(b.name)));
        } else if (wasOwner && willBeOwner) {
          // Rollback: restore original roles in owners
          setTeamOwners(prev => prev.map(owner =>
            owner.nuid === member.nuid ? memberWithOriginalRoles : owner
          ));
        } else {
          // Rollback: restore original roles in members
          setMembers(prev => prev.map(m =>
            m.nuid === member.nuid ? memberWithOriginalRoles : m
          ));
        }

        showSnackbar(result.error || 'Failed to update member roles', 'error');
      }
    } catch (error) {
      console.error('Error updating member roles:', error);

      // API call failed - rollback the changes
      const memberWithOriginalRoles = { ...member, roles: originalRoles, grants: originalGrants };

      if (wasOwner && !willBeOwner) {
        // Rollback: move back to owners
        setMembers(prev => prev.filter(m => m.nuid !== member.nuid));
        setTeamOwners(prev => [...prev, memberWithOriginalRoles].sort((a, b) => a.name.localeCompare(b.name)));
      } else if (!wasOwner && willBeOwner) {
        // Rollback: move back to regular members
        setTeamOwners(prev => prev.filter(owner => owner.nuid !== member.nuid));
        setMembers(prev => [...prev, memberWithOriginalRoles].sort((a, b) => a.name.localeCompare(b.name)));
      } else if (wasOwner && willBeOwner) {
        // Rollback: restore original roles in owners
        setTeamOwners(prev => prev.map(owner =>
          owner.nuid === member.nuid ? memberWithOriginalRoles : owner
        ));
      } else {
        // Rollback: restore original roles in members
        setMembers(prev => prev.map(m =>
          m.nuid === member.nuid ? memberWithOriginalRoles : m
        ));
      }

      showSnackbar('Error updating member roles', 'error');
    }
  };

  // --- Assistant Permissions (Grants) Dialog ---
  const handleOpenScopedGrantsDialog = (member) => {
    const currentSelections = (member.grants || []).filter(grant =>
      ASSISTANT_SCOPED_PERMISSION_PREFIXES.some(prefix => grant.startsWith(prefix))
    );
    setScopedGrantsDialogMember(member);
    setScopedGrantsDialogSelections(currentSelections);
    setScopedGrantsFilter('');
    setScopedGrantsDialogOpen(true);
  };

  const handleCloseScopedGrantsDialog = () => {
    setScopedGrantsDialogOpen(false);
    setScopedGrantsDialogMember(null);
    setScopedGrantsFilter('');
  };

  const handleToggleAssistantGrant = (prefix, assistantName) => {
    const scopedGrant = `${prefix}${assistantName}`;
    setScopedGrantsDialogSelections(prev =>
      prev.includes(scopedGrant)
        ? prev.filter(grant => grant !== scopedGrant)
        : [...prev, scopedGrant]
    );
  };

  const handleSaveGrants = async () => {
    if (!scopedGrantsDialogMember) return;
    const existingGrants = (scopedGrantsDialogMember.grants || []).filter(grant =>
      !ASSISTANT_SCOPED_PERMISSION_PREFIXES.some(prefix => grant.startsWith(prefix))
    );
    const newGrants = [...existingGrants, ...scopedGrantsDialogSelections];

    try {
      const result = await updateTeamMemberGrants(teamName, scopedGrantsDialogMember.nuid, newGrants);
      if (result && !result.error) {
        // Update local state
        const updateList = (list) => list.map(m =>
          m.nuid === scopedGrantsDialogMember.nuid ? { ...m, grants: newGrants } : m
        );
        setMembers(updateList);
        setTeamOwners(updateList);
        showSnackbar('Assistant permissions updated', 'success');
      } else {
        showSnackbar(result?.error || 'Failed to update permissions', 'error');
      }
    } catch (error) {
      showSnackbar('Error updating permissions', 'error');
    }
    handleCloseScopedGrantsDialog();
  };

  // --- Individual Permission Management ---
  const handleSelectMember = (member) => {
    if (selectedMemberNuid === member.nuid) {
      setSelectedMemberNuid(null);
    } else {
      setSelectedMemberNuid(member.nuid);
      setEditingGrants([...(member.grants || [])]);
    }
  };

  const handleToggleGrant = (permKey) => {
    setEditingGrants(prev =>
      prev.includes(permKey) ? prev.filter(p => p !== permKey) : [...prev, permKey]
    );
  };

  const reconcileRolesFromGrants = (member, newGrants) => {
    const grantsSet = new Set(newGrants);
    const newRoles = ['member'];

    // Owner role is structural — preserve as-is, don't auto-reconcile
    if (member.roles?.includes('owner')) {
      newRoles.push('owner');
    }

    for (const template of availableRoles) {
      if (template.name === 'owner' || template.name === 'member') continue;

      const templatePerms = template.permissions || [];
      if (templatePerms.length === 0) continue;

      if (templatePerms.includes('*')) {
        if (grantsSet.has('*')) newRoles.push(template.name);
        continue;
      }

      const hasAll = templatePerms.every(p => grantsSet.has(p));
      if (hasAll) newRoles.push(template.name);
    }

    return newRoles;
  };

  const handleSavePermissions = async () => {
    if (!selectedMember) return;

    const originalGrants = selectedMember.grants || [];
    const originalRoles = selectedMember.roles || ['member'];
    const newRoles = reconcileRolesFromGrants(selectedMember, editingGrants);
    const isOwner = originalRoles.includes('owner');

    // Optimistic update
    const updateList = (list) => list.map(m =>
      m.nuid === selectedMember.nuid ? { ...m, grants: editingGrants, roles: newRoles } : m
    );
    if (isOwner) {
      setTeamOwners(updateList);
    } else {
      setMembers(updateList);
    }

    try {
      const result = await updateTeamMemberRoles(teamName, selectedMember.nuid, newRoles, editingGrants);
      if (result && !result.error) {
        const addedRoles = newRoles.filter(r => !originalRoles.includes(r));
        const removedRoles = originalRoles.filter(r => !newRoles.includes(r));
        const parts = [];
        if (addedRoles.length) parts.push(`added roles: ${addedRoles.join(', ')}`);
        if (removedRoles.length) parts.push(`removed roles: ${removedRoles.join(', ')}`);
        const msg = parts.length ? `Permissions saved (${parts.join('; ')})` : 'Permissions saved';
        showSnackbar(msg, 'success');
      } else {
        const rollbackList = (list) => list.map(m =>
          m.nuid === selectedMember.nuid ? { ...m, grants: originalGrants, roles: originalRoles } : m
        );
        if (isOwner) setTeamOwners(rollbackList); else setMembers(rollbackList);
        setEditingGrants([...originalGrants]);
        showSnackbar(result?.error || 'Failed to save permissions', 'error');
      }
    } catch (error) {
      const rollbackList = (list) => list.map(m =>
        m.nuid === selectedMember.nuid ? { ...m, grants: originalGrants, roles: originalRoles } : m
      );
      if (isOwner) setTeamOwners(rollbackList); else setMembers(rollbackList);
      setEditingGrants([...originalGrants]);
      showSnackbar('Error saving permissions', 'error');
    }
  };

  const virtualizedRowData = useMemo(() => ({
    allMembers,
    selectedNuid: selectedMemberNuid,
    onSelectMember: handleSelectMember,
    onOpenScopedGrantsDialog: handleOpenScopedGrantsDialog,
    onRemoveMember: handleRemoveMember,
    loading,
    canManagePermissions,
    canManageMembers,
    availableRoles,
    onRoleChange: handleRoleChange
  }), [
    allMembers,
    selectedMemberNuid,
    loading,
    canManagePermissions,
    canManageMembers,
    availableRoles
  ]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddMembers();
    }
  };

  return (
    <>

      {/* Members List */}
      <Box sx={{
        width: '50%',
        border: '1px solid',
        borderColor: 'color.slate',
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="top" spacing={1} sx={{ mb: 2 }}>
            <Typography variant="h6">
              Current Members ({filteredTeamOwners.length + filteredMembers.length}{(filterText || filterRole) ? ` of ${teamOwners.length + members.length}` : ''})
            </Typography>
            <Tooltip
              title="When a user name is 'Unknown' it means we do not have their name or email information, usually because they have not yet logged into the application"
              arrow
              placement="top"
            >
              <InfoOutlineIcon
                fontSize="small"
                sx={{
                  color: 'text.secondary',
                  cursor: 'help',
                  '&:hover': {
                    color: 'primary.main'
                  }
                }}
              />
            </Tooltip>
          </Stack>
          <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
            <TextField
              size="small"
              placeholder="Filter by NUID, name, or email..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              sx={{ flexGrow: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                displayEmpty
                renderValue={(selected) => {
                  if (!selected) {
                    return <Typography sx={{ color: 'text.secondary' }}>Filter by role</Typography>;
                  }
                  const role = availableRoles.find(r => r.name === selected);
                  return (
                    <Chip
                      label={role?.label || selected}
                      size="small"
                      color={role?.color || 'default'}
                    />
                  );
                }}
              >
                <MenuItem value="">
                  <Typography sx={{ color: 'text.secondary' }}>all roles</Typography>
                </MenuItem>
                {availableRoles.map(role => (
                  <MenuItem key={role.name} value={role.name}>
                    <Chip label={role.label} size="small" color={role.color || 'default'} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Box>

        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <CircularProgress fontSize={'32px'} />
          </Box>
        ) : (
          allMembers.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {(filterText || filterRole) ? 'No members match your filter.' : 'No members added yet.'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ width: '100%', overflow: 'auto' }}>
              <List
                rowCount={allMembers.length}
                rowHeight={48}
                rowComponent={VirtualizedMemberItem}
                overscanCount={5}
                rowProps={{ data: virtualizedRowData }}
              />
            </Box>
          )
        )}
      </Box>

      <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
        {/* Add Members Section */}
        <Box sx={{
          p: 2,
          border: '1px solid',
          borderColor: 'color.slate',
          borderRadius: 1,
          flexGrow: 1,
          flexShrink: 0
        }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Add New Members
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              sx={{ flexGrow: 1 }}
              variant="outlined"
              placeholder="Enter NUIDs separated by commas (e.g., N123456, A876543)"
              value={nuidInput}
              onChange={handleNuidInputChange}
              onKeyDown={handleKeyDown}
              error={!!inputError}
              helperText={inputError}
              size="small"
              disabled={loading}
            />
            <Button
              variant="action"
              onClick={handleAddMembers}
              disabled={loading}
              sx={{ minWidth: '120px' }}
            >
              Add Members
            </Button>
          </Box>
        </Box>

        {/* Individual Permissions Management */}
        {selectedMember && (
          <Box sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'color.slate',
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            minHeight: 0,
            overflow: 'hidden'
          }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6">
                Permissions — {selectedMember.name} ({selectedMember.nuid})
              </Typography>
              <IconButton size="small" onClick={() => setSelectedMemberNuid(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Manage individual permissions. Role assignments will automatically update based on granted permissions.
            </Typography>

            {editingGrants.includes('*') ? (
              <Alert severity="info">
                This member has the wildcard (*) grant which includes all permissions. Remove the owner role to manage individual permissions.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'auto', flexGrow: 1, minHeight: 0 }}>
                  {!canManagePermissions ? (
                    <Typography color="text.secondary">You do not have permission to view this user's permissions.</Typography>
                  ) : (
                    permissionCategories.map(category => (
                      <Box key={category} sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          {category}
                        </Typography>
                        {getEnabledPermissions(category).map(perm => (
                          <ListItem
                            key={perm.key}
                            dense
                            onClick={() => handleToggleGrant(perm.key)}
                            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1, py: 0, pl: 1 }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <Checkbox edge="start" checked={editingGrants.includes(perm.key)} size="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={perm.label}
                              secondary={perm.description}
                              primaryTypographyProps={{ fontSize: '0.85rem' }}
                              secondaryTypographyProps={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                            />
                          </ListItem>
                        ))}
                      </Box>
                    ))
                  )}
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1, gap: 1, mt: 'auto' }}>
                  <Button variant="secondary" size="small" onClick={() => setEditingGrants([...(selectedMember.grants || [])])}>
                    Reset
                  </Button>
                  <Button variant="primary" size="small" onClick={handleSavePermissions} disabled={!canManagePermissions}>
                    Save Permissions
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Assistant-Scoped Permissions Dialog */}
      <Dialog open={scopedGrantsDialogOpen} onClose={handleCloseScopedGrantsDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Assistant-Scoped Permissions — {scopedGrantsDialogMember?.nuid}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Assign assistant-specific permissions to this user. Each assistant lists the scoped permissions that can be granted independently.
          </Typography>

          {teamAssistants.length > 5 && (
            <TextField
              fullWidth
              size="small"
              placeholder="Filter by assistant name or display name"
              value={scopedGrantsFilter}
              onChange={(event) => setScopedGrantsFilter(event.target.value)}
              sx={{ mb: 2 }}
            />
          )}

          {teamAssistants.length === 0 ? (
            <Typography color="text.secondary">No assistants found for this team.</Typography>
          ) : filteredScopedAssistants.length === 0 ? (
            <Typography color="text.secondary">No assistants match the current filter.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredScopedAssistants.map(assistant => (
                <Paper key={assistant.name} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {assistant.displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontFamily: 'monospace', mb: 1.5 }}>
                    {assistant.name}
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {ASSISTANT_SCOPED_PERMISSION_OPTIONS.map(option => {
                      const scopedGrant = `${option.prefix}${assistant.name}`;
                      const isChecked = scopedGrantsDialogSelections.includes(scopedGrant);

                      if (option.prefix === PERMISSIONS.ASSISTANT_SETTINGS_MANAGE_SCOPED && assistant.isHiddenFromSettings) {
                        return null; // Don't render this option for assistants hidden from settings
                      }

                      return (
                        <ListItem
                          key={scopedGrant}
                          dense
                          disableGutters
                          onClick={() => handleToggleAssistantGrant(option.prefix, assistant.name)}
                          sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1, px: 1 }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Checkbox edge="start" checked={isChecked} size="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={option.label}
                            secondary={option.description}
                            primaryTypographyProps={{ fontSize: '0.9rem' }}
                            secondaryTypographyProps={{ fontSize: '0.75rem' }}
                          />
                        </ListItem>
                      );
                    })}
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={handleCloseScopedGrantsDialog}>Cancel</Button>
          <Button variant="primary" disabled={!canManagePermissions} onClick={handleSaveGrants}>Save</Button>
        </DialogActions>
      </Dialog>

      <SnackbarComponent />
    </>
  );
};

export default TeamMembers;
