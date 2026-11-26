/**
 * GraphCodeViewer Component
 * A resizable drawer for viewing and editing the graph configuration as JSON
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Drawer,
} from '@mui/material';
import { Close, ContentCopy } from '@mui/icons-material';
import ResizableContainer from '../../../components/ResizableContainer.js';

const GraphCodeViewer = ({
  open,
  onClose,
  getLatestJson, // Function to get the latest JSON from graph state
  onApplyChanges,
  showSnackbar
}) => {
  const [drawerWidth, setDrawerWidth] = useState(800);
  const [localJsonConfig, setLocalJsonConfig] = useState('');

  // Load fresh JSON when drawer opens
  useEffect(() => {
    if (open && getLatestJson) {
      const freshJson = getLatestJson();
      setLocalJsonConfig(freshJson);
    }
  }, [open, getLatestJson]);

  // Handle resize callback
  const handleResize = useCallback((dimensions) => {
    setDrawerWidth(dimensions.width);
    // Save to localStorage for persistence
    localStorage.setItem('graphCodeViewerWidth', dimensions.width.toString());
  }, []);

  // Handle copy to clipboard
  const handleCopyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(localJsonConfig).then(() => {
      showSnackbar('JSON copied to clipboard', 'success');
    }).catch(() => {
      showSnackbar('Failed to copy to clipboard', 'error');
    });
  }, [localJsonConfig, showSnackbar]);

  // Handle apply changes
  const handleApplyChanges = useCallback(() => {
    try {
      const config = JSON.parse(localJsonConfig);
      onApplyChanges(config);
      onClose();
      showSnackbar('Configuration applied successfully', 'success');
    } catch (error) {
      showSnackbar('Invalid JSON format. Please check your configuration.', 'error');
    }
  }, [localJsonConfig, onApplyChanges, onClose, showSnackbar]);

  // Handle local JSON text changes
  const handleJsonChange = useCallback((newValue) => {
    setLocalJsonConfig(newValue);
  }, []);

  // Handle drawer close - optionally ask user about unsaved changes
  const handleClose = useCallback(() => {
    // Check if there are unsaved changes
    const currentJson = getLatestJson ? getLatestJson() : '';
    if (localJsonConfig !== currentJson) {
      // Could add confirmation dialog here if desired
      // For now, just close and lose changes
    }
    onClose();
  }, [localJsonConfig, getLatestJson, onClose]);

  // Load saved width from localStorage on mount
  React.useEffect(() => {
    const savedWidth = localStorage.getItem('graphCodeViewerWidth');
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (width >= 400 && width <= 1200) {
        setDrawerWidth(width);
      }
    }
  }, []);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{ elevation: 0 }}
    >
      <ResizableContainer
        initialWidth={drawerWidth}
        minWidth={500}
        maxWidth={1000}
        resizeDirection="horizontal"
        handlePosition="left"
        onResize={handleResize}
      >
        <Box sx={{
          width: '100%',
          p: 3,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" component="h2">
              Graph Configuration (JSON)
            </Typography>
            <IconButton onClick={handleClose}>
              <Close />
            </IconButton>
          </Box>          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This is the JSON representation of your current graph. You can copy this configuration or make advanced edits.
          </Typography>

          {/* JSON Editor */}
          <Box sx={{ position: 'relative', flexGrow: 1, mb: 3 }}>
            <TextField
              multiline
              fullWidth
              value={localJsonConfig}
              onChange={(e) => handleJsonChange(e.target.value)}
              variant="outlined"
              slotProps={{
                input: {
                  sx: {
                    height: '100%',
                    py: 0.5,
                    pl: 0.5,
                    pr: 0,
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: 1.4,
                  }
                }
              }}
              sx={{
                height: '100%',
                '& .MuiOutlinedInput-root': {
                  height: '100%',
                  alignItems: 'flex-start',
                },
                '& .MuiInputBase-input': {
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace',
                  fontSize: '12px',
                  lineHeight: 1.4,
                  height: '100% !important',
                  overflow: 'auto !important',
                  resize: 'none',
                }
              }}
            />

            {/* Copy Button */}
            <IconButton
              onClick={handleCopyToClipboard}
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                zIndex: 1000,
                backgroundColor: 'primary.main',
                color: 'white',
                width: 32,
                height: 32,
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
              }}
            >
              <ContentCopy sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          {/* Action Buttons */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: 2,
            borderTop: 1,
            borderColor: 'divider',
            flexShrink: 0
          }}>
            <Button
              variant="primary"
              onClick={handleApplyChanges}
              fullWidth
            >
              Apply Changes
            </Button>
            <Button
              variant="secondary"
              onClick={onClose}
              fullWidth
            >
              Close
            </Button>
          </Box>
        </Box>
      </ResizableContainer>
    </Drawer>
  );
};

export default GraphCodeViewer;