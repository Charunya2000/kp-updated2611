'use client';

/**
 * NodeList Component
 * 
 * A sidebar component that displays available nodes organized by categories.
 * Users can hover over categories to see a popup menu with nodes that can be dragged to the canvas or clicked to add them.
 * 
 * Features:
 * - Collapsible sidebar (can be minimized to save space)
 * - Categorized node display with hover popup menus
 * - Drag and drop support for adding nodes to the canvas
 * - Click to add nodes as an alternative to dragging
 * - Visual feedback during drag operations
 * - Node count badges for each category
 * - Tooltips for better UX
 * - Scrollable popup menus for categories with many nodes
 * 
 * Props:
 * - onNodeSelect: Callback when a node is selected (clicked or dropped)
 * - collapsed: Boolean to control if the sidebar is collapsed
 * - onToggleCollapse: Callback to toggle the collapsed state
 * - registryInitialized: Boolean indicating if the node registry has been initialized
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
  Chip,
  Paper,
  Divider,
  Tooltip,
  Popper,
  Button,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Add,
  DragIndicator,
  SmartToy,
  Input,
  Output,
  Settings,
  AccountTree,
  Storage,
  Api,
  Build,
  Article,
  Save,
  SaveAs,
  FolderOpen,
  Publish,
} from '@mui/icons-material';
import nodeRegistry from './NodeRegistry.js';

const GraphToolbar = ({
  onNodeSelect,
  collapsed = false,
  onToggleCollapse,
  registryInitialized = false,
  // Graph action handlers
  onLoadGraph,
  onSaveGraph,
  onSaveAs,
  isSaving = false,
  hasUnsavedChanges = false
}) => {
  const [categories, setCategories] = useState([]);
  const [nodesByCategory, setNodesByCategory] = useState({});
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const hoverTimeoutRef = useRef(null);

  useEffect(() => {
    // Only proceed if registry is initialized
    if (!registryInitialized) {
      return;
    }

    // Get all categories and nodes from the registry
    const allCategories = nodeRegistry.getCategories();
    const categorizedNodes = {};

    allCategories.forEach(category => {
      categorizedNodes[category] = nodeRegistry.getNodesByCategory(category);
    });

    setCategories(allCategories.sort());
    setNodesByCategory(categorizedNodes);
  }, [registryInitialized]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleCategoryHover = (category, event) => {
    // Clear any existing timeout immediately
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Always update the category and anchor element
    setHoveredCategory(category);
    setAnchorEl(event.currentTarget);
  };

  const handleCategoryLeave = () => {
    const timeout = setTimeout(() => {
      setHoveredCategory(null);
      setAnchorEl(null);
    }, 200); // Small delay to allow moving to the popup

    hoverTimeoutRef.current = timeout;
  };

  const handlePopupEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handlePopupLeave = () => {
    // Clear any existing timeout first
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Set a new timeout to hide the popup
    const timeout = setTimeout(() => {
      setHoveredCategory(null);
      setAnchorEl(null);
    }, 200);

    hoverTimeoutRef.current = timeout;
  };

  const handleNodeSelect = (nodeDefinition) => {
    if (onNodeSelect) {
      onNodeSelect(nodeDefinition.metadata.type, nodeDefinition);
    }
  };

  const handleDragStart = (event, nodeDefinition) => {
    // Store the node data for the drop event
    event.dataTransfer.setData('application/json', JSON.stringify({
      nodeType: nodeDefinition.metadata.type,
      nodeDefinition: nodeDefinition
    }));
    event.dataTransfer.effectAllowed = 'copy';

    // Add visual feedback
    event.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (event) => {
    // Reset visual feedback
    event.currentTarget.style.opacity = '1';
  };

  const getCategoryIcon = (category) => {
    const iconMap = {
      'AI/ML': <SmartToy sx={{ fontSize: '1.2rem' }} />,
      'Input': <Input sx={{ fontSize: '1.2rem' }} />,
      'Output': <Output sx={{ fontSize: '1.2rem' }} />,
      'Processing': <Settings sx={{ fontSize: '1.2rem' }} />,
      'Logic': <AccountTree sx={{ fontSize: '1.2rem' }} />,
      'Database': <Storage sx={{ fontSize: '1.2rem' }} />,
      'API': <Api sx={{ fontSize: '1.2rem' }} />,
      'Utility': <Build sx={{ fontSize: '1.2rem' }} />
    };
    return iconMap[category] || <Article sx={{ fontSize: '1.2rem' }} />;
  };

  const getNodeColor = (nodeDefinition) => {
    return nodeDefinition.metadata.color || '#1976d2';
  };

  if (collapsed) {
    return (
      <Box
        sx={{
          width: 48,
          height: '100%',
          backgroundColor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 1,
          gap: 1,
        }}
      >
        <IconButton onClick={onToggleCollapse} size="small">
          <ExpandMore sx={{ transform: 'rotate(-90deg)' }} />
        </IconButton>
        <Typography
          variant="caption"
          sx={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            color: 'text.secondary',
          }}
        >
          Toolbar
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: 300,
        height: '100%',
        backgroundColor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          Toolbar
        </Typography>
        <IconButton onClick={onToggleCollapse} size="small">
          <ExpandLess sx={{ transform: 'rotate(-90deg)' }} />
        </IconButton>
      </Box>

      {/* Graph Actions */}
      <Typography variant="body1" component="h3" sx={{ fontWeight: 600, fontSize: '18px', p: 2 }}>
        Graph Actions
      </Typography>
      <Box sx={{ overflow: 'auto', position: 'relative', borderBottom: 1, borderColor: 'divider', px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          variant="outlined"
          onClick={onLoadGraph}
          size="small"
          startIcon={<FolderOpen />}
          sx={{ justifyContent: 'flex-start' }}
        >
          Load
        </Button>

        <Button
          variant="outlined"
          onClick={onSaveGraph}
          size="small"
          startIcon={<Save />}
          color={hasUnsavedChanges ? "secondary" : "primary"}
          disabled={isSaving}
          sx={{ justifyContent: 'flex-start' }}
        >
          {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save*' : 'Save'}
        </Button>

        <Button
          variant="outlined"
          onClick={onSaveAs}
          size="small"
          startIcon={<SaveAs />}
          sx={{ justifyContent: 'flex-start' }}
        >
          Save As
        </Button>

        <Button
          variant="outlined"
          size="small"
          startIcon={<Publish />}
          sx={{ justifyContent: 'flex-start' }}>
          Publish
        </Button>

      </Box>

      {/* Categories and Nodes List */}
      <Typography variant="body1" component="h3" sx={{ fontWeight: 600, fontSize: '18px', p: 2 }}>
        Nodes
      </Typography>
      <Box sx={{ overflow: 'auto', position: 'relative', borderBottom: 1, borderColor: 'divider', }}>
        {categories.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {registryInitialized ? 'No node categories found...' : 'Loading nodes...'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {categories.map((category) => (
              <React.Fragment key={category}>
                {/* Category Header */}
                <ListItem disablePadding>
                  <ListItemButton
                    onMouseEnter={(e) => handleCategoryHover(category, e)}
                    onMouseLeave={handleCategoryLeave}
                    sx={{
                      py: 1.5,
                      px: 2,
                      backgroundColor: hoveredCategory === category
                        ? 'action.selected'
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: 'action.selected',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                        {getCategoryIcon(category)}
                      </Box>
                      <ListItemText
                        primary={category}
                        primaryTypographyProps={{
                          variant: 'subtitle2',
                          fontWeight: 600,
                        }}
                      />
                      <Chip
                        label={nodesByCategory[category]?.length || 0}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 1, minWidth: 24, height: 20 }}
                      />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: '0.75rem' }}
                      >
                        ▶
                      </Typography>
                    </Box>
                  </ListItemButton>
                </ListItem>

                {/* Divider between categories */}
                {category !== categories[categories.length - 1] && (
                  <Divider sx={{ mx: 2 }} />
                )}
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Hover Popup Menu for Nodes */}
        <Popper
          open={Boolean(hoveredCategory && anchorEl)}
          anchorEl={anchorEl}
          placement="right-start"
          modifiers={[
            {
              name: 'offset',
              options: {
                offset: [0, 0],
              },
            },
          ]}
          sx={{ zIndex: 1300 }}
        >
          <Paper
            elevation={8}
            onMouseEnter={handlePopupEnter}
            onMouseLeave={handlePopupLeave}
            sx={{
              ml: 1,
              minWidth: 280,
              maxWidth: 400,
              maxHeight: 240, // Height for ~5 nodes (48px each)
              overflow: 'hidden',
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
            }}
          >
            {/* Nodes List */}
            <Box sx={{ maxHeight: 192, overflow: 'auto' }}> {/* 192px = 4 * 48px for scrolling */}
              {nodesByCategory[hoveredCategory]?.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No nodes in this category
                  </Typography>
                </Box>
              ) : (
                <List sx={{ p: 0 }}>
                  {nodesByCategory[hoveredCategory]?.map((nodeDefinition) => (
                    <ListItem key={nodeDefinition.metadata.type} disablePadding>
                      <ListItemButton
                        draggable
                        onDragStart={(e) => handleDragStart(e, nodeDefinition)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleNodeSelect(nodeDefinition)}
                        sx={{
                          py: 1,
                          px: 2,
                          minHeight: 48,
                          '&:hover': {
                            backgroundColor: 'action.selected',
                          },
                          cursor: 'grab',
                          '&:active': {
                            cursor: 'grabbing',
                          },
                          transition: 'opacity 0.2s ease',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, gap: 1 }}>
                          <Tooltip title="Drag to canvas or click to add" arrow placement="left">
                            <DragIndicator sx={{ color: 'text.disabled', fontSize: 16 }} />
                          </Tooltip>

                          {/* Node Icon */}
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: 1,
                              backgroundColor: getNodeColor(nodeDefinition),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              flexShrink: 0,
                            }}
                          >
                            {nodeDefinition.metadata.icon || <Article sx={{ fontSize: '12px', color: 'white' }} />}
                          </Box>

                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {nodeDefinition.metadata.displayName}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: 'block',
                                lineHeight: 1.2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '250px',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {nodeDefinition.metadata.description}
                            </Typography>
                          </Box>

                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNodeSelect(nodeDefinition);
                            }}
                            sx={{
                              p: 0.5,
                              opacity: 0.7,
                              '&:hover': { opacity: 1 },
                              flexShrink: 0,
                            }}
                          >
                            <Add fontSize="small" />
                          </IconButton>
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Paper>
        </Popper>
      </Box>
    </Box>
  );
};

export default GraphToolbar;