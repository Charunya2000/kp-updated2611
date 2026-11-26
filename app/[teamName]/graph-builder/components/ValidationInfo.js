'use client'

import { useGraphValidation } from '../hooks/useGraphValidation.js';
import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  ExpandMore,
  PlayArrow,
  Terminal,
  BugReport,
  WarningAmber
} from '@mui/icons-material';

export function ValidationInfo({ graph, onValidationChange }) {
  const {
    validationStatus,
    validationResult,
    isValidating,
    performFullValidation,
    debouncedValidation
  } = useGraphValidation();

  const [showErrors, setShowErrors] = useState(false);

  // Real-time validation status updates
  useEffect(() => {
    if (graph) {
      debouncedValidation(graph);
    }
  }, [graph, debouncedValidation]);

  // Notify parent of validation changes
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(validationStatus);
    }
  }, [validationStatus, onValidationChange]);

  const handleFullValidation = async () => {
    const result = await performFullValidation(graph);
    console.log('Full validation result:', result);
  };

  const getStatusColor = () => {
    if (validationStatus.canExecute) return 'success';
    if (validationStatus.hasErrors) return 'error';
    return 'warning';
  };

  const getStatusIcon = () => {
    if (validationStatus.canExecute) return <CheckCircle color="success" />;
    if (validationStatus.hasErrors) return <Error color="error" />;
    return <Warning color="warning" />;
  };

  const getStatusText = () => {
    if (validationStatus.canExecute) return 'Ready to Execute';
    if (validationStatus.hasErrors) return 'Has Errors';
    return 'Has Warnings';
  };

  return (
    <Card variant="outlined" sx={{ minWidth: 300 }}>
      <CardContent>
        {/* Status Header */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          {getStatusIcon()}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {getStatusText()}
          </Typography>
          {isValidating && (
            <Tooltip title="Validating graph structure...">
              <CircularProgress size={20} />
            </Tooltip>
          )}
        </Stack>

        {/* Validation Details */}
        <Stack spacing={1} sx={{ mb: 2 }}>
          {/* Terminal Node Status */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Terminal fontSize="small" />
            <Typography variant="body2">Terminal Node:</Typography>
            <Chip
              size="small"
              icon={validationStatus.hasTerminalNode ? <CheckCircle /> : <Error />}
              label={validationStatus.hasTerminalNode ? 'Present' : 'Missing'}
              color={validationStatus.hasTerminalNode ? 'success' : 'error'}
              variant="outlined"
            />
          </Stack>

          {/* Error Count */}
          {validationStatus.errorCount > 0 && (
            <Stack direction="row" spacing={1} alignItems="center">
              <BugReport fontSize="small" color="error" />
              <Typography variant="body2" color="error">
                Errors: {validationStatus.errorCount}
              </Typography>
            </Stack>
          )}

          {/* Warning Count */}
          {validationStatus.warningCount > 0 && (
            <Stack direction="row" spacing={1} alignItems="center">
              <WarningAmber fontSize="small" color="warning" />
              <Typography variant="body2" color="warning.main">
                Warnings: {validationStatus.warningCount}
              </Typography>
            </Stack>
          )}
        </Stack>

        {/* Full Validation Button */}
        <Button
          variant="contained"
          startIcon={<PlayArrow />}
          onClick={handleFullValidation}
          disabled={isValidating}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        >
          {isValidating ? 'Validating...' : 'Full Validation'}
        </Button>

        {/* Error Details Accordion */}
        {validationResult && !validationResult.isValid && (
          <Accordion
            expanded={showErrors}
            onChange={(event, isExpanded) => setShowErrors(isExpanded)}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              aria-controls="validation-errors-content"
              id="validation-errors-header"
            >
              <Typography variant="body2" color="error">
                Show Validation Errors ({validationResult.errors.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {validationResult.errors.map((error, index) => (
                  <ListItem key={index} divider={index < validationResult.errors.length - 1}>
                    <ListItemIcon>
                      <Error color="error" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={error.message}
                      secondary={error.nodeId ? `Node: ${error.nodeId}` : undefined}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Warnings if present */}
        {validationResult && validationResult.warnings.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {validationResult.warnings.slice(0, 3).map((warning, index) => (
              <Alert key={index} severity="warning" variant="outlined" sx={{ mb: 1 }}>
                <Typography variant="caption">
                  {warning.message}
                </Typography>
              </Alert>
            ))}
            {validationResult.warnings.length > 3 && (
              <Typography variant="caption" color="text.secondary">
                +{validationResult.warnings.length - 3} more warnings
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}