'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Stack,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Divider,
  IconButton,
  Tooltip,
  Paper
} from '@mui/material';
import {
  PlayArrow,
  CheckCircle,
  Error,
  Warning,
  ExpandMore,
  Schedule,
  Speed,
  AccountTree,
  Refresh,
  BugReport,
  Terminal as TerminalIcon,
  Visibility,
  Close
} from '@mui/icons-material';
import { useGraphExecution } from '../hooks/useGraphExecution.js';

export default function GraphExecutionPanel({ graph, open, onClose }) {
  const {
    executionResult,
    isExecuting,
    executionOrder,
    validationResult,
    validateAndPrepare,
    executeGraphWorkflow,
    getExecutionSummary,
    canExecute,
    hasValidationErrors,
    clearResults
  } = useGraphExecution();

  const [showDetails, setShowDetails] = useState(false);
  const [autoValidate, setAutoValidate] = useState(true);

  // Auto-validate when graph changes
  useEffect(() => {
    if (graph && autoValidate && open) {
      validateAndPrepare(graph);
    }
  }, [graph, autoValidate, open, validateAndPrepare]);

  const handleExecute = async () => {
    if (!graph) return;

    const result = await executeGraphWorkflow(graph, {
      includeMetadata: true,
      logExecution: true
    });

    if (result.success) {
      setShowDetails(true);
    }
  };

  const executionSummary = getExecutionSummary();

  const getStatusColor = () => {
    if (isExecuting) return 'info';
    if (executionResult?.success) return 'success';
    if (executionResult && !executionResult.success) return 'error';
    if (hasValidationErrors) return 'error';
    if (canExecute) return 'success';
    return 'warning';
  };

  const getStatusIcon = () => {
    if (isExecuting) return <Speed />;
    if (executionResult?.success) return <CheckCircle />;
    if (executionResult && !executionResult.success) return <Error />;
    if (hasValidationErrors) return <Error />;
    if (canExecute) return <CheckCircle />;
    return <Warning />;
  };

  const getStatusText = () => {
    if (isExecuting) return 'Executing...';
    if (executionResult?.success) return 'Execution Complete';
    if (executionResult && !executionResult.success) return 'Execution Failed';
    if (hasValidationErrors) return 'Validation Errors';
    if (canExecute) return 'Ready to Execute';
    return 'Validation Required';
  };

  if (!open) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        top: 80,
        right: 16,
        width: 400,
        resize: 'horizontal',
        maxHeight: 'calc(100vh - 100px)',
        overflow: 'auto',
        zIndex: 1100
      }}
    >
      <Box sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" component="div">
            Graph Execution
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>

        {/* Status Card */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ py: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              {getStatusIcon()}
              <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                {getStatusText()}
              </Typography>
              {isExecuting && <LinearProgress sx={{ width: 60 }} />}
            </Stack>

            {/* Execution Summary */}
            {executionSummary && (
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1}>
                  <Chip
                    size="small"
                    label={`${executionSummary.nodesExecuted} nodes`}
                    icon={<AccountTree />}
                  />
                  <Chip
                    size="small"
                    label={`${executionSummary.executionTime}ms`}
                    icon={<Schedule />}
                  />
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Validation Status */}
        {validationResult && (
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Validation Status
              </Typography>

              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TerminalIcon fontSize="small" />
                  <Typography variant="body2">Terminal Nodes:</Typography>
                  <Chip
                    size="small"
                    label={validationResult.validationDetails.terminalNodes.length}
                    color={validationResult.validationDetails.terminalNodes.length > 0 ? 'success' : 'error'}
                  />
                </Stack>

                {validationResult.errors.length > 0 && (
                  <Alert severity="error" variant="outlined" sx={{ py: 0 }}>
                    <Typography variant="caption">
                      {validationResult.errors.length} validation error(s)
                    </Typography>
                  </Alert>
                )}

                {validationResult.warnings.length > 0 && (
                  <Alert severity="warning" variant="outlined" sx={{ py: 0 }}>
                    <Typography variant="caption">
                      {validationResult.warnings.length} warning(s)
                    </Typography>
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Execution Order */}
        {executionOrder.length > 0 && (
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Execution Order
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {executionOrder.map((nodeId, index) => (
                  <Chip
                    key={nodeId}
                    size="small"
                    label={`${index + 1}. ${nodeId}`}
                    variant="outlined"
                    sx={{ fontSize: '0.7rem' }}
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <Stack spacing={1} sx={{ mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={handleExecute}
            disabled={!canExecute || isExecuting || !graph}
            fullWidth
            color={getStatusColor()}
          >
            {isExecuting ? 'Executing Graph...' : 'Execute Graph'}
          </Button>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => validateAndPrepare(graph)}
              disabled={isExecuting || !graph}
              size="small"
              sx={{ flex: 1 }}
            >
              Validate
            </Button>

            <Button
              variant="outlined"
              startIcon={<Visibility />}
              onClick={() => setShowDetails(!showDetails)}
              disabled={!executionResult}
              size="small"
              sx={{ flex: 1 }}
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </Button>
          </Stack>
        </Stack>

        {/* Execution Details */}
        {showDetails && executionResult && (
          <Accordion expanded>
            <AccordionSummary>
              <Typography variant="subtitle2">
                Execution Details
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Stack spacing={2}>
                {/* Final Results */}
                {executionResult.success && executionResult.finalResults && (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Final Results:
                    </Typography>
                    {executionResult.finalResults.map((result, index) => (
                      <Card key={index} variant="outlined" sx={{ mb: 1 }}>
                        <CardContent sx={{ py: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {result.nodeType} ({result.nodeId})
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {JSON.stringify(result.output, null, 2)}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}

                {/* Execution Log */}
                {executionResult.executionLog && executionResult.executionLog.length > 0 && (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Execution Log:
                    </Typography>
                    <List dense>
                      {executionResult.executionLog.map((logEntry, index) => (
                        <ListItem key={index} divider>
                          <ListItemIcon>
                            <CheckCircle color="success" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={`${logEntry.nodeType} (${logEntry.nodeId})`}
                            secondary={new Date(logEntry.executedAt).toLocaleTimeString()}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                {/* Error Details */}
                {!executionResult.success && (
                  <Alert severity="error">
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      Execution Error:
                    </Typography>
                    <Typography variant="body2">
                      {executionResult.error}
                    </Typography>
                    {executionResult.nodeId && (
                      <Typography variant="caption" color="text.secondary">
                        Failed at node: {executionResult.nodeId}
                      </Typography>
                    )}
                  </Alert>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Clear Results */}
        {executionResult && (
          <Button
            variant="text"
            startIcon={<BugReport />}
            onClick={clearResults}
            size="small"
            fullWidth
            sx={{ mt: 1 }}
          >
            Clear Results
          </Button>
        )}
      </Box>
    </Paper>
  );
}