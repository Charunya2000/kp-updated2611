"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Typography, Tooltip, IconButton, Checkbox, TextField, FormControlLabel, Select, FormControl, Box, FormHelperText } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TableWithActions from "@/app/admin/components/TableWithActions";
import EditDrawer from "@/app/admin/components/EditDrawer";
import DeleteConfirmationModal from "@/app/admin/components/DeleteConfirmationModal";
import { InfoOutlined } from "@mui/icons-material";
import { ACTION_ICON_STYLES } from "@/app/admin/components/TableWithActions";
import { useTheme } from "@mui/material/styles";
import { createChatCompletionConfigs, deleteChatCompletionConfigs, getAllChatCompletionConfigss, updateChatCompletionConfigs } from "@/app/clientServices/chatCompletionServiceConfig";
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';

// Maps actual DB model values to UI display labels
const MODEL_DISPLAY_MAP = {
  'gpt-4o': 'GPT-5.1'
};

// Maps UI display labels back to actual DB model values
const MODEL_VALUE_MAP = {
  'GPT-5.1': 'gpt-4o',
};

const ChatCompletionConfigManagement = ({ showSnackbar, assistantName, teamName }) => {
  const theme = useTheme();

  const [chatCompletions, setChatCompletions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderBy, setOrderBy] = useState("name");
  const [order, setOrder] = useState("asc");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: "", temperature: 0.7, max_completion_tokens: 4000, model: "gpt-4o", default: false });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, itemName: "" });

  // Fetch Completion Configs on mount or when teamName/assistantName changes
  useEffect(() => {
    async function fetchAllCompletions() {
      setLoading(true);
      try {
        const data = await getAllChatCompletionConfigss(teamName, assistantName);
        setChatCompletions(Array.isArray(data) ? data : []);
      } catch (err) {
        setChatCompletions([]);
      }
      setLoading(false);
    }
    if (teamName && assistantName) fetchAllCompletions();
  }, [teamName, assistantName]);

  // Sorting logic
  const sortedRows = useMemo(() => {
    const getVal = (row) => row[orderBy];
    return [...chatCompletions].sort((a, b) => {
      if (order === "asc") return getVal(a) > getVal(b) ? 1 : -1;
      return getVal(a) < getVal(b) ? 1 : -1;
    });
  }, [chatCompletions, order, orderBy]);
  // Table columns
  const columns = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      width: "16%",
      render: (item) => (
        <Typography variant="subtitle1" sx={{ fontSize: "1.1rem" }} title={item.name}>
          {item.name}
        </Typography>
      ),
    },
    {
      key: "temperature",
      label: "Temperature",
      sortable: true,
      width: "14%",
      render: (item) => (
        <Tooltip title={item.temperature} placement="top" sx={{ '& .MuiTooltip-tooltip': { fontSize: '0.9rem', maxWidth: '400px', lineHeight: 1.4, padding: '12px', backgroundColor: 'rgba(0, 0, 0, 0.9)' } }}>
          <Typography variant="body2" sx={{ fontSize: "1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "140px", cursor: "help", alignItems: "center" }}>
            {item.temperature}
          </Typography>
        </Tooltip>
      ),
    },
    {
      key: "max_completion_tokens",
      label: "Max Tokens",
      sortable: true,
      width: "14%",
      render: (item) => (
        <Tooltip title={item.max_completion_tokens} placement="top" sx={{ '& .MuiTooltip-tooltip': { fontSize: '0.9rem', maxWidth: '400px', lineHeight: 1.4, padding: '12px', backgroundColor: 'rgba(0, 0, 0, 0.9)' } }}>
          <Typography variant="body2" sx={{ fontSize: "1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "140px", cursor: "help", alignItems: "center" }}>
            {item.max_completion_tokens}
          </Typography>
        </Tooltip>
      ),
    },
    {
      key: "model",
      label: "Model",
      sortable: true,
      width: "18%",
      render: (item) => (
        <Tooltip title={MODEL_DISPLAY_MAP[item.model] ?? item.model} placement="top" arrow sx={{ '& .MuiTooltip-tooltip': { fontSize: '0.9rem', maxWidth: '400px', lineHeight: 1.4, padding: '12px', backgroundColor: 'rgba(0, 0, 0, 0.9)' } }}>
          <Typography variant="body2" color="textSecondary" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "1rem", maxWidth: "180px", cursor: "help", alignItems: "center" }}>
            {MODEL_DISPLAY_MAP[item.model] ?? item.model}
          </Typography>
        </Tooltip>
      ),
    },
    {
      key: "delete",
      label: "Delete",
      width: "7%",
      align: "center",
      render: (item) => (
        <IconButton color="error" onClick={() => handleDelete(item.id)} size="medium" sx={ACTION_ICON_STYLES.delete}>
          <DeleteOutlineIcon sx={{ fontSize: "1.6rem" }} />
        </IconButton>
      ),
    },
    {
      key: "edit",
      label: "Edit",
      width: "7%",
      align: "center",
      render: (item) => (
        <IconButton onClick={() => handleEdit(item)} size="medium" sx={ACTION_ICON_STYLES.edit}>
          <EditIcon sx={{ fontSize: "1.6rem" }} />
        </IconButton>
      ),
    },
    {
      key: "default",
      label: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          Default
          <Tooltip title="Only one can be default at a time" placement="top" arrow>
            <InfoOutlinedIcon fontSize="small" />
          </Tooltip>
        </span>
      ),
      width: "7%",
      align: "center",
      render: (item) => (
        <Checkbox
          checked={!!item.default}
          onChange={() => handleToggleDefault(item.id)}
          size="medium"
          sx={ACTION_ICON_STYLES.enabled(theme)}
        />
      ),
    },
  ];

  // Handlers
  const handleSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  // CRUD handlers
  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditData({
      name: item.name,
      temperature: Number(item.temperature),
      max_completion_tokens: Number(item.max_completion_tokens),
      model: MODEL_DISPLAY_MAP[item.model] ?? item.model,
      default: !!(item.default),
    });
    setIsNew(false);
    setDrawerOpen(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    setEditData({ name: "", temperature: 0.7, max_completion_tokens: 4000, model: "GPT-5.1", default: true }); // display value
    setIsNew(true);
    setDrawerOpen(true);
  };


  const handleSave = async () => {
    if (!editData.name.trim() || !editData.model.trim()) return;
    setLoading(true);
    // Map display model name back to actual DB value before saving
    const dataToSave = { ...editData, model: MODEL_VALUE_MAP[editData.model] ?? editData.model };
    try {
      let data;

      if (isNew) {
        // For new items: check if trying to set as default
        if (editData.default) {
          // Find and unset current default before creating new one
          const currentDefaultCompletion = chatCompletions.find((completion) => completion.default);
          if (currentDefaultCompletion) {
            await updateChatCompletionConfigs(
              { ...currentDefaultCompletion, default: false },
              teamName,
              assistantName
            );
          }
        }

        // POST - Create new Completion Config
        data = await createChatCompletionConfigs(dataToSave, teamName, assistantName);
        if (data && !data.error) {
          // If new item is default, update local state to unset others
          if (editData.default) {
            setChatCompletions((prev) => [
              ...prev.map(completion => ({ ...completion, default: false })),
              data
            ]);
          } else {
            setChatCompletions((prev) => [...prev, data]);
          }
          showSnackbar && showSnackbar("Chat Completion Config created successfully", "success");
        } else {
          showSnackbar && showSnackbar(data.error || "Chat Completion Config creation failed", "error");
        }
      } else {
        // For updates: check if setting as default
        if (editData.default) {
          // Find current default (excluding the one being edited)
          const currentDefaultCompletion = chatCompletions.find(
            (completion) => completion.default && completion.id !== editingId
          );
          if (currentDefaultCompletion) {
            await updateChatCompletionConfigs(
              { ...currentDefaultCompletion, default: false },
              teamName,
              assistantName
            );
          }
        }

        // PUT - Update existing completion ChatCompletion
        data = await updateChatCompletionConfigs({ ...dataToSave, id: editingId }, teamName, assistantName);
        if (data && !data.error) {
          // Update local state: if this is now default, unset others
          if (editData.default) {
            setChatCompletions((prev) =>
              prev.map((completion) =>
                completion.id === editingId
                  ? data
                  : { ...completion, default: false }
              )
            );
          } else {
            setChatCompletions((prev) =>
              prev.map((completion) => (completion.id === editingId ? data : completion))
            );
          }
          showSnackbar && showSnackbar("Chat Completion Config updated successfully", "success");
        } else {
          showSnackbar && showSnackbar(data.error || "Update failed", "error");
        }
      }
    } catch (err) {
      console.error("Error saving:", err);
      showSnackbar && showSnackbar("Server error", "error");
    }
    setEditingId(null);
    setIsNew(false);
    setDrawerOpen(false);
    setLoading(false);
  };


  const handleDelete = (id) => {
    const item = chatCompletions.find((completion) => completion.id === id);
    setDeleteDialog({ open: true, id, itemName: item ? item.name : "Unknown" });
  };

  const handleConfirmDelete = async () => {
    setLoading(true);
    try {
      const data = await deleteChatCompletionConfigs({ type: 'ChatCompletion', teamName, assistantName, id: deleteDialog.id },
        teamName,
        assistantName);
      if (data && !data.error) {
        setChatCompletions((prev) => prev.filter((completion) => completion.id !== deleteDialog.id));
        showSnackbar && showSnackbar(" Chat Completion deleted successfully", "success");
      } else {
        showSnackbar && showSnackbar(data.error || "Delete failed", "error");
      }
    } catch (err) {
      showSnackbar && showSnackbar("Server error", "error");
    }
    setDeleteDialog({ open: false, id: null, itemName: "" });
    setLoading(false);
  };


  const handleToggleDefault = async (id) => {
    try {
      const toggleDefault = chatCompletions.find((completion) => completion.id === id);
      if (!toggleDefault) {
        showSnackbar && showSnackbar("Chat Completion not found", "error");
        return;
      }

      // If clicking on already default row, uncheck it 
      if (toggleDefault.default) {
        await updateChatCompletionConfigs(
          { ...toggleDefault, default: false },
          teamName,
          assistantName
        );
        setChatCompletions((prev) =>
          prev.map((completion) =>
            completion.id === id ? { ...completion, default: false } : completion
          )
        );
        return;
      }

      // current default (if any)
      const currentDefaultCompletion = chatCompletions.find((completion) => completion.default && completion.id !== id);

      // First, unset the current default (if exists)
      if (currentDefaultCompletion) {
        await updateChatCompletionConfigs(
          { ...currentDefaultCompletion, default: false },
          teamName,
          assistantName
        );
      }

      // Then, set the new default
      const updatedDefault = await updateChatCompletionConfigs(
        { ...toggleDefault, default: true },
        teamName,
        assistantName
      );

      if (updatedDefault && !updatedDefault.error) {
        // Update local state: set target to default, others to false
        setChatCompletions((prev) =>
          prev.map((completion) =>
            completion.id === id
              ? { ...completion, default: true }
              : { ...completion, default: false }
          )
        );
        showSnackbar && showSnackbar("Default updated successfully", "success");
      } else {
        showSnackbar && showSnackbar(updatedDefault.error || "Update failed", "error");
      }
    } catch (err) {
      console.error("Error toggling default:", err);
      showSnackbar && showSnackbar("Server error", "error");
    }
    setLoading(false);
  };

  return (
    <>
      <Box sx={{ mt: 'auto', backgroundColor: 'color.blue10', borderRadius: '4px', p: 2, display: 'flex', gap: 1, color: 'color.inky' }}>
        <InfoOutlined sx={{ fontSize: '28px' }} />
        <Typography variant="body1">This chat configuration will not apply when using custom workflows.</Typography>
      </Box>
      <TableWithActions
        title="Chat Completion"
        data={sortedRows}
        loading={loading}
        columns={columns}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleEnabled={handleToggleDefault}
        orderBy={orderBy}
        order={order}
        onSort={handleSort}
        emptyMessage="No chat completion configurations found. Create one to get started."
        addButtonText="New Chat Completion Config"
      />

      <EditDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={isNew ? "New Chat Completion" : `Edit: ${editData.name}`}
        onSave={handleSave}
        onCancel={() => setDrawerOpen(false)}
        saveButtonText={isNew ? "Create new" : undefined}
        saveDisabled={!editData.name.trim() || !editData.model.trim()}
      >
        <TextField
          label="Name"
          value={editData.name}
          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
          fullWidth
          variant="outlined"
          size="small"
          sx={{ '& .MuiInputLabel-root': { fontSize: '1rem' }, '& .MuiInputBase-input': { fontSize: '0.95rem', py: 1 }, '& .MuiOutlinedInput-root': { backgroundColor: 'inherit' } }}
        />
        <TextField
          label="Temperature"
          type="number"
          value={editData.temperature}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value) && value >= 0.1 && value <= 1) {
              setEditData({ ...editData, temperature: value });
            }
          }}
          inputProps={{
            min: 0.1,
            max: 1,
            step: 0.1
          }}
          fullWidth
          variant="outlined"
          size="small"
          sx={{ mt: 2, '& .MuiInputLabel-root': { fontSize: '1rem' }, '& .MuiInputBase-input': { fontSize: '0.95rem', py: 1 }, '& .MuiOutlinedInput-root': { backgroundColor: 'inherit' } }}
          helperText="Value must be between 0.1 and 1. Lower values make output more focused and deterministic. Higher values increase randomness and creativity."
        />

        <TextField
          label="Max Output Tokens"
          type="number"
          value={editData.max_completion_tokens}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            if (!isNaN(value) && value >= 500 && value <= 48000) {
              setEditData({ ...editData, max_completion_tokens: value });
            }
          }}
          inputProps={{
            min: 500,
            max: 48000,
            step: 250
          }}
          fullWidth
          variant="outlined"
          size="small"
          sx={{ mt: 2, '& .MuiInputLabel-root': { fontSize: '1rem' }, '& .MuiInputBase-input': { fontSize: '0.95rem', py: 1 }, '& .MuiOutlinedInput-root': { backgroundColor: 'inherit' } }}
          helperText="Value must be between 500 and 48000 tokens."
        />

        <FormControl fullWidth variant="outlined" size="small" sx={{ mt: 2 }}>
          <InputLabel sx={{ fontSize: '1rem' }}>Model</InputLabel>
          <Select
            value={editData.model}
            onChange={(e) => setEditData({ ...editData, model: e.target.value })}
            label="Model"
            sx={{
              fontSize: '0.95rem',
              '& .MuiSelect-select': { py: 1 },
              '& .MuiOutlinedInput-root': { backgroundColor: 'inherit' }
            }}
          >
            <MenuItem value="GPT-5.1" sx={{ fontSize: '0.95rem' }}>GPT-5.1</MenuItem> {/* stored as gpt-4o */}
          </Select>
          <FormHelperText sx={{ fontSize: '0.85rem' }}>Currently, GPT-5.1 is the only model available.</FormHelperText>
        </FormControl>

        <FormControlLabel
          control={
            <Checkbox
              checked={editData.default}
              onChange={(e) => setEditData({ ...editData, default: e.target.checked })}
              sx={{ '& .MuiSvgIcon-root': { fontSize: '1.4rem' } }}
            />
          }
          label={<Typography sx={{ fontSize: '0.95rem', fontWeight: 500 }}>Set as default</Typography>}
          sx={{ alignItems: 'center', '& .MuiFormControlLabel-label': { ml: 1 } }}
        />
      </EditDrawer>

      <DeleteConfirmationModal
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ ...deleteDialog, open: false })}
        onConfirm={handleConfirmDelete}
        itemName={deleteDialog.itemName}
        title="Delete Chat Completion Config?"
        message="This will permanently delete"
      />
    </>
  );
};

export default ChatCompletionConfigManagement;
