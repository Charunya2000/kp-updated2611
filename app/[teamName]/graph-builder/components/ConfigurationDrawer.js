/**
 * Configuration Drawer Component (Refactored with ResizableContainer)
 * Cleaner implementation using the reusable ResizableContainer
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Drawer,
  IconButton,
  Divider,
  Alert,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { generateNodeConfigForm, validateFormValues } from './SchemaUIGenerator.js';
import ResizableContainer from '../../../components/ResizableContainer.js';

const ConfigurationDrawer = ({
  open,
  onClose,
  selectedNode,
  onSave,
  showSnackbar
}) => {
  const [localConfig, setLocalConfig] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [drawerWidth, setDrawerWidth] = useState(400);

  // Initialize local config when drawer opens or selected node changes
  useEffect(() => {
    if (selectedNode && open) {
      const currentConfig = selectedNode.data?.config || {};
      setLocalConfig(currentConfig);
      setFormErrors({});
    }
  }, [selectedNode, open]);

  // Update local configuration
  const updateLocalConfig = useCallback((field, value) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);

  // Handle resize callback
  const handleResize = useCallback((dimensions) => {
    setDrawerWidth(dimensions.width);
    // You could save this to localStorage or user preferences
    // localStorage.setItem('configDrawerWidth', dimensions.width);
  }, []);

  // Save configuration and close drawer
  const handleSave = useCallback(() => {
    if (!selectedNode) return;

    const validation = validateFormValues(selectedNode.nodeDefinition, localConfig);
    if (validation.hasErrors) {
      setFormErrors(validation.errors);
      showSnackbar('Please fix validation errors before saving', 'error');
      return;
    }

    onSave(selectedNode.id, localConfig);
    onClose();
    showSnackbar('Configuration saved successfully', 'success');
  }, [selectedNode, localConfig, onSave, onClose, showSnackbar]);

  // Cancel and close drawer
  const handleCancel = useCallback(() => {
    setLocalConfig({});
    setFormErrors({});
    onClose();
  }, [onClose]);

  if (!selectedNode) return null;

  const nodeDefinition = selectedNode.nodeDefinition;

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={handleCancel}
      sx={{ overflow: 'hidden' }}
      PaperProps={{ elevation: 0 }}
    >
      <ResizableContainer
        initialWidth={drawerWidth}
        minWidth={400}
        maxWidth={1000}
        resizeDirection="horizontal"
        handlePosition="right"
        onResize={handleResize}
        sx={{ overflow: 'hidden' }}
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
              Configure {nodeDefinition.metadata.type}
            </Typography>
            <IconButton onClick={handleCancel}>
              <Close />
            </IconButton>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {nodeDefinition.metadata.description}
          </Typography>

          <Divider sx={{ mb: 3 }} />

          {/* Scrollable Form Area */}
          <Box sx={{ flexGrow: 1, overflow: 'auto', pr: 1 }}>
            {generateNodeConfigForm(
              nodeDefinition,
              localConfig,
              updateLocalConfig,
              formErrors,
              selectedNode.connectedInputs || new Set(),
              selectedNode.id
            )}

            {/* Display validation errors */}
            {Object.entries(formErrors).filter(([field, error]) => error).length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Please fix the validation errors above
              </Alert>
            )}
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Button variant="primary" onClick={handleSave} fullWidth>
              Save Configuration
            </Button>
            <Button variant="secondary" onClick={handleCancel} fullWidth>
              Cancel
            </Button>
          </Box>
        </Box>
      </ResizableContainer>
    </Drawer>
  );
};

export default ConfigurationDrawer;