'use client';
import React, { useState, useEffect } from 'react';
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography,
  Tooltip,
  IconButton
  , Alert, Button, Box
} from '@mui/material';
import {
  Edit as EditIcon,
  DeleteOutline as DeleteOutlineIcon
} from '@mui/icons-material';
import TableWithActions, { ACTION_ICON_STYLES } from '@/app/admin/components/TableWithActions';
import EditDrawer from '@/app/admin/components/EditDrawer';
import DeleteConfirmationModal from '@/app/admin/components/DeleteConfirmationModal';
import { useTheme } from '@mui/material/styles';
import { useParams } from 'next/navigation';
import {
  getAllPrompts,
  createPrompt as createPromptService,
  updatePrompt as updatePromptService,
  deletePrompt as deletePromptService
} from '@/app/clientServices/promptLibraryService';
import { getAllPersonas } from '@/app/clientServices/personaService';

const PromptLibrary = ({ showSnackbar, personasTabRef, assistantName: propAssistantName, teamName: propTeamName }) => {
  const theme = useTheme();
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [personasList, setPersonasList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', associatedPersonas: [], details: '', category: '', enabled: true });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, itemName: '' });
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');

  const teamName = propTeamName ?? useParams().teamName;
  const assistantName = propAssistantName ?? useSearchParams().get('assistant');

  // Check if current assistant is case-360-assistant
  const isCase360Assistant = assistantName === 'case-360-assistant';

  const goToPersonasTab = () => {
    if (personasTabRef && personasTabRef.current) {
      try { personasTabRef.current.click(); } catch (e) { /* ignore */ }
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchPromptLibrary = async () => {
      setLoading(true);
      try {
        const res = await getAllPrompts(teamName, assistantName);
        setDetails(res);
      } catch (err) {
        if (!mounted) return;
        setDetails([]);
        showSnackbar?.('Failed to load details', 'error');
      } finally {
        mounted && setLoading(false);
      }
    };
    if (teamName && assistantName) fetchPromptLibrary();
    return () => { mounted = false; };
  }, [teamName, assistantName, showSnackbar]);

  // fetch personas (used by the Personas multi-select)
  useEffect(() => {
    let mounted = true;
    const fetchPersonas = async () => {
      try {
        const res = await getAllPersonas(teamName, assistantName);
        if (!mounted) return;
        const list = Array.isArray(res) ? res : [];
        setPersonasList(list);
      } catch (err) {
        if (!mounted) return;
        setPersonasList([]);
      }
    };
    if (teamName && assistantName) fetchPersonas();
    return () => { mounted = false; };
  }, [teamName, assistantName]);

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditData({
      name: item.name,
      associatedPersonas: item.associatedPersonas || [],
      details: item.details,
      category: item.category || '',
      enabled: item.enabled
    });
    setIsNew(false);
    setDrawerOpen(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    setEditData({
      name: '',
      associatedPersonas: [],
      details: '',
      category: '',
      enabled: true
    });
    setIsNew(true);
    setDrawerOpen(true);
  };

  const handleDelete = (id) => {
    const item = details.find(p => p.id === id);
    setDeleteDialog({
      open: true,
      id: id,
      itemName: item.name
    });
  };

  const handleConfirmDelete = async () => {
    try {
      await deletePromptService(teamName, assistantName, deleteDialog);
      setDetails(prev => prev.filter(item => item.id !== deleteDialog.id));
      showSnackbar?.('Prompt deleted successfully!', 'success');
    } catch (err) {
      showSnackbar?.('Failed to delete details', 'error');
    } finally {
      setDeleteDialog({ open: false, id: null, itemName: '' });
    }
  };

  const handleToggleEnabled = (id) => {
    // toggle locally and persist change; allow multiple enabled details
    const target = details.find(p => p.id === id);
    if (!target) return;
    const updatedItem = { ...target, enabled: !target.enabled };
    setDetails(prev => prev.map(item => item.id === id ? updatedItem : item));
    (async () => {
      try {
        await updatePromptService(teamName, assistantName, updatedItem);
        showSnackbar?.(updatedItem.enabled ? 'Prompt enabled' : 'Prompt disabled', 'success');
      } catch (err) {
        // rollback on failure
        setDetails(prev => prev.map(item => item.id === id ? target : item));
        showSnackbar?.('Failed to update details', 'error');
      }
    })();
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const allColumns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      width: isCase360Assistant ? '22%' : '18%',
      render: (item) => (
        <Typography variant="subtitle1" sx={{ fontSize: '1.1rem' }}>
          {item.name}
        </Typography>
      )
    },
    {
      key: 'personas',
      label: 'Personas',
      sortable: true,
      width: '18%',
      render: (item) => (
        <Typography
          variant="body2"
          sx={{
            fontSize: '1rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {(item.associatedPersonas || []).join(', ')}
        </Typography>
      )
    },
    {
      key: 'details',
      label: 'Prompt',
      sortable: true,
      width: isCase360Assistant ? '40%' : '32%',
      render: (item) => (
        <Tooltip
          title={item.details}
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
            {item.details}
          </Typography>
        </Tooltip>
      )
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      width: '13%',
      render: (item) => (
        <Typography
          variant="body2"
          sx={{
            fontSize: '1rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={item.category}
        >
          {item.category}
        </Typography>
      )
    },
    {
      key: 'delete',
      label: 'Delete',
      width: '7%',
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
      width: '7%',
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
      width: '7%',
      align: 'center',
      render: (item) => (
        <Checkbox
          checked={item.enabled}
          onChange={() => handleToggleEnabled(item.id)}
          size="medium"
          sx={ACTION_ICON_STYLES.enabled(theme)}
        />
      )
    }
  ];

  // Filter out Personas column for case-360-assistant
  const columns = isCase360Assistant
    ? allColumns.filter(col => col.key !== 'personas')
    : allColumns;

  const renderPromptLibraryContent = () => {
    const handleSave = () => {
      (async () => {
        try {
          // Check for duplicate names
          const trimmedName = editData.name.trim();
          const existingPrompt = details.find(p =>
            p.name.toLowerCase() === trimmedName.toLowerCase() &&
            (isNew || p.id !== editingId)
          );

          if (existingPrompt) {
            showSnackbar?.(`A prompt with the name "${trimmedName}" already exists. Please choose a different name.`, 'error');
            return;
          }

          if (isNew) {
            const created = await createPromptService(teamName, assistantName, editData);

            // re-check for existing prompt
            if (created.error) {
              showSnackbar?.('A persona with this name already exists.', 'error');
              return;
            }

            setDetails(prev => [created, ...prev]);
            showSnackbar?.('Prompt created successfully!', 'success');
          } else {
            const payload = { id: editingId, ...editData };
            const updated = await updatePromptService(teamName, assistantName, payload);
            if (updated.error) {
              showSnackbar?.('A persona with this name already exists.', 'error');
              return;
            }
            setDetails(prev => prev.map(item => (item.id === updated.id ? updated : item)));
            showSnackbar?.('Prompt updated successfully!', 'success');
          }
          setEditingId(null);
          setIsNew(false);
          setDrawerOpen(false);
        } catch (err) {
          showSnackbar?.('Failed to save details', 'error');
        }
      })();
    };

    return (
      <>
        <TableWithActions
          title="Prompt Library"
          data={details}
          loading={loading}
          columns={columns}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleEnabled={handleToggleEnabled}
          orderBy={orderBy}
          order={order}
          onSort={handleSort}
          emptyMessage="No details found"
          addButtonText="New Prompt"
        />

        <EditDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={
            isNew ? 'New Prompt' : `Edit: ${editData.name || ''}`
          }
          onSave={handleSave}
          onCancel={() => setDrawerOpen(false)}
          saveButtonText={
            isNew
              ? 'Create new prompt'
              : undefined
          }
          saveDisabled={!editData.details.trim()}
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
            label="Category"
            value={editData.category}
            onChange={(e) => setEditData({ ...editData, category: e.target.value })}
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

          {!isCase360Assistant && (
            <FormControl fullWidth size="small">
              {personasList && personasList.length > 0 ? (
                <InputLabel sx={{ fontSize: '1rem' }}>Personas</InputLabel>
              ) : (
                <Typography sx={{ fontSize: '1rem', mb: 1 }}>Personas</Typography>
              )}
              {(!personasList || personasList.length === 0) ? (
                <Alert severity="info" sx={{ py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>No Personas available to associate — please create one in the Personas tab.</span>
                  <Button size="small" onClick={goToPersonasTab}>Go to Personas</Button>
                </Alert>
              ) : (
                <Select
                  multiple
                  value={editData.associatedPersonas}
                  label="Personas"
                  onChange={(e) => setEditData({ ...editData, associatedPersonas: e.target.value })}
                  renderValue={(selected) => (selected || []).join(', ')}
                  MenuProps={{ disableScrollLock: true }}
                  sx={{
                    '& .MuiInputLabel-root': { fontSize: '1rem' },
                    '& .MuiInputBase-input': { fontSize: '0.95rem', py: 1 },
                    '& .MuiOutlinedInput-root': { backgroundColor: 'inherit' }
                  }}
                >
                  {personasList.map((persona) => (
                    <MenuItem key={persona.id} value={persona.name} sx={{ fontSize: '0.95rem' }}>
                      <Checkbox
                        checked={(editData.associatedPersonas || []).includes(persona.name)}
                        sx={{ mr: 1, p: 0.5 }}
                      />
                      <Typography sx={{ fontSize: '0.95rem' }}>{persona.name}</Typography>
                    </MenuItem>
                  ))}
                </Select>
              )}
            </FormControl>
          )}

          <TextField
            label="User Prompt"
            value={editData.details}
            onChange={(e) => setEditData({ ...editData, details: e.target.value })}
            multiline
            minRows={6}
            maxRows={40}
            fullWidth
            variant="outlined"
            size="small"
            helperText="Define the AI's system behavior and instructions with additional user context."
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

        <DeleteConfirmationModal
          open={deleteDialog.open}
          onClose={() => setDeleteDialog({ ...deleteDialog, open: false })}
          onConfirm={handleConfirmDelete}
          itemName={deleteDialog.itemName}
          title="Delete Prompt?"
          message="This will permanently delete"
        />
      </>
    );
  };

  return renderPromptLibraryContent();
};

export default PromptLibrary;