'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveIcon from '@mui/icons-material/Save';
import SyncIcon from '@mui/icons-material/Sync';

const USAGE_OPTIONS = ['required', 'situational', 'not-used'];
const REQUIREMENT_OPTIONS = ['', 'required', 'situational'];

function indexDiagnostics(diagnostics) {
  const diagnosticsByRow = new Map();

  for (const diagnostic of diagnostics || []) {
    const key = diagnostic?.rowId || '__document__';
    const rowDiagnostics = diagnosticsByRow.get(key) || [];
    rowDiagnostics.push(diagnostic);
    diagnosticsByRow.set(key, rowDiagnostics);
  }

  return diagnosticsByRow;
}

function normalizeDiagnosticField(field) {
  return {
    'loop-id': 'loopId',
    'row-id': 'rowId',
    'schema-version': 'schemaVersion',
    'segment-ref': 'segmentRef',
    'segment-requirement': 'segmentRequirement',
  }[field] || field;
}

function Field({ value, onChange, options = null, diagnostics = [], multiline = false, label }) {
  const error = diagnostics.find((diagnostic) => diagnostic.severity === 'error');
  const warning = diagnostics.find((diagnostic) => diagnostic.severity === 'warning');

  return (
    <TextField
      select={Array.isArray(options)}
      size="small"
      fullWidth
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      error={Boolean(error)}
      helperText={error?.message || warning?.message || ''}
      aria-label={label}
      sx={{ minWidth: multiline ? 210 : 130 }}
    >
      {(options || []).map((option) => (
        <MenuItem key={option || 'none'} value={option}>
          {option || 'Not set'}
        </MenuItem>
      ))}
    </TextField>
  );
}

function DiagnosticStatus({ source = [], model = [] }) {
  const allDiagnostics = [...source, ...model];
  if (allDiagnostics.length === 0) {
    return <Chip size="small" label="Valid" color="success" variant="outlined" />;
  }

  const severity = allDiagnostics.some((item) => item.severity === 'error')
    ? 'error'
    : allDiagnostics.some((item) => item.severity === 'warning') ? 'warning' : 'info';

  return (
    <Tooltip
      title={allDiagnostics.map((item) => `${model.includes(item) ? 'Model' : 'Source'}: ${item.message}`).join('\n')}
    >
      <Chip size="small" label={`${allDiagnostics.length} ${severity}`} color={severity} variant="outlined" />
    </Tooltip>
  );
}

export default function CompanionGuideEditor({
  guide,
  hasChanges = false,
  sourceDiagnostics = [],
  modelDiagnostics = [],
  efssPackageVersion,
  disabled = false,
  saving = false,
  onChange,
  onReset,
  onReingest,
  onSave,
}) {
  const [expandedRows, setExpandedRows] = useState(() => new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const loopsById = useMemo(
    () => new Map((guide?.loops || []).map((loop) => [loop.loopId, loop])),
    [guide?.loops],
  );
  const sourceByRow = useMemo(() => indexDiagnostics(sourceDiagnostics), [sourceDiagnostics]);
  const modelByRow = useMemo(() => indexDiagnostics(modelDiagnostics), [modelDiagnostics]);

  const updateElement = (rowId, field, value) => {
    onChange({
      ...guide,
      elements: guide.elements.map((element) => (
        element.rowId === rowId ? { ...element, [field]: value } : element
      )),
    });
  };

  const updateOption = (elementRowId, optionRowId, field, value) => {
    onChange({
      ...guide,
      elements: guide.elements.map((element) => (
        element.rowId === elementRowId
          ? {
              ...element,
              options: element.options.map((option) => (
                option.rowId === optionRowId ? { ...option, [field]: value } : option
              )),
            }
          : element
      )),
    });
  };

  const updateLoop = (loopId, field, value) => {
    onChange({
      ...guide,
      loops: guide.loops.map((loop) => (
        loop.loopId === loopId ? { ...loop, [field]: value } : loop
      )),
    });
  };

  const diagnosticsForField = (rowId, field) => [
    ...(sourceByRow.get(rowId) || []),
    ...(modelByRow.get(rowId) || []),
  ].filter((diagnostic) => !diagnostic.field || normalizeDiagnosticField(diagnostic.field) === field);

  const toggleExpanded = (rowId) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" sx={{ p: 1.5 }}>
        <Box>
          <Typography variant="h6">Companion Guide Editor</Typography>
          <Typography variant="body2" color="text.secondary">
            Schema {guide.schemaVersion} · EFS-S {efssPackageVersion || 'unknown'} · {guide.elements.length} elements
          </Typography>
          <Chip
            size="small"
            label={hasChanges ? 'Edited' : 'Unchanged'}
            color={hasChanges ? 'warning' : 'default'}
            variant="outlined"
            sx={{ mt: 1 }}
          />
        </Box>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
          <Tooltip title={isCollapsed ? 'Expand companion guide editor' : 'Collapse companion guide editor'}>
            <IconButton
              aria-label={isCollapsed ? 'Expand companion guide editor' : 'Collapse companion guide editor'}
              onClick={() => setIsCollapsed((current) => !current)}
            >
              {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
            </IconButton>
          </Tooltip>
          <Button
            variant="primary"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={onSave}
            disabled={disabled || saving}
          >
            {saving ? 'Saving...' : 'Save Guide'}
          </Button>
          <Button variant="action" startIcon={<RestartAltIcon />} onClick={onReset} disabled={disabled}>
            Reset edits
          </Button>
          <Button variant="secondary" startIcon={<SyncIcon />} onClick={onReingest} disabled={disabled}>
            Re-ingest CSV
          </Button>
        </Stack>
      </Stack>

      <Collapse in={!isCollapsed} timeout="auto">
        <Box>
          {(modelByRow.get('__document__') || []).map((diagnostic) => (
            <Alert key={`${diagnostic.code}-${diagnostic.message}`} severity={diagnostic.severity || 'error'} sx={{ mx: 1.5, mb: 1 }}>
              {diagnostic.message}
            </Alert>
          ))}

          <TableContainer sx={{ maxHeight: 620 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 1600 }}>
          <TableHead>
            <TableRow>
              <TableCell width={52} />
              <TableCell>Source row</TableCell>
              <TableCell>Loop name</TableCell>
              <TableCell>Loop segment</TableCell>
              <TableCell>Requirement</TableCell>
              <TableCell>Segment name</TableCell>
              <TableCell>Segment reference</TableCell>
              <TableCell>Usage</TableCell>
              <TableCell>KP element</TableCell>
              <TableCell>Element description</TableCell>
              <TableCell>Diagnostics</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {guide.elements.map((element) => {
              const loop = loopsById.get(element.loopId) || {};
              const options = element.options || [];
              const isExpanded = expandedRows.has(element.rowId);

              return (
                <Fragment key={element.rowId}>
                  <TableRow hover>
                    <TableCell>
                      {options.length > 0 && (
                        <Tooltip title={isExpanded ? 'Hide options' : 'Show options'}>
                          <IconButton size="small" onClick={() => toggleExpanded(element.rowId)}>
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>{element.sourceRow ?? ''}</TableCell>
                    <TableCell>{loop.loopName || ''}</TableCell>
                    <TableCell>
                      <Field
                        label="Loop segment ID"
                        value={loop.segmentId}
                        onChange={(value) => updateLoop(element.loopId, 'segmentId', value)}
                        diagnostics={diagnosticsForField(element.loopId, 'segmentId')}
                      />
                    </TableCell>
                    <TableCell>
                      <Field
                        label="Segment requirement"
                        value={loop.segmentRequirement}
                        options={REQUIREMENT_OPTIONS}
                        onChange={(value) => updateLoop(element.loopId, 'segmentRequirement', value || null)}
                        diagnostics={diagnosticsForField(element.loopId, 'segmentRequirement')}
                      />
                    </TableCell>
                    <TableCell>
                      <Field label="Segment name" value={element.segmentName} onChange={(value) => updateElement(element.rowId, 'segmentName', value)} diagnostics={diagnosticsForField(element.rowId, 'segmentName')} />
                    </TableCell>
                    <TableCell>
                      <Field label="Segment reference" value={element.segmentRef} onChange={(value) => updateElement(element.rowId, 'segmentRef', value)} diagnostics={diagnosticsForField(element.rowId, 'segmentRef')} />
                    </TableCell>
                    <TableCell>
                      <Field label="Usage" value={element.usage} options={USAGE_OPTIONS} onChange={(value) => updateElement(element.rowId, 'usage', value)} diagnostics={diagnosticsForField(element.rowId, 'usage')} />
                    </TableCell>
                    <TableCell>
                      <Field label="KP element" value={element.kpElement} multiline onChange={(value) => updateElement(element.rowId, 'kpElement', value)} diagnostics={diagnosticsForField(element.rowId, 'kpElement')} />
                    </TableCell>
                    <TableCell>
                      <Field label="Element description" value={element.elementDescription} multiline onChange={(value) => updateElement(element.rowId, 'elementDescription', value)} diagnostics={diagnosticsForField(element.rowId, 'elementDescription')} />
                    </TableCell>
                    <TableCell>
                      <DiagnosticStatus source={sourceByRow.get(element.rowId)} model={modelByRow.get(element.rowId)} />
                    </TableCell>
                  </TableRow>
                  {options.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={11} sx={{ p: 0, border: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 1, pl: 8, pr: 2, bgcolor: 'action.hover' }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Options</Typography>
                            {options.map((option) => (
                              <Stack key={option.rowId} direction={{ xs: 'column', lg: 'row' }} spacing={1} sx={{ mb: 1 }} alignItems="flex-start">
                                <Typography variant="body2" sx={{ minWidth: 80, pt: 1 }}>Row {option.sourceRow}</Typography>
                                <Field label="Option usage" value={option.usage} options={USAGE_OPTIONS} onChange={(value) => updateOption(element.rowId, option.rowId, 'usage', value)} diagnostics={diagnosticsForField(option.rowId, 'usage')} />
                                <Field label="Option KP element" value={option.kpElement} onChange={(value) => updateOption(element.rowId, option.rowId, 'kpElement', value)} diagnostics={diagnosticsForField(option.rowId, 'kpElement')} />
                                <Field label="Option description" value={option.elementDescription} onChange={(value) => updateOption(element.rowId, option.rowId, 'elementDescription', value)} diagnostics={diagnosticsForField(option.rowId, 'elementDescription')} />
                                <DiagnosticStatus source={sourceByRow.get(option.rowId)} model={modelByRow.get(option.rowId)} />
                              </Stack>
                            ))}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
            </Table>
          </TableContainer>

          {(guide.legend || []).length > 0 && (
            <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Legend</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {guide.legend.map((entry) => (
                  <Chip key={entry.rowId} size="small" label={`${entry.key}: ${entry.value}`} variant="outlined" />
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}