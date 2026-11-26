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
  IconButton,
  Box,
  Chip,
  Button
} from '@mui/material';
import {
  Edit as EditIcon,
  DeleteOutline as DeleteOutlineIcon,
  Add as AddIcon
} from '@mui/icons-material';
import TableWithActions, { ACTION_ICON_STYLES } from '@/app/admin/components/TableWithActions';
import EditDrawer from '@/app/admin/components/EditDrawer';
import DeleteConfirmationModal from '@/app/admin/components/DeleteConfirmationModal';
import { useTheme } from '@mui/material/styles';
import {
  getAllMcpServers,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer
} from '@/app/clientServices/mcpServerService';
import { useParams, useSearchParams } from 'next/navigation';

const APPROVAL_OPTIONS = ['never', 'always'];

const McpServersManagement = ({ showSnackbar, assistantId, teamName: propTeamName, assistantName: propAssistantName }) => {
  const theme = useTheme();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({
    serverLabel: '',
    serverUrl: '',
    requireApproval: 'never',
    allowedTools: [],
    enabled: true
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, itemName: '' });
  const [orderBy, setOrderBy] = useState('serverLabel');
  const [order, setOrder] = useState('asc');
  const [toolInput, setToolInput] = useState('');

  const teamName = propTeamName ?? useParams().teamName;
  const assistantName = propAssistantName ?? useSearchParams().get('assistant');

  useEffect(() => {
    const fetchServers = async () => {
      setLoading(true);
      try {
        const allServers = await getAllMcpServers(teamName, assistantName);
        const sorted = (allServers || []).sort((a, b) =>
          (a.serverLabel || '').localeCompare(b.serverLabel || '')
        );
        setServers(sorted);
      } catch (error) {
        setServers([]);
      }
      setLoading(false);
    };
    if (teamName && assistantName) {
      fetchServers();
    }
  }, [assistantName, teamName]);

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditData({
      serverLabel: item.serverLabel || '',
      serverUrl: item.serverUrl || '',
      requireApproval: item.requireApproval || 'never',
      allowedTools: item.allowedTools || [],
      enabled: item.enabled
    });
    setIsNew(false);
    setToolInput('');
    setDrawerOpen(true);
  };

  const handleAdd = () => {
    setEditingId(Date.now());
    setEditData({
      serverLabel: '',
      serverUrl: '',
      requireApproval: 'never',
      allowedTools: [],
      enabled: true
    });
    setIsNew(true);
    setToolInput('');
    setDrawerOpen(true);
  };

  const handleDelete = (id) => {
    const item = servers.find(p => p.id === id);
    setDeleteDialog({
      open: true,
      id: id,
      itemName: item ? item.serverLabel : 'Unknown'
    });
  };

  const handleToggleEnabled = async (id) => {
    try {
      const itemToUpdate = servers.find(item => item.id === id);
      if (itemToUpdate) {
        const updatedItem = {
          ...itemToUpdate,
          enabled: !itemToUpdate.enabled,
          type: 'McpServerConfig'
        };
        const saved = await updateMcpServer(updatedItem, teamName, assistantName);
        if (saved.error) {
          showSnackbar?.(saved.error, 'error', 5000);
          return;
        }
        setServers(servers.map(item => (item.id === id ? saved : item)));
      }
    } catch (error) {
      console.error('Error updating MCP server enabled state:', error);
      showSnackbar?.('Failed to update MCP server', 'error', 5000);
    }
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const addAllowedTool = () => {
    const tool = toolInput.trim();
    if (!tool) return;
    if (editData.allowedTools.includes(tool)) {
      setToolInput('');
      return;
    }
    setEditData({ ...editData, allowedTools: [...editData.allowedTools, tool] });
    setToolInput('');
  };

  const removeAllowedTool = (tool) => {
    setEditData({ ...editData, allowedTools: editData.allowedTools.filter(t => t !== tool) });
  };

  const columns = [
    {
      key: 'serverLabel',
      label: 'Server Label',
      sortable: true,
      width: '20%',
      render: (item) => (
        <Typography variant="subtitle1" sx={{ fontSize: '1.1rem' }} title={item.serverLabel}>
          {item.serverLabel}
        </Typography>
      )
    },
    {
      key: 'serverUrl',
      label: 'Server URL',
      sortable: true,
      width: '30%',
      render: (item) => (
        <Tooltip title={item.serverUrl} placement="top" arrow>
          <Typography
            variant="body2"
            sx={{
              fontSize: '1rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '280px',
              cursor: 'help'
            }}
          >
            {item.serverUrl}
          </Typography>
        </Tooltip>
      )
    },
    {
      key: 'requireApproval',
      label: 'Require Approval',
      sortable: true,
      width: '15%',
      render: (item) => (
        <Typography variant="body2" sx={{ fontSize: '1rem' }}>
          {item.requireApproval}
        </Typography>
      )
    },
    {
      key: 'allowedTools',
      label: 'Allowed Tools',
      sortable: false,
      width: '20%',
      render: (item) => (
        <Tooltip title={(item.allowedTools || []).join(', ')} placement="top" arrow>
          <Typography
            variant="body2"
            sx={{
              fontSize: '1rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '180px',
              cursor: 'help'
            }}
          >
            {(item.allowedTools || []).length > 0 ? item.allowedTools.join(', ') : 'All'}
          </Typography>
        </Tooltip>
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
      width: '6%',
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

  const handleSave = async () => {
    try {
      const trimmedLabel = editData.serverLabel.trim();

      const existing = servers.find(s =>
        (s.serverLabel || '').toLowerCase() === trimmedLabel.toLowerCase() &&
        (isNew || s.id !== editingId)
      );
      if (existing) {
        showSnackbar?.(`An MCP server with the label "${editData.serverLabel}" already exists. Please choose a different label.`, 'error', 5000);
        return;
      }

      if (isNew) {
        const newItem = {
          ...editData,
          serverLabel: trimmedLabel,
          assistantId: assistantId,
          type: 'McpServerConfig'
        };
        const saved = await createMcpServer(newItem, teamName, assistantName);
        if (saved.error) {
          showSnackbar?.(saved.error, 'error', 5000);
          return;
        }
        setServers([saved, ...servers]);
        showSnackbar?.('MCP server created successfully!', 'success');
      } else {
        const updatedItem = {
          ...editData,
          serverLabel: trimmedLabel,
          id: editingId,
          assistantId: assistantId,
          type: 'McpServerConfig'
        };
        const saved = await updateMcpServer(updatedItem, teamName, assistantName);
        if (saved.error) {
          showSnackbar?.(saved.error, 'error', 5000);
          return;
        }
        setServers(servers.map(item => (item.id === editingId ? saved : item)));
        showSnackbar?.('MCP server updated successfully!', 'success');
      }
      setEditingId(null);
      setIsNew(false);
      setDrawerOpen(false);
    } catch (error) {
      console.error('Error saving MCP server:', error);
      showSnackbar?.('Failed to save MCP server.', 'error', 5000);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      const itemToDelete = servers.find(item => item.id === deleteDialog.id);
      if (itemToDelete) {
        await deleteMcpServer(itemToDelete, teamName, assistantName);
        setServers(servers.filter(item => item.id !== deleteDialog.id));
        showSnackbar?.('MCP server deleted successfully!', 'success');
      }
    } catch (error) {
      console.error('Error deleting MCP server:', error);
      showSnackbar?.('Failed to delete MCP server.', 'error', 5000);
    } finally {
      setDeleteDialog({ open: false, id: null, itemName: '' });
    }
  };

  return (
    <>
      <TableWithActions
        title="MCP Servers"
        data={servers}
        loading={loading}
        columns={columns}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleEnabled={handleToggleEnabled}
        orderBy={orderBy}
        order={order}
        onSort={handleSort}
        emptyMessage="No MCP servers found"
        addButtonText="Add MCP Server"
      />

      <EditDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={isNew ? 'Add MCP Server' : `Configure: ${editData.serverLabel || ''}`}
        onSave={handleSave}
        onCancel={() => setDrawerOpen(false)}
        saveButtonText={isNew ? 'Create MCP server' : undefined}
        saveDisabled={
          !(editData.serverLabel || '').trim() ||
          !(editData.serverUrl || '').trim() ||
          !APPROVAL_OPTIONS.includes(editData.requireApproval)
        }
      >
        <TextField
          label="Server Label"
          value={editData.serverLabel}
          onChange={(e) => setEditData({ ...editData, serverLabel: e.target.value })}
          fullWidth
          variant="outlined"
          size="small"
          helperText="A unique label (e.g., hpais)"
          sx={{
            '& .MuiInputLabel-root': { fontSize: '1rem' },
            '& .MuiInputBase-input': { fontSize: '0.95rem', py: 1 },
            '& .MuiOutlinedInput-root': { backgroundColor: 'inherit' }
          }}
        />

        <TextField
          label="Server URL"
          value={editData.serverUrl}
          onChange={(e) => setEditData({ ...editData, serverUrl: e.target.value })}
          fullWidth
          variant="outlined"
          size="small"
          helperText="The MCP server endpoint URL"
          sx={{
            '& .MuiInputLabel-root': { fontSize: '1rem' },
            '& .MuiInputBase-input': { fontSize: '0.95rem', py: 1 },
            '& .MuiOutlinedInput-root': { backgroundColor: 'inherit' }
          }}
        />

        <FormControl fullWidth size="small">
          <InputLabel sx={{ fontSize: '1rem' }}>Require Approval</InputLabel>
          <Select
            value={editData.requireApproval}
            label="Require Approval"
            onChange={(e) => setEditData({ ...editData, requireApproval: e.target.value })}
            MenuProps={{ disableScrollLock: true }}
            sx={{
              fontSize: '0.95rem',
              borderRadius: '8px',
              '& .MuiSelect-select': { fontSize: '0.95rem' }
            }}
          >
            {APPROVAL_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt} sx={{ fontSize: '0.95rem' }}>
                {opt}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box>
          <Typography sx={{ fontSize: '1rem', mb: 1 }}>Allowed Tools</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="e.g., executeSqlQuery"
              value={toolInput}
              onChange={(e) => setToolInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addAllowedTool();
                }
              }}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.95rem' } }}
            />
            <Button variant="action" startIcon={<AddIcon />} onClick={addAllowedTool}>
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {editData.allowedTools.map((tool) => (
              <Chip key={tool} label={tool} onDelete={() => removeAllowedTool(tool)} />
            ))}
            {editData.allowedTools.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                No tools restricted (all tools allowed).
              </Typography>
            )}
          </Box>
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              checked={editData.enabled}
              onChange={(e) => setEditData({ ...editData, enabled: e.target.checked })}
              sx={{ '& .MuiSvgIcon-root': { fontSize: '1.4rem' } }}
            />
          }
          label={
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 500 }}>
              Enabled
            </Typography>
          }
          sx={{
            alignItems: 'center',
            '& .MuiFormControlLabel-label': { ml: 1 }
          }}
        />
      </EditDrawer>

      <DeleteConfirmationModal
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, id: null, itemName: '' })}
        onConfirm={handleConfirmDelete}
        itemName={deleteDialog.itemName}
        title="Delete MCP Server?"
        message="This will permanently delete"
      />
    </>
  );
};

export default McpServersManagement;