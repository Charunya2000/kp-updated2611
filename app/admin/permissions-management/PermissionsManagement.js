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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip
} from '@mui/material';
import {
  ExpandMore,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  InfoOutlined as InfoOutlinedIcon,
  Sync as SyncIcon,
  CheckCircleOutline as CheckCircleOutlineIcon
} from '@mui/icons-material';
import Alert from '@mui/material/Alert';
import { PERMISSION_METADATA, getPermissionCategories, getPermissionsByCategory } from '@/app/config/permissions';
import { getAllRoleTemplates, createRoleTemplate, updateRoleTemplate, deleteRoleTemplate } from '@/app/clientServices/roleTemplateService';
import useSnackbar from '@/app/hooks/useSnackbar';
import { formatName } from '@/utils/formatting';

const PermissionsManagement = () => {
  const [roleTemplates, setRoleTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formName, setFormName] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissions, setFormPermissions] = useState([]);
  const [formIsSystem, setFormIsSystem] = useState(false);
  const [formColor, setFormColor] = useState('default');

  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);

  const { SnackbarComponent, showSnackbar } = useSnackbar();
  const categories = getPermissionCategories();
  const ROLE_COLOR_OPTIONS = ['default', 'primary', 'secondary', 'success', 'error', 'info', 'warning'];

  const fetchRoleTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const templates = await getAllRoleTemplates();
      setRoleTemplates(Array.isArray(templates) ? templates : []);
    } catch (error) {
      console.error('Error fetching role templates:', error);
      showSnackbar('Failed to load role templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchRoleTemplates();
  }, [fetchRoleTemplates]);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormLabel('');
    setFormDescription('');
    setFormPermissions([]);
    setFormIsSystem(false);
    setFormColor('default');
    setDialogOpen(true);
  };

  const handleOpenEdit = (template) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormLabel(template.label);
    setFormDescription(template.description || '');
    setFormPermissions(template.permissions || []);
    setFormIsSystem(template.isSystem || false);
    setFormColor(template.color || 'default');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleTogglePermission = (permKey) => {
    setFormPermissions(prev => {
      if (prev.includes(permKey)) {
        return prev.filter(p => p !== permKey);
      }
      return [...prev, permKey];
    });
  };

  const handleToggleWildcard = () => {
    setFormPermissions(prev => {
      if (prev.includes('*')) {
        return prev.filter(p => p !== '*');
      }
      return ['*'];
    });
  };

  const handleSave = async () => {
    if (!formLabel.trim()) {
      showSnackbar('Label is required', 'error');
      return;
    }

    try {
      if (editingTemplate) {
        const result = await updateRoleTemplate({
          id: editingTemplate.id,
          label: formLabel,
          description: formDescription,
          permissions: formPermissions,
          color: formColor,
        });
        if (result && !result.error) {
          showSnackbar('Role template updated', 'success');
          fetchRoleTemplates();
        } else {
          showSnackbar(result?.error || 'Failed to update', 'error');
        }
      } else {
        if (!formName.trim()) {
          showSnackbar('Name is required for new templates', 'error');
          return;
        }
        const result = await createRoleTemplate({
          name: formName.toLowerCase().replace(/\s+/g, '_'),
          label: formLabel,
          description: formDescription,
          permissions: formPermissions,
          isSystem: false,
          color: formColor,
        });
        if (result && !result.error) {
          showSnackbar('Role template created', 'success');
          fetchRoleTemplates();
        } else {
          showSnackbar(result?.error || 'Failed to create', 'error');
        }
      }
      handleCloseDialog();
    } catch (error) {
      showSnackbar('Error saving role template', 'error');
    }
  };

  const handleOpenDelete = (template) => {
    setEditingTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    try {
      const result = await deleteRoleTemplate(editingTemplate.id);
      if (result && !result.error) {
        showSnackbar('Role template deleted', 'success');
        fetchRoleTemplates();
      } else {
        showSnackbar(result?.error || 'Failed to delete', 'error');
      }
    } catch (error) {
      showSnackbar('Error deleting role template', 'error');
    }
    setDeleteDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleReconcile = async (dryRun) => {
    setReconcileLoading(true);
    try {
      const res = await fetch('/api/admin/reconcile-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (res.ok) {
        setReconcileResult(data);
        if (!dryRun) {
          showSnackbar(`Reconciled ${data.membersUpdated} members (${data.grantsAdded} grants added)`, 'success');
        }
      } else {
        showSnackbar(data.error || 'Reconciliation failed', 'error');
      }
    } catch (error) {
      showSnackbar('Error running reconciliation', 'error');
    } finally {
      setReconcileLoading(false);
    }
  };

  const handleNameBlur = useCallback(() => {
    const formattedName = formatName(formName);
    if (formattedName !== formName) {
      setFormName(formattedName);
    }
  }, [formName]);

  const hasWildcard = formPermissions.includes('*');

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Permissions Management
      </Typography>

      {/* Section 1: Permission Registry */}
      <Paper sx={{ mb: 4, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Permission Registry
          </Typography>
          <Tooltip title="Permission keys are defined in code. To add new permissions, update app/config/permissions.js">
            <InfoOutlinedIcon sx={{ color: 'primary.main', cursor: 'pointer' }} />
          </Tooltip>
        </Box>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          All available permission keys defined in code. These cannot be modified from the UI.
        </Typography>

        {categories.map(category => (
          <Accordion key={category} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{category}</Typography>
              <Chip label={getPermissionsByCategory(category).length} size="small" sx={{ ml: 1 }} />
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Key</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Label</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getPermissionsByCategory(category).map(perm => (
                      <TableRow key={perm.key}>
                        <TableCell>
                          <Chip label={perm.key} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
                        </TableCell>
                        <TableCell>{perm.label}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{perm.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        ))}
      </Paper>

      {/* Section 2: Default Role Templates */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Default Role Templates
            </Typography>
            <Tooltip title="These role templates are available to all teams. System roles (owner, admin, member) cannot be deleted but their permissions can be updated.">
              <InfoOutlinedIcon sx={{ color: 'primary.main', cursor: 'pointer' }} />
            </Tooltip>
          </Box>
          <Button variant="primary" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            Add Role Template
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Label</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Permissions</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>System</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 100 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roleTemplates.map(template => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <Chip label={template.name} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                    </TableCell>
                    <TableCell>{template.label}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', maxWidth: 200 }}>{template.description}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {template.permissions?.includes('*') ? (
                          <Chip label="All Permissions (*)" size="small" color="primary" />
                        ) : (
                          template.permissions?.map(p => (
                            <Chip key={p} label={p} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                          ))
                        )}
                        {(!template.permissions || template.permissions.length === 0) && (
                          <Typography variant="body2" color="text.secondary">None</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {template.isSystem ? <Chip label="System" size="small" color="info" /> : 'No'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" onClick={() => handleOpenEdit(template)} title="Edit">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {!template.isSystem && (
                          <IconButton size="small" onClick={() => handleOpenDelete(template)} title="Delete" sx={{ color: 'error.main' }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {roleTemplates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No role templates found. Create the default system roles (owner, admin, member) to get started.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Section 3: Reconcile Permissions */}
      <Paper sx={{ p: 3, mt: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Reconcile Permissions
          </Typography>
          <Tooltip title="Scans every team database and ensures each member's grants include all permissions from their assigned roles. Run a preview first to see what would change.">
            <InfoOutlinedIcon sx={{ color: 'primary.main', cursor: 'pointer' }} />
          </Tooltip>
        </Box>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          This process reads each TeamMember document across all teams, resolves the permissions from their
          roles (using both global and team-specific role templates), and adds any missing permissions to
          their grants array. Existing grants are never removed.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button
            variant="secondary"
            startIcon={reconcileLoading ? <CircularProgress size={16} /> : <SyncIcon />}
            onClick={() => handleReconcile(true)}
            disabled={reconcileLoading}
          >
            Preview (Dry Run)
          </Button>
          <Button
            variant="primary"
            startIcon={reconcileLoading ? <CircularProgress size={16} /> : <CheckCircleOutlineIcon />}
            onClick={() => handleReconcile(false)}
            disabled={reconcileLoading || (reconcileResult && reconcileResult.dryRun && reconcileResult.membersUpdated === 0)}
          >
            Apply Changes
          </Button>
        </Box>

        {reconcileResult && (
          <Box sx={{ mt: 2 }}>
            <Alert severity={reconcileResult.dryRun ? 'info' : 'success'} sx={{ mb: 2 }}>
              {reconcileResult.dryRun ? 'Dry run complete — no changes were written.' : 'Reconciliation complete — grants have been updated.'}
              {' '}{reconcileResult.teamsProcessed} teams processed, {reconcileResult.membersScanned} members scanned,
              {' '}{reconcileResult.membersUpdated} members {reconcileResult.dryRun ? 'would be' : ''} updated
              {' '}({reconcileResult.grantsAdded} grants {reconcileResult.dryRun ? 'to add' : 'added'}).
            </Alert>

            {reconcileResult.details.length > 0 ? (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Team</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>NUID</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Roles</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Grants {reconcileResult.dryRun ? 'to Add' : 'Added'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reconcileResult.details.map((d, i) => (
                      d.error ? (
                        <TableRow key={i}>
                          <TableCell>{d.teamName}</TableCell>
                          <TableCell colSpan={3}>
                            <Typography color="error" variant="body2">{d.error}</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow key={i}>
                          <TableCell>{d.teamName}</TableCell>
                          <TableCell>
                            <Chip label={d.nuid} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {d.roles.map(r => (
                                <Chip key={r} label={r} size="small" />
                              ))}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {d.added.map(g => (
                                <Chip key={g} label={g} size="small" variant="outlined" color="success" sx={{ fontSize: '0.75rem' }} />
                              ))}
                            </Box>
                          </TableCell>
                        </TableRow>
                      )
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                All members are already up to date — no grants need to be added.
              </Typography>
            )}
          </Box>
        )}
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingTemplate ? 'Edit Role Template' : 'Create Role Template'}</DialogTitle>
        <DialogContent>
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
              <ListItemText
                primary="All Permissions (*)"
                secondary="Grant all current and future permissions"
              />
            </ListItem>

            {!hasWildcard && categories.map(category => (
              <Box key={category}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: 'text.secondary' }}>
                  {category}
                </Typography>
                <List dense disablePadding>
                  {getPermissionsByCategory(category).map(perm => (
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
            {editingTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the role template &quot;{editingTemplate?.label}&quot;?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will not remove the role from existing team members, but they will no longer inherit permissions from this template.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <SnackbarComponent />
    </Box>
  );
};

export default PermissionsManagement;
