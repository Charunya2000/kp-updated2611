'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  DragIndicator,
  ArrowUpward,
  ArrowDownward,
  Delete,
  Add,
  Save,
  NoteAdd,
  FileUpload,
} from '@mui/icons-material';
import {
  getMedCompareResultConfig,
  saveMedCompareResultConfig,
} from '@/app/clientServices/medicareCompareResultConfigService';
import useSnackbar from '@/app/hooks/useSnackbar';
import { DEFAULT_RESULT_CONFIG_BY_INVOICE_TYPE } from '@/app/medicare-cmp/invoice-compare/config/defaultResultConfig';

// Default config shape matching the existing RESULT_CONFIG_BY_INVOICE_TYPE
const DEFAULT_CONFIG = {
  ...DEFAULT_RESULT_CONFIG_BY_INVOICE_TYPE,
};

export default function MedCompareConfigEditor({ teamName }) {
  const [config, setConfig] = useState(null);
  const [sqlColumns, setSqlColumns] = useState({ med: [] });
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [editingNotesIndex, setEditingNotesIndex] = useState(null);
  const [editingNotes, setEditingNotes] = useState(['', '', '']);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState(null);

  const { SnackbarComponent, showSnackbar } = useSnackbar();

  const invoiceTypeKey = 'med';

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMedCompareResultConfig(teamName);
      if (data.error) {
        showSnackbar(data.error, 'error');
        setConfig(structuredClone(DEFAULT_CONFIG));
      } else {
        setSqlColumns(data.sqlColumns || { med: [] });
        setConfig(data.config || structuredClone(DEFAULT_CONFIG));
      }
    } catch (err) {
      showSnackbar('Failed to load config.', 'error');
      setConfig(structuredClone(DEFAULT_CONFIG));
    } finally {
      setLoading(false);
    }
  }, [teamName]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const currentInvoice = config?.[invoiceTypeKey];
  const currentColumns = currentInvoice?.columnHeaders || [];
  const availableSqlColumns = sqlColumns[invoiceTypeKey] || [];

  // ---- Mutators ----

  function updateInvoiceField(field, value) {
    setConfig((prev) => ({
      ...prev,
      [invoiceTypeKey]: {
        ...prev[invoiceTypeKey],
        [field]: value,
      },
    }));
  }

  function updateColumnHeaders(newHeaders) {
    updateInvoiceField('columnHeaders', newHeaders);
  }

  function updateColumn(index, field, value) {
    const updated = [...currentColumns];
    updated[index] = { ...updated[index], [field]: value };
    updateColumnHeaders(updated);
  }

  function moveColumn(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentColumns.length) return;
    const updated = [...currentColumns];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updateColumnHeaders(updated);
  }

  function removeColumn(index) {
    updateColumnHeaders(currentColumns.filter((_, i) => i !== index));
  }

  function addColumn() {
    updateColumnHeaders([...currentColumns, { name: '' }]);
  }

  function openNotesDialog(index) {
    const col = currentColumns[index];
    setEditingNotesIndex(index);
    setEditingNotes(col.notes ? [...col.notes] : ['', '', '']);
    setNotesDialogOpen(true);
  }

  function saveNotes() {
    const hasContent = editingNotes.some((n) => n.trim() !== '');
    updateColumn(editingNotesIndex, 'notes', hasContent ? editingNotes : undefined);
    setNotesDialogOpen(false);
    setEditingNotesIndex(null);
  }

  function removeNotes(index) {
    const updated = [...currentColumns];
    const col = { ...updated[index] };
    delete col.notes;
    updated[index] = col;
    updateColumnHeaders(updated);
  }

  // ---- Import JSON ----

  function openImportDialog() {
    setImportJson('');
    setImportError(null);
    setImportDialogOpen(true);
  }

  function handleImportJson() {
    try {
      const parsed = JSON.parse(importJson);

      if (!parsed.med) {
        setImportError('JSON must contain a "med" key.');
        return;
      }

      for (const key of Object.keys(parsed)) {
        if (key !== 'med') {
          setImportError(`Unknown invoice type "${key}". Only "med" is supported.`);
          return;
        }
        const inv = parsed[key];
        if (inv.columnHeaders && !Array.isArray(inv.columnHeaders)) {
          setImportError(`"${key}.columnHeaders" must be an array.`);
          return;
        }
        if (inv.columnHeaders) {
          for (let i = 0; i < inv.columnHeaders.length; i++) {
            const col = inv.columnHeaders[i];
            if (!col.name || typeof col.name !== 'string') {
              setImportError(`"${key}.columnHeaders[${i}]" must have a "name" string.`);
              return;
            }
            if (col.notes && (!Array.isArray(col.notes) || col.notes.length !== 3)) {
              setImportError(`"${key}.columnHeaders[${i}].notes" must be an array of exactly 3 strings.`);
              return;
            }
          }
        }
      }

      setConfig((prev) => {
        const updated = structuredClone(prev);
        for (const key of Object.keys(parsed)) {
          updated[key] = {
            ...updated[key],
            ...parsed[key],
          };
        }
        return updated;
      });

      setImportDialogOpen(false);
      showSnackbar('Configuration imported. Review the changes and click Save to persist.', 'success');
    } catch {
      setImportError('Invalid JSON. Please check the syntax and try again.');
    }
  }

  // ---- Save ----

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveMedCompareResultConfig(teamName, config);
      if (result.error) {
        showSnackbar(result.error, 'error');
      } else {
        showSnackbar('Configuration saved successfully.', 'success');
        setConfig(result);
      }
    } catch {
      showSnackbar('Failed to save configuration.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ---- Render ----

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Medicare Compare Result Configuration
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        Configure the column headers, display names, SQL aliases, and notes for Medicare invoice
        result exports.
      </Typography>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Medicare" />
      </Tabs>

      {/* Invoice-level properties */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          label="SQL File"
          value={currentInvoice?.sqlFile || ''}
          onChange={(e) => updateInvoiceField('sqlFile', e.target.value)}
          size="small"
          sx={{ minWidth: 280 }}
          disabled
        />
        <TextField
          label="Worksheet Name"
          value={currentInvoice?.worksheetName || ''}
          onChange={(e) => updateInvoiceField('worksheetName', e.target.value)}
          size="small"
          sx={{ minWidth: 280 }}
        />
        <TextField
          label="Filename Label"
          value={currentInvoice?.filenameLabel || ''}
          onChange={(e) => updateInvoiceField('filenameLabel', e.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
        />
      </Box>

      {/* Column headers table */}
      <Typography variant="h6" sx={{ mb: 1 }}>
        Column Headers
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
        Define columns in order. Use the arrows to reorder. Each column can optionally have a SQL
        alias (mapped to a SQL output column) and up to 3 sub-header notes.
      </Typography>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 50 }}>#</TableCell>
              <TableCell sx={{ width: 80 }}>Order</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>SQL Alias</TableCell>
              <TableCell sx={{ width: 120 }}>Notes</TableCell>
              <TableCell sx={{ width: 60 }}>Remove</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {currentColumns.map((col, idx) => (
              <TableRow key={idx} hover>
                <TableCell>{idx + 1}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex' }}>
                    <IconButton
                      size="small"
                      onClick={() => moveColumn(idx, -1)}
                      disabled={idx === 0}
                    >
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => moveColumn(idx, 1)}
                      disabled={idx === currentColumns.length - 1}
                    >
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
                <TableCell>
                  <TextField
                    value={col.name || ''}
                    onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="Column name"
                  />
                </TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={col.sqlAlias || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          // Remove sqlAlias property entirely
                          const updated = [...currentColumns];
                          const newCol = { ...updated[idx] };
                          delete newCol.sqlAlias;
                          updated[idx] = newCol;
                          updateColumnHeaders(updated);
                        } else {
                          updateColumn(idx, 'sqlAlias', val);
                        }
                      }}
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em>None (use display name)</em>
                      </MenuItem>
                      {availableSqlColumns.map((sqlCol) => (
                        <MenuItem key={sqlCol} value={sqlCol}>
                          {sqlCol}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  {col.notes ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title="Edit notes">
                        <IconButton size="small" onClick={() => openNotesDialog(idx)} color="primary">
                          <NoteAdd fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove notes">
                        <IconButton size="small" onClick={() => removeNotes(idx)} color="error">
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ) : (
                    <Tooltip title="Add notes">
                      <IconButton size="small" onClick={() => openNotesDialog(idx)}>
                        <NoteAdd fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => removeColumn(idx)} color="error">
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {currentColumns.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No columns configured. Click &quot;Add Column&quot; to begin.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button variant="action" startIcon={<Add />} onClick={addColumn}>
          Add Column
        </Button>
        <Button variant="action" startIcon={<FileUpload />} onClick={openImportDialog}>
          Import JSON
        </Button>
        <Button
          variant="primary"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </Box>

      {/* Notes Dialog */}
      <Dialog
        open={notesDialogOpen}
        onClose={() => setNotesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Sub-Header Notes
          {editingNotesIndex !== null && currentColumns[editingNotesIndex] && (
            <Typography variant="body2" color="text.secondary">
              Column: {currentColumns[editingNotesIndex].name || '(unnamed)'}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {['Row 1 (Test Name)', 'Row 2 (Test Description)', 'Row 3 (Test Notes)'].map(
              (label, i) => (
                <TextField
                  key={i}
                  label={label}
                  value={editingNotes[i] || ''}
                  onChange={(e) => {
                    const updated = [...editingNotes];
                    updated[i] = e.target.value;
                    setEditingNotes(updated);
                  }}
                  multiline
                  minRows={3}
                  maxRows={10}
                  fullWidth
                />
              ),
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setNotesDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveNotes}>
            Apply Notes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import JSON Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Import Configuration from JSON</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Paste a JSON object with the shape: {'{'} &quot;ca&quot;: {'{'} ... {'}'}, &quot;moc&quot;: {'{'} ... {'}'} {'}'}.
            Each invoice type can include sqlFile, worksheetName, filenameLabel, and columnHeaders.
            This will merge into the current configuration.
          </Typography>
          {importError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setImportError(null)}>
              {importError}
            </Alert>
          )}
          <TextField
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            multiline
            rows={16}
            fullWidth
            placeholder='{"ca":{...},"moc":{...}}'
            sx={{ fontFamily: 'monospace' }}
            inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setImportDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleImportJson} disabled={!importJson.trim()}>
            Import
          </Button>
        </DialogActions>
      </Dialog>
      <SnackbarComponent />
    </Box>
  );
}
