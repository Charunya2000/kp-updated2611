/**
 * Schema-Driven UI Generation
 * Automatically generates forms and UI components based on node schemas
 * 
 * Output Field Behavior:
 * - By default, output fields are disabled and read-only
 * - To make an output field editable, add `editable: true` to the field definition
 * - Input fields are always disabled when connected
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Slider,
  Typography,
  Box,
  Chip,
  FormHelperText,
  Switch,
  Tooltip,
} from '@mui/material';
import { UIComponents, NodeDataTypes } from '../services/schemas/nodeSchema.js';
import nodeRegistry from './NodeRegistry.js';

/**
 * Dynamic form field generator based on schema definition
 */
export function generateFormField(fieldKey, fieldDefinition, value, onChange, errors = {}, isInputField = false, isConnected = false, isOutputField = false, nodeType = null, nodeId = null, currentConfig = {}) {
  const {
    type,
    description,
    default: defaultValue,
    validation = {},
    ui = {},
    editable = false // New property to control if output fields are editable
  } = fieldDefinition;

  const fieldError = errors[fieldKey];
  const hasError = !!fieldError;

  // Determine which UI component to use
  const uiComponent = ui.component || getDefaultUIComponent(type);
  const uiProps = ui.props || {};

  // Determine if field should be disabled
  // Input fields are always disabled when connected
  // Output fields are disabled by default unless explicitly marked as editable
  const isFieldDisabled = isInputField || (isOutputField && !editable);

  // Create onChange handler that triggers field onChange handler if registered
  const handleChange = async (event) => {
    const newValue = getValueFromEvent(event, type);
    onChange(fieldKey, newValue);

    // Check if there's an onChange handler registered for this field
    if (nodeType && nodeId && fieldDefinition.onChange) {
      const handler = nodeRegistry.getOnChangeHandler(nodeType, fieldKey);
      if (handler) {
        try {
          // Create a bulk update function that can handle multiple field updates
          const bulkUpdateConfig = (nodeId, updates) => {
            console.log(`🔧 bulkUpdateConfig called for node ${nodeId} with updates:`, updates);
            // Call onChange for each field in the updates object
            Object.entries(updates).forEach(([key, value]) => {
              console.log(`🔧 Updating field ${key} with value:`, value);
              onChange(key, value);
            });
          };

          // Call the onChange handler with the new value and current config
          console.log(`🔧 Calling onChange handler for ${nodeType}.${fieldKey} with value:`, newValue);
          await handler(nodeId, newValue, currentConfig, bulkUpdateConfig);
        } catch (error) {
          console.error(`Error in onChange handler for ${nodeType}.${fieldKey}:`, error);
        }
      }
    }
  };

  const commonProps = {
    label: fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1),
    value: isConnected ? "Connected!" : (value !== undefined ? value : (defaultValue || '')),
    disabled: isFieldDisabled,
    onChange: handleChange,
    error: hasError,
    helperText: fieldError || description,
    fullWidth: true,
    margin: "normal",
    ...uiProps
  };

  switch (uiComponent) {
    case UIComponents.TEXT_FIELD:
      return <TextField {...commonProps} key={fieldKey} />;

    case UIComponents.NUMBER_FIELD:
      return (
        <TextField
          {...commonProps}
          key={fieldKey}
          type="number"
          slotProps={{
            htmlInput: {
              min: validation.min,
              max: validation.max,
              step: validation.step || 1
            }
          }}
        />
      );

    case UIComponents.TEXT_AREA:
      return (
        <TextField
          {...commonProps}
          multiline
          minRows={uiProps.rows || 4}
          maxRows={uiProps.maxRows || null}
        />
      );

    case UIComponents.CHECKBOX:
      return (
        <FormControlLabel
          key={fieldKey}
          control={
            <Checkbox
              checked={!!commonProps.value}
              onChange={commonProps.onChange}
            />
          }
          label={commonProps.label}
        />
      );

    case UIComponents.SELECT:
      // Check for dynamic options in config (e.g., _indexOptions for indexName field)
      const dynamicOptionsKey = `_${fieldKey}Options`;
      const dynamicOptions = currentConfig[dynamicOptionsKey];
      const options = dynamicOptions || validation.options || [];
      return (
        <FormControl disabled={commonProps.disabled} label={commonProps.label} error={commonProps.error} fullWidth={commonProps.fullWidth} margin={commonProps.margin} {...uiProps} key={fieldKey}>
          <InputLabel>{commonProps.label}</InputLabel>
          <Select
            value={commonProps.value}
            onChange={commonProps.onChange}
            label={commonProps.label}
          >
            {options.map((option) => (
              <MenuItem key={option.value || option} value={option.value || option}>
                {option.label || option}
              </MenuItem>
            ))}
          </Select>
          {(fieldError || description) && (
            <FormHelperText error={hasError}>
              {fieldError || description}
            </FormHelperText>
          )}
        </FormControl>
      );

    case UIComponents.MULTI_SELECT:
      // Check for dynamic options in config (e.g., _selectFieldsOptions for selectFields field)
      const dynamicMultiOptionsKey = `_${fieldKey}Options`;
      const dynamicMultiOptions = currentConfig[dynamicMultiOptionsKey];
      const multiOptions = dynamicMultiOptions || validation.options || [];
      const multiValue = Array.isArray(commonProps.value) ? commonProps.value : [];
      return (
        <FormControl {...commonProps} key={fieldKey}>
          <InputLabel>{commonProps.label}</InputLabel>
          <Select
            multiple
            value={multiValue}
            onChange={commonProps.onChange}
            label={commonProps.label}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} size="small" />
                ))}
              </Box>
            )}
          >
            {multiOptions.map((option) => (
              <MenuItem key={option.value || option} value={option.value || option}>
                {option.label || option}
              </MenuItem>
            ))}
          </Select>
          {(fieldError || description) && (
            <FormHelperText error={hasError}>
              {fieldError || description}
            </FormHelperText>
          )}
        </FormControl>
      );

    case UIComponents.SLIDER:
      return (
        <Box key={fieldKey} sx={{ mt: 2, mb: 1 }}>
          <Typography gutterBottom>
            {commonProps.label}: {commonProps.value}
          </Typography>
          <Slider
            value={commonProps.value || validation.min || 0}
            onChange={(event, newValue) => onChange(fieldKey, newValue)}
            min={validation.min || 0}
            max={validation.max || 100}
            step={validation.step || 1}
            valueLabelDisplay="auto"
            slotProps={{
              valueLabel: { sx: { fontSize: '12px', backgroundColor: 'primary.main' } }
            }}
            marks={uiProps.marks}
          />
          {(fieldError || description) && (
            <FormHelperText error={hasError}>
              {fieldError || description}
            </FormHelperText>
          )}
        </Box>
      );

    case UIComponents.JSON_EDITOR:
      return (
        <TextField
          {...commonProps}
          multiline
          rows={6}
          placeholder="Enter valid JSON..."
          onChange={(event) => {
            try {
              const jsonValue = JSON.parse(event.target.value);
              onChange(fieldKey, jsonValue);
            } catch (e) {
              // Keep raw string until valid JSON
              onChange(fieldKey, event.target.value);
            }
          }}
          value={typeof commonProps.value === 'object'
            ? JSON.stringify(commonProps.value, null, 2)
            : commonProps.value}
        />
      );

    case UIComponents.CODE_EDITOR:
      return (
        <TextField
          {...commonProps}
          multiline
          rows={8}
          placeholder="Enter code..."
          InputProps={{
            sx: {
              fontFamily: 'monospace',
              fontSize: '14px',
            }
          }}
        />
      );

    default:
      return <TextField {...commonProps} />;
  }
}

/**
 * Get default UI component based on data type
 */
function getDefaultUIComponent(dataType) {
  switch (dataType) {
    case NodeDataTypes.STRING:
      return UIComponents.TEXT_FIELD;
    case NodeDataTypes.NUMBER:
      return UIComponents.NUMBER_FIELD;
    case NodeDataTypes.BOOLEAN:
      return UIComponents.CHECKBOX;
    case NodeDataTypes.ARRAY:
      return UIComponents.MULTI_SELECT;
    case NodeDataTypes.OBJECT:
      return UIComponents.JSON_EDITOR;
    case NodeDataTypes.CODE:
      return UIComponents.CODE_EDITOR;
    case NodeDataTypes.SELECT:
      return UIComponents.SELECT;
    case NodeDataTypes.MULTI_SELECT:
      return UIComponents.MULTI_SELECT;
    default:
      return UIComponents.TEXT_FIELD;
  }
}

/**
 * Extract value from event based on field type
 */
function getValueFromEvent(event, type) {
  switch (type) {
    case NodeDataTypes.BOOLEAN:
      return event.target.checked;
    case NodeDataTypes.NUMBER:
      return Number(event.target.value);
    case NodeDataTypes.ARRAY:
    case NodeDataTypes.MULTI_SELECT:
      return event.target.value; // Already handled by MUI Select
    default:
      return event.target.value;
  }
}

/**
 * Generate complete form for node configuration
 */
export function generateNodeConfigForm(nodeDefinition, currentConfig = {}, onChange, errors = {}, connectedInputs = new Set(), nodeId = null) {
  if (!nodeDefinition || !nodeDefinition.inputSchema) {
    return <Typography color="error">Invalid node definition</Typography>;
  }

  const { inputSchema, stateSchema, outputSchema, metadata } = nodeDefinition;
  const nodeType = metadata?.type;
  const inputProperties = inputSchema.properties || {};
  const stateProperties = stateSchema?.properties || {};
  const outputProperties = outputSchema?.properties || {};

  return (
    <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
      {/* Input Configuration */}
      {Object.keys(inputProperties).length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Input Configuration
          </Typography>
          {Object.entries(inputProperties).map(([key, definition]) => {
            const isConnected = connectedInputs.has(key);
            return generateFormField(
              key,
              definition,
              isConnected ? "Connected!" : currentConfig[key],
              onChange,
              errors,
              true, // isInputField = true
              isConnected,
              false, // isOutputField = false
              nodeType,
              nodeId,
              currentConfig
            );
          })}
        </Box>
      )}

      {/* State Configuration */}
      {Object.keys(stateProperties).length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            State Configuration
          </Typography>
          {Object.entries(stateProperties).map(([key, definition]) =>
            generateFormField(
              key, // Use the actual key, not prefixed
              definition,
              currentConfig[key], // Use actual key for value lookup
              onChange,
              errors,
              false, // isInputField = false
              false, // isConnected = false
              false, // isOutputField = false
              nodeType,
              nodeId,
              currentConfig
            )
          )}
        </Box>
      )}

      {/* Output Configuration */}
      {Object.keys(outputProperties).length > 0 && Object.values(outputProperties).some(def => def.editable) && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Output Configuration
          </Typography>
          {Object.entries(outputProperties)
            .filter(([key, definition]) => definition.editable).map(([key, definition]) =>
              generateFormField(
                key, // Use the actual key, not prefixed
                definition,
                currentConfig[key], // Use actual key for value lookup
                onChange,
                errors,
                false, // isInputField = false
                false, // isConnected = false
                true, // isOutputField = true
                nodeType,
                nodeId,
                currentConfig
              )
            )}
        </Box>
      )}
    </Box>
  );
}

/**
 * Generate compact inline form for node body
 */
/**
 * Generate inline node form with input/state field distinction
 */
export function generateInlineNodeForm(nodeDefinition, currentConfig = {}, onChange, errors = {}, maxFields = 10, connectedInputs = new Set(), nodeId = null) {
  if (!nodeDefinition || !nodeDefinition.inputSchema) {
    return null;
  }

  const { inputSchema, stateSchema, outputSchema, metadata } = nodeDefinition;
  const nodeType = metadata?.type;
  const inputProperties = inputSchema.properties || {};
  const stateProperties = stateSchema?.properties || {};
  const outputProperties = outputSchema?.properties || {};

  // Combine input, state, and output properties, marking their types
  const allProperties = {};

  // Add input properties with input flag
  Object.entries(inputProperties).forEach(([key, def]) => {
    allProperties[key] = { ...def, _isInput: true, _isOutput: false };
  });

  // Add state properties
  Object.entries(stateProperties || {}).forEach(([key, def]) => {
    // Show persistent state fields, or state fields without explicit persistent flag (default to showing them)
    if (def.persistent !== false) {
      allProperties[key] = { ...def, _isInput: false, _isOutput: false }; // Use actual key, not prefixed
    }
  });

  // Add output properties with output flag
  Object.entries(outputProperties).forEach(([key, def]) => {
    allProperties[key] = { ...def, _isInput: false, _isOutput: true };
  });

  // Get the most important fields (required first, then by order)
  const required = inputSchema.required || [];
  const sortedEntries = Object.entries(allProperties).sort(([keyA], [keyB]) => {
    const aRequired = required.includes(keyA);
    const bRequired = required.includes(keyB);
    if (aRequired && !bRequired) return -1;
    if (!aRequired && bRequired) return 1;
    return 0;
  });

  const displayedFields = sortedEntries.slice(0, maxFields);

  if (displayedFields.length === 0) return null;

  return (
    <Box sx={{ mt: 1 }}>
      {displayedFields.map(([key, definition]) => {
        const fieldValue = currentConfig[key];
        const isInputField = definition._isInput;
        const isOutputField = definition._isOutput;
        const isConnected = connectedInputs.has(key);

        return generateCompactFormField(
          key,
          definition,
          fieldValue,
          onChange,
          errors,
          isInputField,
          isConnected,
          isOutputField,
          nodeType,
          nodeId,
          currentConfig
        );
      })}
      {sortedEntries.length > maxFields && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          +{sortedEntries.length - maxFields} more fields (click ⚙️ for full editor)
        </Typography>
      )}
    </Box>
  );
}

/**
 * Generate compact form field for inline display
 */
export function generateCompactFormField(fieldKey, fieldDefinition, value, onChange, errors = {}, isInputField = false, isConnected = false, isOutputField = false, nodeType = null, nodeId = null, currentConfig = {}) {
  const {
    type,
    description,
    default: defaultValue,
    validation = {},
    ui = {},
    editable = false
  } = fieldDefinition;

  const fieldError = errors[fieldKey];
  const hasError = !!fieldError;
  const uiComponent = ui.component || getDefaultUIComponent(type);
  const uiProps = ui.props || {};

  const currentValue = isConnected ? "Connected!" : (value !== undefined ? value : (defaultValue || ''));

  const handleChange = async (event) => {
    const newValue = getValueFromEvent(event, type);
    onChange(fieldKey, newValue);

    // Check if there's an onChange handler registered for this field
    if (nodeType && nodeId && fieldDefinition.onChange) {
      const handler = nodeRegistry.getOnChangeHandler(nodeType, fieldKey);
      if (handler) {
        try {
          // Create a bulk update function that can handle multiple field updates
          const bulkUpdateConfig = (nodeId, updates) => {
            console.log(`🔧 [Compact] bulkUpdateConfig called for node ${nodeId} with updates:`, updates);
            // Call onChange for each field in the updates object
            Object.entries(updates).forEach(([key, value]) => {
              console.log(`🔧 [Compact] Updating field ${key} with value:`, value);
              onChange(key, value);
            });
          };

          // Call the onChange handler with the new value and current config
          console.log(`🔧 [Compact] Calling onChange handler for ${nodeType}.${fieldKey} with value:`, newValue);
          await handler(nodeId, newValue, currentConfig, bulkUpdateConfig);
        } catch (error) {
          console.error(`Error in onChange handler for ${nodeType}.${fieldKey}:`, error);
        }
      }
    }
  };

  // Determine if field should be disabled
  // Input fields are always disabled when connected
  // Output fields are disabled by default unless explicitly marked as editable
  const isFieldDisabled = isInputField || (isOutputField && !editable);

  // Common compact styling
  const compactProps = {
    size: "small",
    margin: "dense",
    fullWidth: true,
    error: hasError,
    disabled: isFieldDisabled,
    sx: {
      mb: 1,
      position: 'relative' // For handle positioning
    }
  };

  const fieldLabel = fieldKey.replace('state_', '').charAt(0).toUpperCase() +
    fieldKey.replace('state_', '').slice(1);

  switch (uiComponent) {
    case UIComponents.TEXT_FIELD:
      return (
        <Box key={fieldKey} sx={{ position: 'relative' }}>
          {isInputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="left"
            >
              <Handle
                type="target"
                position={Position.Left}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  left: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: isConnected ? '#4caf50' : '#1976d2',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          {isOutputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="right"
            >
              <Handle
                type="source"
                position={Position.Right}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  right: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: '#4caf50',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          <TextField
            {...compactProps}
            label={fieldLabel}
            value={currentValue}
            onChange={handleChange}
            placeholder={isInputField ? "Requires connection" : description}
            helperText={fieldError}
          />
        </Box>
      );

    case UIComponents.NUMBER_FIELD:
      return (
        <Box key={fieldKey} sx={{ position: 'relative' }}>
          {isInputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="left"
            >
              <Handle
                type="target"
                position={Position.Left}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  left: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: isConnected ? '#4caf50' : '#1976d2',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          {isOutputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="right"
            >
              <Handle
                type="source"
                position={Position.Right}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  right: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: '#4caf50',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          <TextField
            {...compactProps}
            label={fieldLabel}
            type="number"
            value={currentValue}
            onChange={handleChange}
            placeholder={description}
            helperText={fieldError}
            slotProps={{
              htmlInput: {
                min: validation.min,
                max: validation.max,
                step: validation.step || 1
              }
            }}
          />
        </Box>
      );

    case UIComponents.SELECT:
      // Check for dynamic options in config
      const selectDynamicOptionsKey = `_${fieldKey}Options`;
      const selectDynamicOptions = currentConfig[selectDynamicOptionsKey];
      const options = selectDynamicOptions || validation.options || uiProps.options || [];
      return (
        <Box key={fieldKey} sx={{ position: 'relative' }}>
          {isInputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="left"
            >
              <Handle
                type="target"
                position={Position.Left}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  left: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: isConnected ? '#4caf50' : '#1976d2',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          {isOutputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="right"
            >
              <Handle
                type="source"
                position={Position.Right}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  right: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: '#4caf50',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          <FormControl {...compactProps}>
            <InputLabel>{fieldLabel}</InputLabel>
            <Select
              value={currentValue}
              onChange={handleChange}
              label={fieldLabel}
            >
              {options.map((option) => (
                <MenuItem key={option.value || option} value={option.value || option}>
                  {option.label || option}
                </MenuItem>
              ))}
            </Select>
            {fieldError && <FormHelperText error>{fieldError}</FormHelperText>}
          </FormControl>
        </Box>
      );

    case UIComponents.MULTI_SELECT:
      // Check for dynamic options in config
      const multiSelectDynamicOptionsKey = `_${fieldKey}Options`;
      const multiSelectDynamicOptions = currentConfig[multiSelectDynamicOptionsKey];
      const multiSelectOptions = multiSelectDynamicOptions || validation.options || uiProps.options || [];
      const multiSelectValue = Array.isArray(currentValue) ? currentValue : [];
      return (
        <Box key={fieldKey} sx={{ position: 'relative' }}>
          {isInputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="left"
            >
              <Handle
                type="target"
                position={Position.Left}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  left: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: isConnected ? '#4caf50' : '#1976d2',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          {isOutputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="right"
            >
              <Handle
                type="source"
                position={Position.Right}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  right: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: '#4caf50',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          <FormControl {...compactProps}>
            <InputLabel>{fieldLabel}</InputLabel>
            <Select
              multiple
              value={multiSelectValue}
              onChange={handleChange}
              label={fieldLabel}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {multiSelectOptions.map((option) => (
                <MenuItem key={option.value || option} value={option.value || option}>
                  {option.label || option}
                </MenuItem>
              ))}
            </Select>
            {fieldError && <FormHelperText error>{fieldError}</FormHelperText>}
          </FormControl>
        </Box>
      );

    case UIComponents.CHECKBOX:
      return (
        <Box key={fieldKey} sx={{ position: 'relative', mb: 1 }}>
          {isInputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="left"
            >
              <Handle
                type="target"
                position={Position.Left}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  left: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: isConnected ? '#4caf50' : '#1976d2',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          {isOutputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="right"
            >
              <Handle
                type="source"
                position={Position.Right}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  right: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: '#4caf50',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={!!currentValue}
                onChange={handleChange}
              />
            }
            label={fieldLabel}
          />
        </Box>
      );

    case UIComponents.SLIDER:
      return (
        <Box key={fieldKey} sx={{ mb: 1, position: 'relative' }}>
          {isInputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="left"
            >
              <Handle
                type="target"
                position={Position.Left}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  left: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: isConnected ? '#4caf50' : '#1976d2',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          {isOutputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="right"
            >
              <Handle
                type="source"
                position={Position.Right}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  right: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: '#4caf50',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          <Typography variant="caption" gutterBottom>
            {fieldLabel}: {currentValue}
          </Typography>
          <Slider
            value={currentValue || validation.min || 0}
            onChange={(event, newValue) => onChange(fieldKey, newValue)}
            min={validation.min || 0}
            max={validation.max || 100}
            step={validation.step || 1}
            size="small"
            valueLabelDisplay="auto"
            slotProps={{
              valueLabel: { sx: { fontSize: '12px', backgroundColor: 'primary.main' } }
            }}
          />
          {fieldError && (
            <FormHelperText error sx={{ mt: 0 }}>{fieldError}</FormHelperText>
          )}
        </Box>
      );

    case UIComponents.TEXT_AREA:
      return (
        <Box key={fieldKey} sx={{ position: 'relative' }}>
          {isInputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="left"
            >
              <Handle
                type="target"
                position={Position.Left}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  left: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: isConnected ? '#4caf50' : '#1976d2',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          {isOutputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="right"
            >
              <Handle
                type="source"
                position={Position.Right}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  right: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: '#4caf50',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          <TextField
            {...compactProps}
            label={fieldLabel}
            value={currentValue}
            onChange={handleChange}
            multiline
            minRows={2}
            maxRows={8}
            placeholder={description}
            helperText={fieldError}
          />
        </Box>
      );

    default:
      return (
        <Box key={fieldKey} sx={{ position: 'relative' }}>
          {isInputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="left"
            >
              <Handle
                type="target"
                position={Position.Left}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  left: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: isConnected ? '#4caf50' : '#1976d2',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          {isOutputField && (
            <Tooltip
              title={`${fieldKey} (${type}): ${description || ''}`}
              placement="right"
            >
              <Handle
                type="source"
                position={Position.Right}
                id={fieldKey}
                style={{
                  position: 'absolute',
                  right: -10,
                  top: 12,
                  width: 12,
                  height: 12,
                  border: '2px solid #fff',
                  backgroundColor: '#4caf50',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )}
          <TextField
            {...compactProps}
            label={fieldLabel}
            value={currentValue}
            onChange={handleChange}
            placeholder={description}
            helperText={fieldError}
          />
        </Box>
      );
  }
}

/**
 * Validate form values against schema
 */
export function validateFormValues(schema, values, connectedInputs = new Set()) {
  const errors = {};
  const properties = schema.properties || {};
  const required = schema.required || [];

  // Check required fields, but skip connected inputs
  required.forEach(fieldName => {
    // Skip validation for connected input fields
    if (connectedInputs.has(fieldName)) {
      return;
    }

    if (!values[fieldName] && values[fieldName] !== 0 && values[fieldName] !== false) {
      errors[fieldName] = `${fieldName} is required`;
    }
  });

  // Check field validations
  Object.entries(properties).forEach(([fieldName, definition]) => {
    const value = values[fieldName];
    const validation = definition.validation || {};

    if (value !== undefined && value !== null && value !== '') {
      // Type validation
      if (!validateFieldType(value, definition.type)) {
        errors[fieldName] = `Invalid type for ${fieldName}`;
        return;
      }

      // Custom validations
      if (validation.min !== undefined && Number(value) < validation.min) {
        errors[fieldName] = `Minimum value is ${validation.min}`;
      }
      if (validation.max !== undefined && Number(value) > validation.max) {
        errors[fieldName] = `Maximum value is ${validation.max}`;
      }
      if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
        errors[fieldName] = `Invalid format for ${fieldName}`;
      }
      if (validation.minLength && value.length < validation.minLength) {
        errors[fieldName] = `Minimum length is ${validation.minLength}`;
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        errors[fieldName] = `Maximum length is ${validation.maxLength}`;
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate field type
 */
function validateFieldType(value, expectedType) {
  switch (expectedType) {
    case NodeDataTypes.STRING:
    case NodeDataTypes.CODE:
      return typeof value === 'string';
    case NodeDataTypes.NUMBER:
      return typeof value === 'number' && !isNaN(value);
    case NodeDataTypes.BOOLEAN:
      return typeof value === 'boolean';
    case NodeDataTypes.ARRAY:
      return Array.isArray(value);
    case NodeDataTypes.OBJECT:
    case NodeDataTypes.JSON:
      return typeof value === 'object' && value !== null;
    default:
      return true; // Allow any type for unknown types
  }
}