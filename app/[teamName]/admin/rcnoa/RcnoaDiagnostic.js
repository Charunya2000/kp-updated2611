'use client';

import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
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
import {
  ContentCopy,
  DeleteOutline,
  ExpandMore,
  PlayArrow,
} from '@mui/icons-material';
import { diagnoseRcnoaRow } from '@/app/clientServices/rcnoaService';

function fieldCount(value) {
  const rows = value.split(/\r?\n/).filter((row) => row.trim() !== '');
  return rows.length === 1 ? rows[0].split('|').length : 0;
}

function FieldTable({ fields, emptyMessage = 'No data returned.' }) {
  if (!fields?.length) return <Typography variant="body2" color="text.secondary">{emptyMessage}</Typography>;
  return (
    <TableContainer sx={{ maxHeight: 420, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Table size="small" stickyHeader>
        <TableHead><TableRow><TableCell>Column</TableCell><TableCell>Field</TableCell><TableCell>Value</TableCell></TableRow></TableHead>
        <TableBody>
          {fields.map((field) => (
            <TableRow key={`${field.column}-${field.name}`} hover>
              <TableCell sx={{ width: 80 }}>{field.column}</TableCell>
              <TableCell sx={{ minWidth: 240 }}>{field.name}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{field.value || <Box component="span" color="text.disabled">(blank)</Box>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function EvidenceSection({ title, records }) {
  return (
    <Accordion disableGutters elevation={0} sx={{ borderTop: 1, borderColor: 'divider', '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1">{title}</Typography>
          <Chip size="small" variant="outlined" label={records?.length || 0} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {!records?.length && <Typography variant="body2" color="text.secondary">No candidates returned.</Typography>}
        <Stack spacing={2}>
          {(records || []).map((record) => (
            <Box key={record.candidateNumber}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Candidate {record.candidateNumber}</Typography>
              <FieldTable fields={record.fields} />
            </Box>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function RuleTrace({ trace }) {
  return (
    <Box component="section">
      <Typography variant="h6" sx={{ mb: 1 }}>Rule evaluation</Typography>
      {(trace?.evaluations || []).map((evaluation) => (
        <Accordion
          key={`${evaluation.order}-${evaluation.ruleId}`}
          defaultExpanded={evaluation.outcome === 'selected'}
          disableGutters
          elevation={0}
          sx={{ borderTop: 1, borderColor: 'divider', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ width: '100%' }}>
              <Typography variant="subtitle2" sx={{ minWidth: 90 }}>{evaluation.order}. {evaluation.ruleId}</Typography>
              <Chip
                size="small"
                color={evaluation.outcome === 'selected' ? 'success' : 'default'}
                label={evaluation.outcome}
              />
              <Typography variant="body2" color="text.secondary">{evaluation.condition}</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ mb: 1 }}>{evaluation.reason}</Typography>
            {(evaluation.predicates || []).map((predicate) => (
              <Box key={predicate.name} sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1, mb: 1 }}>
                <Typography variant="subtitle2">{predicate.name}: {predicate.result ? 'Passed' : 'Failed'}</Typography>
                <Typography component="pre" variant="caption" sx={{ m: 0, mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {JSON.stringify({ left: predicate.left, operator: predicate.operator, right: predicate.right, normalization: predicate.normalization }, null, 2)}
                </Typography>
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

export default function RcnoaDiagnostic({
  teamName,
  ignoreFirstRcnoColumn = false,
  ignoreLastRcnoColumn = false,
}) {
  const [rcnoRow, setRcnoRow] = useState('');
  const [diagnostic, setDiagnostic] = useState(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const count = fieldCount(rcnoRow);
  const expectedFieldCount = 73
    + (ignoreFirstRcnoColumn ? 1 : 0)
    + (ignoreLastRcnoColumn ? 1 : 0);
  const canProcess = rcnoRow.trim() && count === expectedFieldCount && !isProcessing;

  const processRow = async () => {
    setIsProcessing(true);
    setError('');
    setDiagnostic(null);
    try {
      const result = await diagnoseRcnoaRow(teamName, rcnoRow);
      setDiagnostic(result.diagnostic);
    } catch (processingError) {
      setError(processingError.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const clear = () => {
    setRcnoRow('');
    setDiagnostic(null);
    setError('');
  };

  return (
    <Stack spacing={3}>
      <Box component="section">
        <Typography variant="h5" sx={{ mb: 0.5 }}>Single-row diagnostic</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Uses current RCNOA lookup data and configuration. No run, artifact, or prior decision is saved.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        <TextField
          label="RCNO row"
          value={rcnoRow}
          onChange={(event) => setRcnoRow(event.target.value)}
          multiline
          minRows={5}
          fullWidth
          error={Boolean(rcnoRow) && count !== expectedFieldCount}
          helperText={`${count} of ${expectedFieldCount} fields`}
          slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button
            variant="primary"
            startIcon={isProcessing ? <CircularProgress size={18} color="inherit" /> : <PlayArrow />}
            onClick={processRow}
            disabled={!canProcess}
          >
            {isProcessing ? 'Processing' : 'Process row'}
          </Button>
          <Button variant="text" startIcon={<DeleteOutline />} onClick={clear} disabled={!rcnoRow && !diagnostic}>Clear</Button>
        </Stack>
      </Box>

      {diagnostic && (
        <>
          <Box component="section" sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>Decision</Typography>
              <Chip label={diagnostic.decision.ruleId} color="primary" />
              <Chip label={`Priority ${diagnostic.decision.priority}`} variant="outlined" />
              <Chip label={diagnostic.decision.code} variant="outlined" />
            </Stack>
            <Typography sx={{ mt: 1 }}>{diagnostic.decision.description}</Typography>
            <Typography variant="body2" color="text.secondary">
              Business date {diagnostic.businessDate} | Configuration version {diagnostic.configurationVersion ?? 'unavailable'} | Aging {diagnostic.decision.agingMonths} months
            </Typography>
          </Box>

          <Box component="section" sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>Diagnostic RCNA (78 columns)</Typography>
              <Tooltip title="Copy diagnostic RCNA row">
                <IconButton aria-label="Copy diagnostic RCNA row" onClick={() => navigator.clipboard.writeText(diagnostic.output.serializedDiagnosticRow)}>
                  <ContentCopy />
                </IconButton>
              </Tooltip>
            </Stack>
            <TextField
              value={diagnostic.output.serializedDiagnosticRow}
              multiline
              minRows={4}
              fullWidth
              slotProps={{ input: { readOnly: true, sx: { fontFamily: 'monospace', fontSize: 13 } } }}
            />
          </Box>

          <RuleTrace trace={diagnostic.trace} />

          <Box component="section">
            <Typography variant="h6" sx={{ mb: 1 }}>Lookup evidence</Typography>
            <EvidenceSection title="MDW membership" records={diagnostic.evidence.membership} />
            <EvidenceSection title="EPDS recent 834" records={diagnostic.evidence.recent834} />
            <EvidenceSection title="Prior RCNA" records={diagnostic.evidence.priorRcna} />
          </Box>

          <Accordion disableGutters elevation={0} sx={{ borderTop: 1, borderColor: 'divider', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="h6">Source RCNO fields</Typography></AccordionSummary>
            <AccordionDetails><FieldTable fields={diagnostic.source.fields} /></AccordionDetails>
          </Accordion>
        </>
      )}
    </Stack>
  );
}
