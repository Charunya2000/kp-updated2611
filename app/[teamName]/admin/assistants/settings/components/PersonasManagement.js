'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  TableSortLabel,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  DeleteOutline as DeleteOutlineIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import TableWithActions, { ACTION_ICON_STYLES } from '@/app/admin/components/TableWithActions';
import EditDrawer from '@/app/admin/components/EditDrawer';
import DeleteConfirmationModal from '@/app/admin/components/DeleteConfirmationModal';
import { useParams, useSearchParams } from 'next/navigation';

import {
  getAllPersonas,
  createPersona,
  updatePersona,
  deletePersona
} from '@/app/clientServices/personaService';
import { getAllGraphConfigurations } from '@/app/clientServices/graphConfigurationService';

const Personas = ({ showSnackbar, assistantName: propAssistantName, teamName: propTeamName }) => {
  const theme = useTheme();
  const [graphs, setGraphs] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', prompt: '', enabled: true, associatedGraph: '' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isNewPersona, setIsNewPersona] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, personaName: '' });
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');

  const teamName = propTeamName ?? useParams().teamName;
  const assistantName = propAssistantName ?? useSearchParams().get('assistant');

  useEffect(() => {
    let mounted = true;
    const fetchPersonas = async () => {
      setLoading(true);
      try {
        const res = await getAllPersonas(teamName, assistantName);
        if (!mounted) return;
        setPersonas(Array.isArray(res) ? res : []);
      } catch (err) {
        if (!mounted) return;
        setPersonas([]);
        showSnackbar('Failed to load personas', 'error');
      } finally {
        mounted && setLoading(false);
      }
    };

    const fetchGraphs = async () => {
      // Placeholder for fetching graphs if needed for associatedGraph options
      try {
        const graphList = await getAllGraphConfigurations(teamName);
        setGraphs(graphList);
      } catch (err) {
        setGraphs([]);
        showSnackbar('Failed to load graphs', 'error');
      }
    }

    if (teamName && assistantName) {
      fetchPersonas();
      fetchGraphs();
    }
    return () => { mounted = false; };
  }, [teamName, assistantName, showSnackbar]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleEdit = (persona) => {
    setEditingId(persona.id);
    setEditData({
      name: persona.name || '',
      prompt: persona.prompt || '',
      enabled: !!persona.enabled,
      associatedGraph: persona.associatedGraph || 'Default Graph'
    });
    setIsNewPersona(false);
    setDrawerOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({ name: '', prompt: '', enabled: true, associatedGraph: 'Default Graph' });
    setIsNewPersona(false);
    setDrawerOpen(false);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setEditData({ name: '', prompt: '', enabled: true, associatedGraph: 'Default Graph' });
    setIsNewPersona(true);
    setDrawerOpen(true);
  };

  const handleDelete = (id) => {
    const persona = personas.find(p => p.id === id);
    setDeleteDialog({
      open: true,
      id: id,
      name: persona ? (persona.name) : 'Unknown'
    });
  };

  const handleCancelDelete = () => {
    setDeleteDialog({ ...deleteDialog, open: false });
  };

  const handleToggleEnabled = async (id) => {
    const toggled = personas.find(p => p.id === id);
    if (!toggled) return;
    const updatedPersona = { ...toggled, enabled: !toggled.enabled };
    setPersonas(prev => prev.map(p => p.id === id ? updatedPersona : p));
    try {
      const updated = await updatePersona(teamName, assistantName, updatedPersona);
      setPersonas(prev => prev.map(p => p.id === updated.id ? updated : p));
      showSnackbar?.(updatedPersona.enabled ? 'Persona enabled' : 'Persona disabled', 'success');
    } catch (err) {
      setPersonas(prev => prev.map(p => p.id === id ? toggled : p));
      showSnackbar?.('Failed to update persona', 'error');
    }
  };

  const handleSave = async () => {
    try {
      // Check for duplicate names
      const trimmedName = editData.name.trim();
      const existingPersona = personas.find(p =>
        p.name.toLowerCase() === trimmedName.toLowerCase() &&
        (isNewPersona || p.id !== editingId)
      );

      if (existingPersona) {
        showSnackbar?.(`A persona with the name "${trimmedName}" already exists. Please choose a different name.`, 'error');
        return;
      }

      if (isNewPersona) {
        const personaData = {
          name: editData.name,
          prompt: editData.prompt,
          enabled: editData.enabled,
          associatedGraph: editData.associatedGraph
        };
        const created = await createPersona(teamName, assistantName, personaData);
        // re-check for existing prompt
        if (created.error) {
          showSnackbar?.('A persona with this name already exists.', 'error');
          return;
        }
        setPersonas(prev => [created, ...prev]);
        showSnackbar?.('Persona created successfully!', 'success');
      } else {
        const personaData = {
          id: editingId,
          name: editData.name,
          prompt: editData.prompt,
          enabled: editData.enabled,
          associatedGraph: editData.associatedGraph
        };
        const updated = await updatePersona(teamName, assistantName, personaData);
        if (updated.error) {
          showSnackbar?.('A persona with this name already exists.', 'error');
          return;
        }
        setPersonas(prev => prev.map(p => (p.id === updated.id ? updated : p)));
        showSnackbar?.('Persona updated successfully!', 'success');
      }
      setEditingId(null);
      setIsNewPersona(false);
      setDrawerOpen(false);
    } catch (err) {
      showSnackbar?.('Failed to create persona', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    const deletePersonaData = deleteDialog;
    try {
      await deletePersona(teamName, assistantName, deletePersonaData);
      setPersonas(prev => prev.filter(p => p.id !== deletePersonaData.id));
      showSnackbar?.('Persona deleted successfully!', 'success');
    } catch (err) {
      showSnackbar?.('Failed to delete persona', 'error');
    } finally {
      setDeleteDialog({ open: false, id: null, name: '' });
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      width: '15%',
      render: (item) => (
        <Typography variant="subtitle1" sx={{ fontSize: '1.1rem' }}>
          {item.name}
        </Typography>
      )
    },
    {
      key: 'prompt',
      label: 'Prompt',
      sortable: true,
      width: '35%',
      render: (item) => (
        <Tooltip
          title={item.prompt}
          placement="top"
          arrow
          sx={{
            '& .MuiTooltip-tooltip': {
              fontSize: '0.9rem',
              maxWidth: '400px',
              lineHeight: 1.4,
              padding: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.9)'
            }
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.4,
              fontSize: '1rem',
              cursor: 'help',
              maxWidth: '400px'
            }}
          >
            {item.prompt}
          </Typography>
        </Tooltip>
      )
    },
    {
      key: 'associatedGraph',
      label: 'Assigned Graph',
      sortable: true,
      width: '18%',
      render: (item) => (
        <Typography variant="body2" sx={{ fontSize: '1rem' }}>
          {item.associatedGraph || 'Default Graph'}
        </Typography>
      )
    },
    {
      key: 'delete',
      label: 'Delete',
      width: '8%',
      align: 'center',
      render: (item) => (
        <IconButton
          color="error"
          onClick={() => handleDelete(item.id)}
          size="medium"
          sx={ACTION_ICON_STYLES.delete}
        >
          <DeleteOutlineIcon sx={{ fontSize: '1.6rem' }} />
        </IconButton>
      )
    },
    {
      key: 'edit',
      label: 'Edit',
      width: '8%',
      align: 'center',
      render: (item) => (
        <IconButton
          onClick={() => handleEdit(item)}
          size="medium"
          sx={ACTION_ICON_STYLES.edit}
        >
          <EditIcon sx={{ fontSize: '1.6rem' }} />
        </IconButton>
      )
    },
    {
      key: 'enabled',
      label: 'Enabled',
      width: '9%',
      align: 'center',
      render: (item) => (
        <Checkbox
          checked={!!item.enabled}
          onChange={() => handleToggleEnabled(item.id)}
          size="medium"
          sx={ACTION_ICON_STYLES.enabled(theme)}
        />
      )
    }
  ];

  // compute sorted list for table (alphabetical by selected column)
  const sortedPersonas = useMemo(() => {
    if (!Array.isArray(personas)) return [];
    const getVal = (p) => {
      if (orderBy === 'name') return ((p.name) || '').toString().toLowerCase();
      if (orderBy === 'prompt') return ((p.prompt) || '').toString().toLowerCase();
      if (orderBy === 'associatedGraph') return ((p.associatedGraph || 'Default Graph')).toString().toLowerCase();
      return '';
    };
    return [...personas].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av < bv) return order === 'asc' ? -1 : 1;
      if (av > bv) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }, [personas, order, orderBy]);

  // Specifically enable rendering of the system prompt id
  const isSystemPromptDisplayEnabled = teamName === 'customer-and-contracts';

  // Snackbar and save/delete logic
  const renderPersonasContent = () => {
    return (
      <>
        <TableWithActions
          title="Personas"
          data={sortedPersonas}
          loading={loading}
          columns={columns}
          onAdd={handleAddNew}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleEnabled={handleToggleEnabled}
          orderBy={orderBy}
          order={order}
          onSort={handleRequestSort}
          emptyMessage="No personas found"
          addButtonText="New Persona"
        />

        {/* Drawer for add/edit */}
        <EditDrawer
          open={drawerOpen}
          onClose={handleCancelEdit}
          title={isNewPersona ? 'New Persona' : `Edit: ${editData.name || ''}`}
          subtitle={isSystemPromptDisplayEnabled && editingId}
          onSave={handleSave}
          onCancel={handleCancelEdit}
          saveButtonText={isNewPersona ? 'Create new persona' : undefined}
          saveDisabled={!editData.name?.trim()}
        >
          <TextField
            label="Name"
            value={editData.name}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            fullWidth
            variant="outlined"
            size="small"
            sx={{
              '& .MuiInputLabel-root': {
                fontSize: '1rem'
              },
              '& .MuiInputBase-input': {
                fontSize: '0.95rem',
                py: 1
              },
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'inherit',
              }
            }}
          />

          <TextField
            label="Prompt"
            value={editData.prompt}
            onChange={(e) => setEditData({ ...editData, prompt: e.target.value })}
            multiline
            minRows={4}
            maxRows={40}
            fullWidth
            variant="outlined"
            size="small"
            helperText="Define the AI's role and behavior"
            sx={{
              '& .MuiInputBase-root': {
                overflow: 'hidden',
                backgroundColor: 'inherit',
              },
              '& .MuiInputBase-input': {
                overflow: 'auto',
                resize: 'none',
                fontSize: '0.95rem'
              },
              '& .MuiInputLabel-root': {
                fontSize: '1rem'
              },
              '& .MuiFormHelperText-root': {
                fontSize: '0.85rem'
              }
            }}
          />

          <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: '1rem' }}>Associated Graph</InputLabel>
            <Select
              value={editData.associatedGraph || 'Default Graph'}
              label="Associated Graph"
              onChange={(e) => setEditData({ ...editData, associatedGraph: e.target.value })}
              MenuProps={{
                disableScrollLock: true,
              }}
              sx={{
                fontSize: '0.95rem',
                height: 40,
                borderRadius: '8px',
                '& .MuiSelect-select': {
                  fontSize: '0.95rem',
                },
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'inherit',
                }
              }}
            >
              <MenuItem value="Default Graph" sx={{ fontSize: '0.95rem' }}>
                Default Graph
              </MenuItem>
              <MenuItem value="DBA" sx={{ fontSize: '0.95rem' }}>DBA</MenuItem>
              {graphs.map((graph) => (
                <MenuItem
                  key={graph.id}
                  value={graph.id}
                  sx={{ fontSize: '0.95rem' }}
                >
                  {graph.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={editData.enabled}
                onChange={(e) => setEditData({ ...editData, enabled: e.target.checked })}
                sx={{
                  '& .MuiSvgIcon-root': {
                    fontSize: '1.4rem',
                  }
                }}
              />
            }
            label={
              <Typography sx={{
                fontSize: '0.95rem',
                fontWeight: 500
              }}>
                Enabled
              </Typography>
            }
            sx={{
              alignItems: 'center',
              '& .MuiFormControlLabel-label': {
                ml: 1
              }
            }}
          />
        </EditDrawer>

        {/* Delete dialog */}
        <DeleteConfirmationModal
          open={deleteDialog.open}
          onClose={handleCancelDelete}
          onConfirm={handleConfirmDelete}
          itemName={deleteDialog.name}
          title="Delete Persona?"
          message="This will permanently delete"
        />
      </>
    );
  };

  return renderPersonasContent();
};

export default Personas;
