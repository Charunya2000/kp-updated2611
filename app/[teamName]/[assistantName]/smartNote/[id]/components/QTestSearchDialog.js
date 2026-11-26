'use client';

import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, IconButton, Button, TextField,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Checkbox, CircularProgress, Alert, Chip, Divider, Collapse,
  InputAdornment,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore, ExpandLess,
  FolderOpen as FolderIcon,
} from '@mui/icons-material';
import { searchTestCases, getQTestProjectModules } from '@clientServices/qtestSearchService';

const STATUS_OPTIONS    = ['New', 'Done', 'In Progress', 'Broken', 'In Development', 'Not Automatable', 'Ready to Automate', 'Ready For Automation', 'Sunset'];
const PRIORITY_OPTIONS  = ['Critical', 'High', 'Medium', 'Low', 'Urgent', 'Undecided', 'Not Yet Discussed'];
const TYPE_OPTIONS      = ['Functional', 'Manual', 'Regression', 'UAT', 'Automation', 'End to End'];

const DEFAULT_LIMIT = 50;

/**
 * QTestSearchDialog (v2)
 * Props:
 *   open        - boolean
 *   onClose     - () => void
 *   onSubmit    - (blocks: Array<{id, name, content}>) => void
 *   projectId   - number | null  — pre-resolved from assistant context
 *   projectName - string | null  — display label
 */
const QTestSearchDialog = ({ open, onClose, onSubmit, projectId: propProjectId = null, projectName = null }) => {
  const [limit, setLimit]                     = useState(DEFAULT_LIMIT);

  const [query, setQuery]         = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatus]     = useState([]);
  const [priorityFilter, setPriority] = useState([]);
  const [typeFilter, setType]         = useState([]);
  const [modulePath, setModulePath]   = useState('');

  const [results, setResults]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [offset, setOffset]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selected, setSelected] = useState(new Map());   // no cap
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  // ── module picker state ──────────────────────────────────────────────────────
  const [selectedModules, setSelectedModules]       = useState([]);            // [{ id, name }]
  const [modulePickerOpen, setModulePickerOpen] = useState(false);
  const [pickerModules, setPickerModules]       = useState(new Map());    // parentKey → modules[]
  const [pickerExpanded, setPickerExpanded]     = useState(new Set());
  const [pickerLoading, setPickerLoading]       = useState(new Set());

  // ── helpers ─────────────────────────────────────────────────────────────────
  const resolvedId = propProjectId;

  const clampLimit = (v) => Math.min(Math.max(Number(v) || 1, 1), 500);

  const activeFilterCount = [
    statusFilter.length, priorityFilter.length, typeFilter.length,
    modulePath.trim().length, selectedModules.length > 0 ? 1 : 0,
  ].filter(Boolean).length;

  const buildFilters = (moduleOverride = null) => {
    const f = { project_ids: [resolvedId] };
    if (statusFilter.length)     f.status      = statusFilter;
    if (priorityFilter.length)   f.priority    = priorityFilter;
    if (typeFilter.length)       f.tc_type     = typeFilter;
    if (moduleOverride)          f.module_id   = moduleOverride.id;
    else if (modulePath.trim())  f.module_path = modulePath.trim();
    console.debug('[qTest] search payload =>', JSON.stringify({ filters: f, query, limit: clampLimit(limit) }));
    return f;
  };

  // ── search ───────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!resolvedId) { setError('Please enter a project ID.'); return; }
    setLoading(true);
    setError('');
    try {
      if (selectedModules.length > 1) {
        // Parallel search per module — merge & deduplicate by qtestId
        console.debug('[qTest] multi-module search, modules =>', JSON.stringify(selectedModules));
        const searches = await Promise.all(
          selectedModules.map(m => searchTestCases({ query, filters: buildFilters(m), limit: clampLimit(limit), offset: 0 }))
        );
        const seen = new Set();
        const merged = [];
        for (const data of searches) {
          console.debug('[qTest] module search response => total:', data.total, 'results:', data.results?.length, 'sample moduleId:', data.results?.[0]?.moduleId);
          for (const r of (data.results || [])) {
            if (!seen.has(r.qtestId)) { seen.add(r.qtestId); merged.push(r); }
          }
        }
        setResults(merged);
        setTotal(merged.length);
      } else {
        const mod = selectedModules[0] || null;
        console.debug('[qTest] single search, module =>', JSON.stringify(mod));
        const data = await searchTestCases({ query, filters: buildFilters(mod), limit: clampLimit(limit), offset: 0 });
        console.debug('[qTest] search response => total:', data.total, 'results:', data.results?.length, 'sample moduleId:', data.results?.[0]?.moduleId);
        setResults(data.results || []);
        setTotal(data.total || 0);
      }
      setOffset(0);
      setFiltersOpen(false);   // collapse to give results more space
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    const newOffset = offset + clampLimit(limit);
    setLoadingMore(true);
    try {
      const mod = selectedModules[0] || null;   // load more only applies to single-module mode
      const data = await searchTestCases({ query, filters: buildFilters(mod), limit: clampLimit(limit), offset: newOffset });
      setResults(prev => [...prev, ...(data.results || [])]);
      setTotal(data.total || 0);
      setOffset(newOffset);
    } catch {
      setError('Failed to load more results.');
    } finally {
      setLoadingMore(false);
    }
  };

  // ── selection ────────────────────────────────────────────────────────────────
  const toggleItem = (result) => {
    setSelected(prev => {
      const next = new Map(prev);
      next.has(result.qtestId) ? next.delete(result.qtestId) : next.set(result.qtestId, result);
      return next;
    });
  };

  // ── submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selected.size) return;
    setSubmitting(true);
    try {
      const blocks = Array.from(selected.values()).map(tc => {
        const steps = (tc.testSteps || [])
          .map(s => `Step: ${s.description || ''}\nExpected: ${s.expected || ''}`)
          .join('\n');
        const content = [
          `Test Case: ${tc.name}`,
          `Description: ${tc.description || ''}`,
          tc.precondition ? `Precondition: ${tc.precondition}` : '',
          steps ? `Steps:\n${steps}` : '',
        ].filter(Boolean).join('\n');
        return { id: tc.qtestId, name: tc.name, content };
      });
      onSubmit(blocks);
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setQuery(''); setResults([]); setTotal(0); setOffset(0);
    setSelected(new Map()); setError('');
    setFiltersOpen(false); setStatus([]); setPriority([]);
    setType([]); setModulePath('');
    setSelectedModules([]); setModulePickerOpen(false);
    setPickerModules(new Map()); setPickerExpanded(new Set()); setPickerLoading(new Set());
    onClose();
  };

  // ── module picker ────────────────────────────────────────────────────────────
  const handleToggleModulePicker = async () => {
    const opening = !modulePickerOpen;
    setModulePickerOpen(opening);
    if (opening && !pickerModules.has('root')) {
      setPickerLoading(prev => new Set([...prev, 'root']));
      try {
        // New search API: GET /api/qtest-search/search/projects/{id}/modules (no parent_id = root level)
        const data = await getQTestProjectModules(propProjectId, null);
        setPickerModules(prev => new Map([...prev, ['root', data.modules || []]]));
      } catch {
        setError('Failed to load modules.');
      } finally {
        setPickerLoading(prev => { const s = new Set(prev); s.delete('root'); return s; });
      }
    }
  };

  const handleExpandPickerModule = async (moduleId) => {
    if (pickerExpanded.has(moduleId)) {
      setPickerExpanded(prev => { const s = new Set(prev); s.delete(moduleId); return s; });
      return;
    }
    setPickerExpanded(prev => new Set([...prev, moduleId]));
    if (!pickerModules.has(moduleId)) {
      setPickerLoading(prev => new Set([...prev, moduleId]));
      try {
        // New search API: GET .../modules?parent_id={moduleId}
        const data = await getQTestProjectModules(propProjectId, moduleId);
        setPickerModules(prev => new Map([...prev, [moduleId, data.modules || []]]));
      } catch {
        setError('Failed to load sub-modules.');
      } finally {
        setPickerLoading(prev => { const s = new Set(prev); s.delete(moduleId); return s; });
      }
    }
  };

  const handleSelectPickerModule = (mod) => {
    const modId = mod.qtestModuleId;   // new API field
    setSelectedModules(prev => {
      const alreadySelected = prev.some(m => m.id === modId);
      if (alreadySelected) return prev.filter(m => m.id !== modId);  // deselect
      return [...prev, { id: modId, name: mod.name }];
    });
    setModulePath('');         // clear manual path
    // keep picker open so user can select additional modules
  };

  const handleClearModule = (moduleId) => setSelectedModules(prev => prev.filter(m => m.id !== moduleId));

  const renderPickerModule = (mod, level = 0) => {
    const id = mod.qtestModuleId;     // new API uses qtestModuleId
    const isExpanded = pickerExpanded.has(id);
    const isLoading  = pickerLoading.has(id);
    const children   = pickerModules.get(id) || [];
    const isSelected = selectedModules.some(m => m.id === id);
    return (
      <Box key={id}>
        <Box sx={{ display: 'flex', alignItems: 'center', pl: level * 2 + 0.5 }}>
          <IconButton size="small" onClick={() => handleExpandPickerModule(id)} sx={{ p: 0.25, mr: 0.5 }}>
            {isLoading ? <CircularProgress size={14} /> : isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
          <Typography
            variant="body2"
            onClick={() => handleSelectPickerModule(mod)}
            sx={{
              cursor: 'pointer', flex: 1, py: 0.5,
              color: isSelected ? 'primary.main' : 'inherit',
              fontWeight: isSelected ? 'medium' : 'normal',
              '&:hover': { color: 'primary.main' },
            }}
          >
            {mod.name}
          </Typography>
        </Box>
        {isExpanded && children.map(child => renderPickerModule(child, level + 1))}
        {isExpanded && !isLoading && children.length === 0 && (
          <Typography variant="caption" color="text.secondary"
            sx={{ pl: (level + 1) * 2 + 3, display: 'block', py: 0.25 }}
          >
            No sub-modules
          </Typography>
        )}
      </Box>
    );
  };

  const projectLabel = projectName || (propProjectId ? `Project ${propProjectId}` : null);

  // ── render ───────────────────────────────────────────────────────────────────
  // No project mapping found for this assistant — show informational dialog
  if (!propProjectId) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
        sx={{ '& .MuiPaper-root': { borderRadius: '20px' } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Typography fontWeight={500} fontSize="18pt">qTest Search</Typography>
            <IconButton onClick={handleClose} aria-label="Close"><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 1 }}>
            This assistant does not have a qTest project configured. Contact your team admin to add it to the project mapping.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} variant="secondary">Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      sx={{ '& .MuiPaper-root': { borderRadius: '20px', height: '90vh' } }}
    >
      {/* ── Title ── */}
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography fontWeight={500} fontSize="18pt">qTest Search</Typography>
            {projectLabel && (
              <Typography variant="caption" color="text.secondary">{projectLabel}</Typography>
            )}
          </Box>
          <IconButton onClick={handleClose} aria-label="Close"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'hidden', pt: 1 }}>

        {/* ── Row 1: limit ── */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <TextField
            size="small"
            label="Limit"
            type="number"
            value={limit}
            onChange={e => setLimit(clampLimit(e.target.value))}
            inputProps={{ min: 1, max: 500 }}
            helperText="max 500"
            sx={{ width: 110 }}
          />
        </Box>

        {/* ── Row 2: search bar ── */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by keyword, name, steps… (leave blank to browse by filters)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            autoFocus
          />
          <Button variant="primary" onClick={handleSearch} disabled={loading} sx={{ whiteSpace: 'nowrap', minWidth: 90 }}>
            {loading ? <CircularProgress size={18} /> : 'Search'}
          </Button>
        </Box>

        {/* ── Filters toggle ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="text"
            size="small"
            startIcon={<FilterIcon fontSize="small" />}
            endIcon={filtersOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            onClick={() => setFiltersOpen(p => !p)}
            sx={{ pl: 0 }}
          >
            Filters
            {activeFilterCount > 0 && (
              <Chip label={activeFilterCount} size="small" color="primary" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button
              variant="text"
              size="small"
              onClick={() => { setStatus([]); setPriority([]); setType([]); setModulePath(''); setSelectedModules([]); }}
              sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
            >
              Clear filters
            </Button>
          )}
        </Box>

        {/* ── Filter panel ── */}
        <Collapse in={filtersOpen} unmountOnExit>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Autocomplete multiple size="small" options={STATUS_OPTIONS} value={statusFilter}
                onChange={(_, v) => setStatus(v)}
                renderInput={p => <TextField {...p} label="Status" />}
                sx={{ flex: 1, minWidth: 190 }} />
              <Autocomplete multiple size="small" options={PRIORITY_OPTIONS} value={priorityFilter}
                onChange={(_, v) => setPriority(v)}
                renderInput={p => <TextField {...p} label="Priority" />}
                sx={{ flex: 1, minWidth: 190 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Autocomplete multiple size="small" options={TYPE_OPTIONS} value={typeFilter}
                onChange={(_, v) => setType(v)}
                renderInput={p => <TextField {...p} label="Type" />}
                sx={{ flex: 1, minWidth: 190 }} />
            </Box>
            {/* Module filter: chips for each selected module + text field if none + Browse button */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {selectedModules.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1, alignItems: 'center' }}>
                  {selectedModules.map(m => (
                    <Chip
                      key={m.id}
                      label={m.name}
                      onDelete={() => handleClearModule(m.id)}
                      color="primary"
                      variant="outlined"
                      size="small"
                      icon={<FolderIcon fontSize="small" />}
                      sx={{ maxWidth: 220 }}
                    />
                  ))}
                </Box>
              ) : (
                <TextField
                  size="small"
                  label="Module Path"
                  placeholder="e.g. Claims/Eligibility"
                  value={modulePath}
                  onChange={e => setModulePath(e.target.value)}
                  sx={{ flex: 1 }}
                />
              )}
              <Button
                variant="text"
                size="small"
                startIcon={<FolderIcon fontSize="small" />}
                onClick={handleToggleModulePicker}
                sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {modulePickerOpen ? 'Close Modules' : 'Browse Modules'}
              </Button>
            </Box>
            {/* Inline module tree picker */}
            <Collapse in={modulePickerOpen} unmountOnExit>
              <Box sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                maxHeight: 220,
                overflow: 'auto',
                bgcolor: 'background.paper',
              }}>
                {pickerLoading.has('root') && (
                  <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'center' }}>
                    <CircularProgress size={20} />
                  </Box>
                )}
                {!pickerLoading.has('root') && (pickerModules.get('root') || []).length === 0 && !pickerLoading.size && (
                  <Typography variant="caption" color="text.secondary" sx={{ p: 1.5, display: 'block' }}>
                    No modules found.
                  </Typography>
                )}
                {(pickerModules.get('root') || []).map(mod => renderPickerModule(mod))}
              </Box>
            </Collapse>
          </Box>
          <Divider />
        </Collapse>

        {/* ── Selected summary ── */}
        {selected.size > 0 && (
          <Box sx={{ flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {selected.size} selected
              </Typography>
              <Button
                variant="text" size="small"
                onClick={() => setSelected(new Map())}
                sx={{ fontSize: '0.7rem', p: 0, minWidth: 0, color: 'text.secondary' }}
              >
                Clear
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {Array.from(selected.values()).map(tc => (
                <Chip
                  key={tc.qtestId}
                  label={tc.name}
                  size="small"
                  color="primary"
                  variant="outlined"
                  onDelete={() => toggleItem(tc)}
                  sx={{ maxWidth: 240 }}
                />
              ))}
            </Box>
            <Divider sx={{ mt: 1 }} />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ py: 0.5, flexShrink: 0 }}>{error}</Alert>}

        {/* ── Results ── */}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {!loading && results.length === 0 && !error && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              Type a keyword above and press Search, or expand Filters to narrow by module, status, or type.
            </Typography>
          )}

          {results.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Showing {results.length.toLocaleString()} of {total.toLocaleString()} result{total !== 1 ? 's' : ''}
              </Typography>

              <List dense disablePadding>
                {results.map(result => {
                  const isSelected = selected.has(result.qtestId);
                  return (
                    <ListItem key={result.qtestId} disablePadding sx={{ mb: 0.25 }}>
                      <ListItemButton
                        dense
                        selected={isSelected}
                        onClick={() => toggleItem(result)}
                        sx={{ borderRadius: 1, alignItems: 'flex-start' }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                          <Checkbox checked={isSelected} size="small" color="primary" tabIndex={-1} />
                        </ListItemIcon>
                        <ListItemText
                          disableTypography
                          primary={
                            <Box>
                              <Typography variant="body2" fontWeight="medium">{result.name}</Typography>
                              {result.breadcrumb && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {result.breadcrumb}
                                </Typography>
                              )}
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
                                {result.status    && <Chip label={result.status}    size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />}
                                {result.priority  && <Chip label={result.priority}  size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />}
                                {result.automation && <Chip label={result.automation} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />}
                                {result.tcType    && <Chip label={result.tcType}    size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />}
                              </Box>
                              {result.preview && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: '-webkit-box', overflow: 'hidden', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                                >
                                  {result.preview}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>

              {results.length < total && selectedModules.length <= 1 && (
                <Box sx={{ textAlign: 'center', py: 1.5 }}>
                  <Button variant="action" size="small" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore
                      ? <CircularProgress size={16} />
                      : `Load more (${(total - results.length).toLocaleString()} remaining)`}
                  </Button>
                </Box>
              )}
            </>
          )}
        </Box>
      </DialogContent>

      {/* ── Footer ── */}
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        {selected.size > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {selected.size} test case{selected.size !== 1 ? 's' : ''} selected
          </Typography>
        )}
        <Button onClick={handleClose} variant="secondary">Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="primary"
          disabled={!selected.size || submitting}
          startIcon={submitting ? <CircularProgress size={18} /> : null}
        >
          {submitting ? 'Adding...' : `Add ${selected.size || ''} Test Case${selected.size !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QTestSearchDialog;
