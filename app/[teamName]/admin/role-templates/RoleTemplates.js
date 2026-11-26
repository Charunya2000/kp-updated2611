'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  InfoOutlined as InfoOutlinedIcon
} from '@mui/icons-material';
import { PERMISSION_METADATA, getPermissionCategories, getPermissionsByCategory } from '@/app/config/permissions';
import useSnackbar from '@/app/hooks/useSnackbar';
import { formatName } from '@/utils/formatting';

const RoleTemplates = ({ teamName }) => {
  const [globalTemplates, setGlobalTemplates] = useState([]);
  const [teamTemplates, setTeamTemplates] = useState([]);
  const [enabledPermissions, setEnabledPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formName, setFormName] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissions, setFormPermissions] = useState([]);
  const [formColor, setFormColor] = useState('default');

  const { SnackbarComponent, showSnackbar } = useSnackbar();

  const enabledSet = new Set(enabledPermissions);
  const categories = getPermissionCategories().filter(category =>
    getPermissionsByCategory(category).some(p => enabledSet.has(p.key))
  );
  const getEnabledPermissionsByCategory = (category) =>
    getPermissionsByCategory(category).filter(p => enabledSet.has(p.key));

  const ROLE_COLOR_OPTIONS = ['default', 'primary', 'secondary', 'success', 'error', 'info', 'warning'];

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/team/${teamName}/role-templates`);
      const data = await res.json();
      if (data.error) {
        showSnackbar(data.error, 'error');
        return;
      }
      setGlobalTemplates(data.globalTemplates || []);
      setTeamTemplates(data.teamTemplates || []);
      setEnabledPermissions(data.enabledPermissions || []);
    } catch (error) {
      console.error('Error fetching role templates:', error);
      showSnackbar('Failed to load role templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [teamName, showSnackbar]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const saveTeamTemplates = async (updatedTemplates) => {
    try {
      const res = await fetch(`/api/team/${teamName}/role-templates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleTemplates: updatedTemplates }),
      });
      const data = await res.json();
      if (data.error) {
        showSnackbar(data.error, 'error');
        return false;
      }
      return true;
    } catch (error) {
      showSnackbar('Failed to save role templates', 'error');
      return false;
    }
  };

  // Merge: team overrides take precedence over global
  const mergedTemplates = (() => {
    const map = new Map();
    for (const t of globalTemplates) {
      map.set(t.name, { ...t, source: 'global' });
    }
    for (const t of teamTemplates) {
      map.set(t.name, { ...t, source: 'team' });
    }
    return Array.from(map.values());
  })();

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormLabel('');
    setFormDescription('');
    setFormPermissions([]);
    setFormColor('default');
    setDialogOpen(true);
  };

  const handleOpenEdit = (template) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormLabel(template.label);
    setFormDescription(template.description || '');
    setFormPermissions(template.permissions || []);
    setFormColor(template.color || 'default');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleTogglePermission = (permKey) => {
    setFormPermissions(prev =>
      prev.includes(permKey) ? prev.filter(p => p !== permKey) : [...prev, permKey]
    );
  };

  const handleToggleWildcard = () => {
    setFormPermissions(prev => prev.includes('*') ? prev.filter(p => p !== '*') : ['*']);
  };

  const handleSave = async () => {
    if (!formLabel.trim()) {
      showSnackbar('Label is required', 'error');
      return;
    }

    let updated;
    if (editingTemplate) {
      updated = teamTemplates.map(t =>
        t.name === editingTemplate.name
          ? { ...t, label: formLabel, description: formDescription, permissions: formPermissions, color: formColor }
          : t
      );
      // If editing a global template (overriding), add as team template
      if (editingTemplate.source === 'global' && !teamTemplates.find(t => t.name === editingTemplate.name)) {
        updated = [...teamTemplates, {
          name: editingTemplate.name,
          label: formLabel,
          description: formDescription,
          permissions: formPermissions,
          color: formColor,
        }];
      }
    } else {
      if (!formName.trim()) {
        showSnackbar('Name is required', 'error');
        return;
      }
      const safeName = formName.toLowerCase().replace(/\s+/g, '_');
      if (mergedTemplates.some(t => t.name === safeName)) {
        showSnackbar('A template with that name already exists', 'error');
        return;
      }
      updated = [...teamTemplates, {
        name: safeName,
        label: formLabel,
        description: formDescription,
        permissions: formPermissions,
        color: formColor,
      }];
    }

    const success = await saveTeamTemplates(updated);
    if (success) {
      showSnackbar(editingTemplate ? 'Role template updated' : 'Role template created', 'success');
      fetchTemplates();
    }
    handleCloseDialog();
  };

  const handleOpenDelete = (template) => {
    setEditingTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    const updated = teamTemplates.filter(t => t.name !== editingTemplate.name);
    const success = await saveTeamTemplates(updated);
    if (success) {
      showSnackbar('Role template removed', 'success');
      fetchTemplates();
    }
    setDeleteDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleNameBlur = useCallback(() => {
    const formattedName = formatName(formName);
    if (formattedName !== formName) {
      setFormName(formattedName);
    }
  }, [formName]);

  const hasWildcard = formPermissions.includes('*');

  return (
    <Box sx={{ p: 3, width: '100%', maxWidth: 1200 }}>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
        Role Templates
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage role templates for this team. Team-level templates override global defaults.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="primary" startIcon={<AddIcon />} onClick={handleOpenCreate}>
              Add Role Template
            </Button>
          </Box>

          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Label</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Permissions</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 120 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mergedTemplates.map(template => (
                    <TableRow key={template.name}>
                      <TableCell>
                        <Chip label={template.name} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                      </TableCell>
                      <TableCell>{template.label}</TableCell>
                      <TableCell>
                        <Chip
                          label={template.source === 'team' ? 'Team Override' : 'Global'}
                          size="small"
                          color={template.source === 'team' ? 'primary' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {template.permissions?.includes('*') ? (
                            <Chip label="All (*)" size="small" color="primary" />
                          ) : (
                            template.permissions?.slice(0, 5).map(p => (
                              <Chip key={p} label={p} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                            ))
                          )}
                          {template.permissions?.length > 5 && !template.permissions.includes('*') && (
                            <Chip label={`+${template.permissions.length - 5} more`} size="small" variant="outlined" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton size="small" onClick={() => handleOpenEdit(template)} title="Edit / Override">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          {template.source === 'team' && (
                            <IconButton size="small" onClick={() => handleOpenDelete(template)} title="Remove override" sx={{ color: 'error.main' }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {mergedTemplates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No role templates configured.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate
            ? editingTemplate.source === 'global' ? `Override Global Template: ${editingTemplate.name}` : 'Edit Team Template'
            : 'Create Team Template'}
        </DialogTitle>
        <DialogContent>
          {editingTemplate?.source === 'global' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Editing this global template will create a team-level override. The global version will be preserved but overridden for this team.
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onBlur={handleNameBlur}
              fullWidth
              disabled={!!editingTemplate}
              helperText={editingTemplate ? 'Name cannot be changed' : 'Lowercase letters, numbers, and hyphens only. Cannot start with a number.'}
            />
            <TextField
              label="Label"
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              fullWidth
            />
            <TextField
              label="Description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Color</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {ROLE_COLOR_OPTIONS.map(color => (
                  <Chip
                    key={color}
                    label={color}
                    color={color}
                    size="small"
                    variant={formColor === color ? 'filled' : 'outlined'}
                    onClick={() => setFormColor(color)}
                    sx={{ cursor: 'pointer', ...(formColor === color && { boxShadow: 2 }) }}
                  />
                ))}
              </Box>
            </Box>

            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Permissions</Typography>

            <ListItem
              dense
              onClick={handleToggleWildcard}
              sx={{ cursor: 'pointer', bgcolor: hasWildcard ? 'action.selected' : 'transparent', borderRadius: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox edge="start" checked={hasWildcard} />
              </ListItemIcon>
              <ListItemText primary="All Permissions (*)" secondary="Grant all current and future permissions" />
            </ListItem>

            {!hasWildcard && categories.map(category => (
              <Box key={category}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: 'text.secondary' }}>
                  {category}
                </Typography>
                <List dense disablePadding>
                  {getEnabledPermissionsByCategory(category).map(perm => (
                    <ListItem
                      key={perm.key}
                      dense
                      onClick={() => handleTogglePermission(perm.key)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1, pl: 1 }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox edge="start" checked={formPermissions.includes(perm.key)} size="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={perm.label}
                        secondary={perm.key}
                        primaryTypographyProps={{ fontSize: '0.9rem' }}
                        secondaryTypographyProps={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>
            {editingTemplate ? (editingTemplate.source === 'global' ? 'Save Override' : 'Update') : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Remove Template Override</DialogTitle>
        <DialogContent>
          <Typography>
            Remove the team override for &quot;{editingTemplate?.label}&quot;?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            If a global template with this name exists, it will be restored for this team.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete}>Remove</Button>
        </DialogActions>
      </Dialog>

      <SnackbarComponent />
    </Box>
  );
};

export default RoleTemplates;
