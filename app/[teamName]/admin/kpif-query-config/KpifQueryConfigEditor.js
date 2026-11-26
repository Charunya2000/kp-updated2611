'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Save, PlayArrow } from '@mui/icons-material';
import {
  getKpifQuery,
  saveKpifQuery,
  testKpifQuery,
} from '@/app/clientServices/kpifQueryService';
import {
  getDefaultKpifTargetDatabase,
  getKpifTargetDatabaseOptions,
} from '@/app/membership-admin/kpif-compare/config/targetDatabases';
import useSnackbar from '@/app/hooks/useSnackbar';

const QUERY_OPTIONS = [
  { key: 'noncon-ca-sproc', label: 'SPROC: Run Batch Procedure' },
  { key: 'select_final_results_ca', label: 'QUERY: Final Results – CA' },
  { key: 'select_final_results_moc', label: 'QUERY: Final Results – MOC' },
  { key: 'select_final_results_ipb_count_ca', label: 'QUERY: IPB Count – CA' },
  { key: 'select_final_results_ipb_count_moc', label: 'QUERY: IPB Count – MOC' },
];

export default function KpifQueryConfigEditor({ teamName, envName }) {
  const databaseOptions = getKpifTargetDatabaseOptions(envName);

  const [selectedQuery, setSelectedQuery] = useState('');
  const [content, setContent] = useState('');
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Test-related state
  const [targetDatabase, setTargetDatabase] = useState(getDefaultKpifTargetDatabase(envName));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [bindParams, setBindParams] = useState({});

  // Extract bind variable names (e.g. :runId, :batchNbr) from the SQL content.
  // PL/SQL DDL (CREATE OR REPLACE PROCEDURE …) won't need user-supplied binds.
  const bindVariables = useMemo(() => {
    if (!content) return [];
    const trimmed = content.replace(/^--[^\n]*\n?/gm, '').trim();
    const isPlSql = /^CREATE\s+(OR\s+REPLACE\s+)?(PROCEDURE|FUNCTION|PACKAGE|TRIGGER)\b/i.test(trimmed);
    if (isPlSql) return [];
    const matches = content.match(/:\w+/g) || [];
    return [...new Set(matches)].map((m) => m.slice(1));
  }, [content]);

  const { SnackbarComponent, showSnackbar } = useSnackbar();

  const loadQuery = useCallback(async (queryKey) => {
    if (!queryKey) return;
    setLoading(true);
    setLoaded(false);
    try {
      const data = await getKpifQuery(teamName, queryKey);
      if (data.error) {
        showSnackbar(data.error, 'error');
        setContent('');
        setSource(null);
      } else {
        setContent(data.content || '');
        setSource(data.source || null);
      }
      setLoaded(true);
    } catch {
      showSnackbar('Failed to load query.', 'error');
      setContent('');
      setSource(null);
    } finally {
      setLoading(false);
    }
  }, [teamName, showSnackbar]);

  function handleQueryChange(e) {
    const queryKey = e.target.value;
    setSelectedQuery(queryKey);
    setTestResult(null);
    setBindParams({});
    loadQuery(queryKey);
  }

  async function handleSave() {
    if (!selectedQuery) return;
    setSaving(true);
    try {
      const result = await saveKpifQuery(teamName, selectedQuery, content);
      if (result.error) {
        showSnackbar(result.error, 'error');
      } else {
        showSnackbar('Query saved successfully.', 'success');
        setSource('database');
      }
    } catch {
      showSnackbar('Failed to save query.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleReloadFromFile() {
    if (!selectedQuery) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/${teamName}/kpif-query?queryKey=${encodeURIComponent(selectedQuery)}&source=file`,
        { headers: { 'Content-Type': 'application/json' } },
      );
      const data = await res.json();
      if (data.error) {
        showSnackbar(data.error, 'error');
      } else {
        setContent(data.content || '');
        setSource(data.source || null);
        showSnackbar('Query reloaded.', 'info');
      }
    } catch {
      showSnackbar('Failed to reload query from file.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const selectedLabel = QUERY_OPTIONS.find((q) => q.key === selectedQuery)?.label || '';

  async function handleTest() {
    if (!selectedQuery || !content?.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testKpifQuery(teamName, selectedQuery, content, targetDatabase, bindParams);
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: 'Failed to execute test query.' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        KPIF Compare Query Editor
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select a query to view and edit. Changes are saved to the database and
        will be used at runtime in place of the default file-based query.
      </Typography>

      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="query-select-label">Select Query</InputLabel>
        <Select
          labelId="query-select-label"
          value={selectedQuery}
          label="Select Query"
          onChange={handleQueryChange}
        >
          {QUERY_OPTIONS.map((opt) => (
            <MenuItem key={opt.key} value={opt.key}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && loaded && selectedQuery && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="subtitle1">{selectedLabel}</Typography>
            {source && (
              <Chip
                label={source === 'database' ? 'Loaded from Database' : 'Loaded from File'}
                color={source === 'database' ? 'primary' : 'default'}
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          {content === null || content === '' ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No content found for this query in the database or on disk.
            </Alert>
          ) : (
            <TextField
              multiline
              fullWidth
              minRows={16}
              maxRows={40}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              slotProps={{
                input: {
                  sx: { fontFamily: 'monospace', fontSize: '0.85rem' },
                },
              }}
              sx={{ mb: 2 }}
            />
          )}

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              startIcon={saving ? <CircularProgress size={18} /> : <Save />}
              onClick={handleSave}
              disabled={saving || !content?.trim()}
            >
              {saving ? 'Saving…' : 'Save to Database'}
            </Button>
            {source === 'database' && (
              <Button variant="secondary" onClick={handleReloadFromFile}>
                Reload from File
              </Button>
            )}

          </Box>

          {/* Test Query Section */}
          <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>Test Query</Typography>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="db-select-label">Database</InputLabel>
                <Select
                  labelId="db-select-label"
                  value={targetDatabase}
                  label="Database"
                  onChange={(e) => setTargetDatabase(e.target.value)}
                >
                  {databaseOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {bindVariables.map((name) => (
                <TextField
                  key={name}
                  size="small"
                  label={`:${name}`}
                  value={bindParams[name] ?? ''}
                  onChange={(e) =>
                    setBindParams((prev) => ({ ...prev, [name]: e.target.value }))
                  }
                  sx={{ minWidth: 140 }}
                />
              ))}

              <Button
                variant="action"
                startIcon={testing ? <CircularProgress size={18} /> : <PlayArrow />}
                onClick={handleTest}
                disabled={testing || !content?.trim()}
              >
                {testing ? 'Running…' : 'Test Query'}
              </Button>
            </Box>
          </Paper>

          {/* Test Results */}
          {testResult && (
            <Box sx={{ mt: 3 }}>
              <Alert
                severity={testResult.success ? 'success' : 'error'}
                sx={{ mb: 2, fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}
              >
                {testResult.message ?? testResult.error}
              </Alert>

              {testResult.columns?.length > 0 && testResult.rows?.length > 0 && (
                <TableContainer
                  component={Paper}
                  variant="outlined"
                  sx={{ maxHeight: 500, overflow: 'auto' }}
                >
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {testResult.columns.map((col) => (
                          <TableCell
                            key={col}
                            sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.8rem' }}
                          >
                            {col}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {testResult.rows.map((row, i) => (
                        <TableRow key={i}>
                          {testResult.columns.map((col) => (
                            <TableCell
                              key={col}
                              sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.8rem' }}
                            >
                              {row[col] != null ? String(row[col]) : ''}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </>
      )}

      <SnackbarComponent />
    </Box>
  );
}
