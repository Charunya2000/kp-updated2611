'use client';
import React, { useState, useEffect } from 'react';
import {
  TextField,
  FormControlLabel,
  Checkbox,
  Typography,
  Tooltip,
  IconButton
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Edit as EditIcon,
  DeleteOutline as DeleteOutlineIcon
} from '@mui/icons-material';
import TableWithActions, { ACTION_ICON_STYLES } from '@/app/admin/components/TableWithActions';
import EditDrawer from '@/app/admin/components/EditDrawer';
import DeleteConfirmationModal from '@/app/admin/components/DeleteConfirmationModal';
import { useTheme } from '@mui/material/styles';
import { useParams, useSearchParams } from 'next/navigation';

import {
  getAllSystemPrompts,
  createSystemPrompt,
  updateSystemPrompt,
  deleteSystemPrompt
} from '@/app/clientServices/systemPromptService';

const SystemPrompts = ({
  showSnackbar,
  teamName: propTeamName, // value passed from AdminTabs
  assistantName: propAssistantName, // value passed from AdminTabs
}) => {
  const theme = useTheme();
  const [systemPrompts, setSystemPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', prompt: '', default: true, type: 'SystemPrompt' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, });
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');

  const teamName = propTeamName ?? useParams();
  const assistantName = propAssistantName ?? useSearchParams().get('assistant');

  useEffect(() => {
    async function fetchPrompts() {
      setLoading(true);
      try {
        const prompts = await getAllSystemPrompts(teamName, assistantName);
        setSystemPrompts(prompts);
      } catch (e) {
        setSystemPrompts([]);
      }
      setLoading(false);
    }
    // refetch when teamName and assistantName changes
    if (teamName && assistantName) fetchPrompts();
  }, [teamName, assistantName]);

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      width: '25%',
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
      width: '50%',
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
      key: 'default',
      // keep label inline so the info icon appears immediately next to the word "Default"
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Default
          <Tooltip title="Only one system prompt can be chosen at a time" placement="top" arrow>
            <InfoOutlinedIcon fontSize="small" />
          </Tooltip>
        </span>
      ),
      width: '9%',
      align: 'center',
      render: (item) => (
        <Checkbox
          checked={!!item.default}
          onChange={() => handleToggleDefaultPrompt(item.id)}
          size="medium"
          sx={ACTION_ICON_STYLES.enabled(theme)}
        />
      )
    }
  ];

  // Specifically enable rendering of the system prompt id
  const isSystemPromptDisplayEnabled = teamName === 'customer-and-contracts';

  // Render System Prompts content function
  const renderSystemPromptsContent = () => {
    return (
      <>
        <TableWithActions
          title="System Prompt"
          data={systemPrompts}
          loading={loading}
          columns={columns}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleEnabled={handleToggleDefaultPrompt}
          orderBy={orderBy}
          order={order}
          onSort={handleSort}
          emptyMessage="No system prompts found"
          addButtonText="New Prompt"
        />

        <EditDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={
            isNew
              ? 'New Prompt'
              : `Edit: ${editData.name}`
          }
          subtitle={isSystemPromptDisplayEnabled && editingId}
          onSave={() => handleSave()}
          onCancel={() => setDrawerOpen(false)}
          saveButtonText={
            isNew
              ? 'Create new prompt'
              : undefined
          }
          saveDisabled={!editData.name.trim() || !editData.prompt.trim()}
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
            label="System Prompt"
            value={editData.prompt}
            onChange={(e) => setEditData({ ...editData, prompt: e.target.value })}
            multiline
            minRows={6}
            maxRows={40}
            fullWidth
            variant="outlined"
            size="small"
            helperText="Define the AI's system behavior and instructions"
            sx={{
              '& .MuiInputBase-root': {
                overflow: 'hidden',
                backgroundColor: 'inherit',
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
                checked={editData.default}
                onChange={(e) => setEditData({ ...editData, default: e.target.checked })}
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
                Set as default
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
          onConfirm={() => handleConfirmDelete()}
          itemName={deleteDialog.itemName}
          title="Delete System Prompt?"
          message="This will permanently delete"
        />
      </>
    );
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditData({
      name: item.name,
      prompt: item.prompt,
      default: !!(item.default),
      type: 'SystemPrompt'
    });
    setIsNew(false);
    setDrawerOpen(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    setEditData({
      name: '',
      prompt: '',
      default: true,
      type: 'SystemPrompt'
    });
    setIsNew(true);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      // Check for duplicate names
      const trimmedName = editData.name.trim();
      const existingPrompt = systemPrompts.find(p =>
        p.name.toLowerCase() === trimmedName.toLowerCase() &&
        (isNew || p.id !== editingId)
      );

      if (existingPrompt) {
        showSnackbar?.(`A system prompt with the name "${trimmedName}" already exists. Please choose a different name.`, 'error');
        return;
      }

      let updatedPrompts = [...systemPrompts];

      // if marking this prompt as default, unset default on others
      if (editData.default) {
        updatedPrompts = updatedPrompts.map(p => ({ ...p, default: false }));
      }

      if (isNew) {
        const newPrompt = { ...editData };
        const created = await createSystemPrompt(teamName, assistantName, newPrompt);

        // re-check for existing prompt
        if (created.error) {
          showSnackbar?.('A system prompt with this name already exists.', 'error');
          return;
        }
        setSystemPrompts([created, ...updatedPrompts]);
        showSnackbar?.('System prompt created successfully!', 'success');
      } else {
        const updatedPrompt = { ...editData, id: editingId };
        const updated = await updateSystemPrompt(teamName, assistantName, updatedPrompt);

        if (updated.error) {
          showSnackbar?.('A system prompt with this name already exists.', 'error');
          return;
        }
        setSystemPrompts(
          updatedPrompts.map(p => p.id === updated.id ? updated : p)
        );
        showSnackbar?.('System prompt updated successfully!', 'success');
      }
    } catch (e) {
      showSnackbar?.('Failed to save system prompt', 'error');
    }
    setEditingId(null);
    setIsNew(false);
    setDrawerOpen(false);
  };

  const handleDelete = (id) => {
    const item = systemPrompts.find(p => p.id === id);
    setDeleteDialog({
      open: true,
      id: id,
      itemName: item ? item.name : 'Unknown'
    });
  };

  const handleConfirmDelete = async () => {
    try {

      await deleteSystemPrompt(teamName, assistantName, deleteDialog);
      setSystemPrompts(systemPrompts.filter(item => item.id !== deleteDialog.id));
      showSnackbar?.('System prompt deleted successfully!', 'success');
    } catch (e) {
      showSnackbar?.('Failed to delete system prompt', 'error');
    }
    setDeleteDialog({ open: false, id: null, itemName: '' });
  };

  const handleToggleDefaultPrompt = async (id) => {
    const toggled = systemPrompts.find(item => item.id === id);

    const willBeDefault = !toggled?.default;

    // set default true for target, false for others
    const updatedList = systemPrompts.map(item =>
      item.id === id ? { ...item, default: willBeDefault } : { ...item, default: false }
    );
    setSystemPrompts(updatedList);

    // Persist the change for all affected prompts
    try {
      for (const prompt of updatedList) {
        await updateSystemPrompt(teamName, assistantName, prompt);
      }
    } catch (e) {
    }
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  return renderSystemPromptsContent();
};

export default SystemPrompts;