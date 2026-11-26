/**
 * Dynamic Node Component
 * Renders nodes based on their schema definition
 */

import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { generateInlineNodeForm } from './SchemaUIGenerator.js';

// Simple debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const DynamicNode = memo(({ id, data, selected }) => {
  const {
    nodeDefinition,
    config = {},
    onConfigure,
    onConfigUpdate,
    state = {},
    connectedInputs = new Set() // Add connected inputs tracking
  } = data;

  const [inlineConfig, setInlineConfig] = useState(config);
  const [inlineErrors, setInlineErrors] = useState({});

  // Use ref to store latest onConfigUpdate to avoid recreating debounced function
  const onConfigUpdateRef = useRef(onConfigUpdate);
  useEffect(() => {
    onConfigUpdateRef.current = onConfigUpdate;
  }, [onConfigUpdate]);

  // Update inline config when config prop changes (from drawer saves)
  useEffect(() => {
    setInlineConfig(config);
  }, [config]);

  // Handle inline configuration changes with auto-save
  const handleInlineConfigChange = useCallback((field, value) => {
    setInlineConfig(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (inlineErrors[field]) {
      setInlineErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [inlineErrors]);

  // Auto-save inline configuration with debouncing
  const lastInlineConfigRef = useRef(inlineConfig);
  const debouncedSaveTimeoutRef = useRef(null);

  const performSave = useCallback((configToSave) => {
    if (onConfigUpdateRef.current) {
      // Call without showing notification for auto-save
      onConfigUpdateRef.current(id, configToSave, false);
    }
  }, [id]);

  // Trigger save when inline config changes
  useEffect(() => {
    // Only save if the inline config has actually changed from what we last processed
    if (JSON.stringify(inlineConfig) !== JSON.stringify(lastInlineConfigRef.current)) {
      lastInlineConfigRef.current = inlineConfig;

      // Clear any existing timeout
      if (debouncedSaveTimeoutRef.current) {
        clearTimeout(debouncedSaveTimeoutRef.current);
      }

      // Set new timeout for debounced save
      debouncedSaveTimeoutRef.current = setTimeout(() => {
        performSave(inlineConfig);
      }, 500);
    }
  }, [inlineConfig, performSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debouncedSaveTimeoutRef.current) {
        clearTimeout(debouncedSaveTimeoutRef.current);
      }
    };
  }, []);

  if (!nodeDefinition) {
    return (
      <Paper
        elevation={selected ? 8 : 2}
        sx={{
          p: 2,
          minWidth: 200,
          border: selected ? '2px solid #1976d2' : '1px solid #ddd',
          bgcolor: '#ffebee'
        }}
      >
        <Typography color="error">Invalid Node</Typography>
      </Paper>
    );
  }

  const { metadata, inputSchema, outputSchema } = nodeDefinition;
  const inputProperties = inputSchema.properties || {};
  const outputProperties = outputSchema.properties || {};

  // Get node color from metadata or default
  const nodeColor = metadata.color || '#f5f5f5';
  const borderColor = selected ? '#1976d2' : 'card.border.main';

  return (
    <Box
      sx={{
        minWidth: 280,
        maxWidth: 400,
        border: `2px solid`,
        borderColor: borderColor,
        bgcolor: 'background.default',
        position: 'relative',
        borderRadius: '8px',
        boxShadow: selected ? '0 0 10px rgba(25, 118, 210, 0.5)' : 'none',
        '&:hover': { borderColor: '#1976d2' },
        fontSize: '12px',
        overflow: 'visible', // Ensure handles are visible outside the node
        cursor: 'default'
      }}
    >
      {/* Drag Handle */}
      <Box
        className="node-drag-handle"
        sx={{
          cursor: 'grab',
          p: 1,
          bgcolor: nodeColor,
          borderBottom: '1px solid #ddd',
          borderRadius: '7px 7px 0 0',
          color: 'color.pebble'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              {metadata.displayName}
            </Typography>
          </Box>

          <Tooltip title="Open full configuration editor" placement="top">
            <IconButton
              size="small"
              onClick={() => {
                // Clear any pending debounced save since we're force saving now
                if (debouncedSaveTimeoutRef.current) {
                  clearTimeout(debouncedSaveTimeoutRef.current);
                  debouncedSaveTimeoutRef.current = null;
                }

                // Pass the current inline config to force save before opening drawer
                onConfigure?.(id, nodeDefinition, data, inlineConfig);
              }}
              sx={{ p: 0.5, color: 'white' }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography variant="subtitle2" sx={{ mt: 0.5, color: 'color.graphiteDeep' }}>
          {metadata.description}
        </Typography>

        {metadata.category && (
          <Chip
            label={metadata.category}
            size="small"
            sx={{ mt: 0.5, fontSize: '10px', height: '16px', color: 'color.pebble', backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
          />
        )}
      </Box>

      {/* Node Content */}
      <Box sx={{ p: 1 }}>

        {/* Always-visible Inline Configuration Form */}
        {(nodeDefinition.inputSchema?.properties || nodeDefinition.stateSchema?.properties) && (
          <Box sx={{ mt: 1 }}>
            {generateInlineNodeForm(
              nodeDefinition,
              inlineConfig,
              handleInlineConfigChange,
              inlineErrors,
              10, // Show more fields inline since we always show the form
              connectedInputs, // Pass connected inputs information
              id // Pass node id for onChange handlers
            )}
          </Box>
        )}

        {/* Show message if no configurable fields
        {(!nodeDefinition.inputSchema?.properties || Object.keys(nodeDefinition.inputSchema.properties).length === 0) && (
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No configuration required
          </Typography>
        )} */}
      </Box>
    </Box>
  );
});

DynamicNode.displayName = 'DynamicNode';

export default DynamicNode;