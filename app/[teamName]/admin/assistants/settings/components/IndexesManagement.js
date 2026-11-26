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
  Button
} from '@mui/material';
import {
  Edit as EditIcon,
  DeleteOutline as DeleteOutlineIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import TableWithActions, { ACTION_ICON_STYLES } from '@/app/admin/components/TableWithActions';
import EditDrawer from '@/app/admin/components/EditDrawer';
import DeleteConfirmationModal from '@/app/admin/components/DeleteConfirmationModal';
import { useTheme } from '@mui/material/styles';
import {
  getAllSearchIndexes,
  updateSearchIndex,
  deleteSearchIndex,
  createSearchIndex,
} from '@/app/clientServices/aiSearchConfigService';
import { getAllAssistants } from '@/app/clientServices/assistantService';
import { getAllIndexNames, getFieldMetadataForIndex } from '@/app/clientServices/aiSearchIndexService';
import { getSourceBySearchIndexConfigId, saveBulkSources, saveSource } from '@/app/clientServices/sourceService';
import { useParams, useSearchParams } from 'next/navigation';
import { formatName } from '@/utils/formatting.js';

function generateMessageTemplate(selectFields) {
  if (!Array.isArray(selectFields) || selectFields.length === 0) return '';
  const parts = selectFields.map((field) => {
    if (field === 'type') {
      return `type: \${type}`;
    }
    return `${field}: \${${field}}`;
  });
  return parts.join(', ');
}

const IndexesManagement = ({ showSnackbar, assistantId, teamName: propTeamName, assistantName: propAssistantName }) => {
  const theme = useTheme();
  const [indexes, setIndexes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({
    displayName: '',
    indexName: '',
    nearestNeighbors: 5,
    selectFields: [],
    filter: '',
    template: '',
    enabled: true
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, itemName: '' });
  const [orderBy, setOrderBy] = useState('displayName');
  const [order, setOrder] = useState('asc');
  const [searchIndexNames, setSearchIndexNames] = useState([]);
  const [fieldsOptions, setFieldsOptions] = useState([]);

  const teamName = propTeamName ?? useParams().teamName;
  const assistantName = propAssistantName ?? useSearchParams().get('assistant');

  // Fetch search indexes filtered by selected assistantId and sort alphabetically
  useEffect(() => {
    const fetchSearchIndexes = async () => {
      setLoading(true);
      try {
        // fetch team-wide indexes so the drawer's index name list includes everything
        const allSearchIndexes = await getAllSearchIndexes(teamName, assistantName);
        const allAzureIndexNames = await getAllIndexNames();
        const sortedIndexes = allSearchIndexes.sort((a, b) =>
          (a.indexName).localeCompare(b.indexName)
        );
        setIndexes(sortedIndexes);

        // Use allAzureIndexNames for the Search Index Name dropdown in the drawer
        const sortedAzureIndexNames = allAzureIndexNames.sort((a, b) => a.localeCompare(b));
        setSearchIndexNames(sortedAzureIndexNames);
      } catch (error) {
        setIndexes([]);
        setSearchIndexNames([]);
      }
      setLoading(false);
    };
    if (teamName) {
      fetchSearchIndexes();
    }
  }, [assistantName, teamName]);

  const fetchFieldsForIndex = async (indexName) => {
    if (!indexName) {
      setFieldsOptions([]);
      return;
    }
    const fields = await getFieldMetadataForIndex(indexName);
    setFieldsOptions(Array.isArray(fields) ? fields.map(f => f.name) : []);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditData({
      displayName: item.displayName,
      indexName: item.indexName,
      nearestNeighbors: item.nearestNeighbors,
      selectFields: item.selectFields || [],
      filter: item.filter || '',
      template: generateMessageTemplate(item.selectFields || []), // Auto-generate if empty
      enabled: item.enabled
    });
    setIsNew(false);
    setDrawerOpen(true);
    fetchFieldsForIndex(item.indexName);
  };

  const handleAdd = () => {
    setEditingId(Date.now());
    setEditData({
      displayName: '',
      indexName: '',
      nearestNeighbors: '',
      selectFields: [],
      filter: '',
      template: '',
      enabled: true
    });
    setIsNew(true);
    setDrawerOpen(true);
    setFieldsOptions([]);
  };

  const handleDelete = (id) => {
    const item = indexes.find(p => p.id === id);
    setDeleteDialog({
      open: true,
      id: id,
      itemName: item ? item.displayName : 'Unknown'
    });
  };

  const handleToggleEnabled = async (id) => {
    try {
      const itemToUpdate = indexes.find(item => item.id === id);
      if (itemToUpdate) {
        const updatedItem = {
          ...itemToUpdate,
          enabled: !itemToUpdate.enabled,
          type: 'SearchIndexConfig'
        };
        const savedSearchIndex = await updateSearchIndex(updatedItem, teamName, assistantName);
        const updated = indexes.map(item =>
          item.id === id ? savedSearchIndex : item
        );
        setIndexes(updated);

        try {
          const relatedSources = await getSourceBySearchIndexConfigId(teamName, assistantName, itemToUpdate.id);
          // Update each related source's selected property based on the index enabled state
          const updatedSources = relatedSources.map(source => {
            return {
              id: source.id,
              selected: savedSearchIndex.enabled,
              enabled: savedSearchIndex.enabled
            }
          })

          await saveBulkSources(teamName, assistantName, updatedSources);

        } catch (sourceError) {
          console.error('Error updating related sources:', sourceError);
          showSnackbar?.('Index updated but failed to update related sources', 'warning', 3000);
        }
      }
    } catch (error) {
      console.error('Error updating index enabled state:', error);
      showSnackbar?.('Failed to update index', 'error', 5000);
    }
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const columns = [
    {
      key: 'displayName',
      label: 'Display Name',
      sortable: true,
      width: '16%',
      render: (item) => (
        <Typography
          variant="subtitle1"
          sx={{
            fontSize: '1.1rem',
          }}
          title={item.displayName}
        >
          {item.displayName}
        </Typography>
      )
    },
    {
      key: 'indexName',
      label: 'Name',
      sortable: true,
      width: '14%',
      render: (item) => (
        <Tooltip
          title={item.indexName}
          placement="top"
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
            sx={{
              fontSize: '1rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '140px',
              cursor: 'help',
              alignItems: 'center',
            }}
          >
            {item.indexName}
          </Typography>
        </Tooltip>
      )
    },
    {
      key: 'nearestNeighbors',
      label: 'Nearest Neighbors',
      sortable: true,
      width: '18%',
      render: (item) => (
        <Typography
          variant="body2"
          sx={{
            fontSize: '1rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.nearestNeighbors}
        </Typography>
      )
    },
    {
      key: 'selectFields',
      label: 'Fields',
      sortable: true,
      width: '18%',
      render: (item) => (
        <Tooltip
          title={(item.selectFields || []).join(', ')}
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
            sx={{
              fontSize: '1rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '180px',
              cursor: 'help',
              alignItems: 'center',
            }}
          >
            {(item.selectFields || []).join(', ')}
          </Typography>
        </Tooltip>
      )
    },
    {
      key: 'template',
      label: 'Message Template',
      sortable: true,
      width: '18%',
      render: (item) => (
        <Tooltip
          title={item.template}
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
              whiteSpace: 'nowrap',
              fontSize: '1rem',
              maxWidth: '180px',
              cursor: 'help',
              alignItems: 'center'
            }}
          >
            {item.template}
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

  const renderIndexesContent = () => {
    const handleSave = async () => {
      try {
        const trimmedDisplayName = editData.displayName.trim();
        const formattedName = formatName(trimmedDisplayName);

        const existingIndex = indexes.find(idx =>
          idx.name?.toLowerCase() === formattedName.toLowerCase() &&
          (isNew || idx.id !== editingId)
        );

        if (existingIndex) {
          showSnackbar?.(`An index configuration with the name "${editData.displayName}" already exists. Please choose a different name.`, 'error', 5000);
          return;
        }

        if (isNew) {
          // const existingConfig = indexes.find(idx => idx.indexName === editData?.indexName);
          // if (existingConfig) {
          //   showSnackbar?.(`An index configuration for "${editData.indexName}" already exists. Please choose a different index to configure, or update the existing: ${existingConfig.displayName}.`, 'error');
          //   return;
          // }

          const newItem = {
            ...editData,
            name: formattedName,
            assistantId: assistantId,
            type: 'SearchIndexConfig'
          };
          const savedSearchIndex = await createSearchIndex(newItem, teamName, assistantName);

          if (savedSearchIndex.error) {
            showSnackbar?.(savedSearchIndex.error, 'error', 5000);
            return;
          }

          setIndexes([savedSearchIndex, ...indexes]);
          showSnackbar?.('Index configuration created successfully!', 'success');
        } else {
          const updatedItem = {
            ...editData,
            name: formattedName,
            id: editingId,
            assistantId: assistantId,
            type: 'SearchIndexConfig'
          };
          const savedSearchIndex = await updateSearchIndex(updatedItem, teamName, assistantName);

          if (savedSearchIndex.error) {
            showSnackbar?.('An index with this name already exists.', 'error', 5000);
            return;
          }
          const updated = indexes.map(item =>
            item.id === editingId ? savedSearchIndex : item
          );

          setIndexes(updated);
          showSnackbar?.('Index configuration updated successfully!', 'success');
        }
        setEditingId(null);
        setIsNew(false);
        setDrawerOpen(false);
      } catch (error) {
        console.error('Error saving index configuration:', error);
        showSnackbar?.('Failed to save index configuration.', 'error', 5000);
      }
    };

    const handleConfirmDelete = async () => {
      try {
        const itemToDelete = indexes.find(item => item.id === deleteDialog.id);
        if (itemToDelete) {
          await deleteSearchIndex(itemToDelete, teamName, assistantName);
          const updated = indexes.filter(item => item.id !== deleteDialog.id);
          setIndexes(updated);
          showSnackbar?.('Index configuration deleted successfully!', 'success');
        }
      } catch (error) {
        console.error('Error deleting index configuration:', error);
        showSnackbar?.('Failed to delete index configuration.', 'error', 5000);
      } finally {
        setDeleteDialog({ open: false, id: null, itemName: '' });
      }
    };

    return (
      <>
        <TableWithActions
          title="Indexes"
          data={indexes}
          loading={loading}
          columns={columns}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleEnabled={handleToggleEnabled}
          orderBy={orderBy}
          order={order}
          onSort={handleSort}
          emptyMessage="No indexes found"
          addButtonText="Configure Index"
        />

        <EditDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={
            isNew
              ? 'Configure Index'
              : `Configure: ${editData.indexName || ''}`
          }
          onSave={handleSave}
          onCancel={() => setDrawerOpen(false)}
          saveButtonText={
            isNew
              ? 'Create index configuration'
              : undefined
          }
          saveDisabled={
            !(editData.displayName || '').trim() ||
            !(editData.indexName || '').trim() ||
            !editData.nearestNeighbors ||
            !editData.selectFields.length ||
            !(editData.template || '').trim()
          }
        >
          <TextField
            label="Display Name"
            value={editData.displayName}
            onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
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

          <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: '1rem' }}>Search Index Name</InputLabel>
            <Select
              value={editData.indexName}
              label="Search Index Name"
              onChange={async (e) => {
                setEditData({ ...editData, indexName: e.target.value, selectFields: [] });
                await fetchFieldsForIndex(e.target.value);
              }}
              MenuProps={{
                disableScrollLock: true,
              }}
              sx={{
                fontSize: '0.95rem',
                borderRadius: '8px',
                '& .MuiSelect-select': {
                  fontSize: '0.95rem',
                },
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'inherit',
                }
              }}
            >
              {searchIndexNames.map((index) => (
                <MenuItem key={index} value={index} sx={{ fontSize: '0.95rem' }}>
                  {index}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Nearest Neighbors"
            type="number"
            value={editData.nearestNeighbors}
            onChange={(e) => setEditData({ ...editData, nearestNeighbors: parseInt(e.target.value) })}
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
              },
            }}
            inputProps={{
              min: 1,
              step: 1
            }}
          />

          <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: '1rem' }}>Select Fields</InputLabel>
            <Select
              multiple
              value={editData.selectFields}
              label="Select Fields"
              onChange={(e) => {
                const selectedFields = e.target.value;
                setEditData({
                  ...editData,
                  selectFields: selectedFields,
                  template: generateMessageTemplate(selectedFields)
                });
              }}
              renderValue={(selected) => (selected || []).join(', ')}
              MenuProps={{
                disableScrollLock: true,
              }}
              sx={{
                fontSize: '0.95rem',
                borderRadius: '8px',
                '& .MuiSelect-select': {
                  fontSize: '0.95rem',
                },
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'inherit',
                }
              }}
            >
              {fieldsOptions.map((field) => (
                <MenuItem key={field} value={field} sx={{ fontSize: '0.95rem' }}>
                  <Checkbox
                    checked={editData.selectFields.includes(field)}
                    sx={{ mr: 1, p: 0.5 }}
                  />
                  <Typography sx={{ fontSize: '0.95rem' }}>{field}</Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Filter"
            type="text"
            value={editData.filter}
            onChange={(e) => setEditData({ ...editData, filter: e.target.value })}
            fullWidth
            variant="outlined"
            size='small'
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
            label="Message Template"
            value={editData.template}
            onChange={(e) => setEditData({ ...editData, template: e.target.value })}
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            size="small"
            helperText="Define the message template for this index"
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
          onClose={() => setDeleteDialog({ open: false, id: null, itemName: '' })}
          onConfirm={handleConfirmDelete}
          itemName={deleteDialog.itemName}
          title="Delete Index?"
          message="This will permanently delete"
        />
      </>
    );
  };

  return renderIndexesContent();
};

export default IndexesManagement;