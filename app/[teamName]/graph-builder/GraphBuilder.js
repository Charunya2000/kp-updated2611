'use client';

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  useTheme,
  Drawer,
} from '@mui/material';
import { Close, ContentCopy } from '@mui/icons-material';
import { Code as CodeIcon } from '@mui/icons-material';
import '@xyflow/react/dist/style.css';

// Import our new components
import DynamicNode from './components/DynamicNode.js';
import nodeRegistry from './components/NodeRegistry.js';
import stateManager from './components/StateManager.js';
import { nodeDefinitions, nodeImplementations } from './nodes/index.js';
import useSnackbar from '../../hooks/useSnackbar.js';
import ConfigurationDrawer from './components/ConfigurationDrawer.js';
import GraphMenubar from './components/GraphMenubar.js';
import GraphExecutionPanel from './components/GraphExecutionPanel.js';
import GraphCodeViewer from './components/GraphCodeViewer.js';
import GraphToolbar from './components/GraphToolbar.js';
import SaveGraphDialog from './components/SaveGraphDialog.js';
import LoadGraphDialog from './components/LoadGraphDialog.js';
import { formatName } from '@/utils/formatting.js';
import { createGraphConfiguration, getAllGraphConfigurations, updateGraphConfiguration } from '../../clientServices/graphConfigurationService.js';

// Define node types outside component to prevent recreation
// Node types are created once and reused - callbacks are passed through node data
const createStaticNodeTypes = () => {
  const nodeTypes = {};

  // Get all registered node types
  const registeredTypes = nodeRegistry.getAllNodeTypes();

  registeredTypes.forEach(nodeType => {
    nodeTypes[nodeType] = (props) => (
      <DynamicNode {...props} />
    );
  });

  return nodeTypes;
};

// Create node types once outside component
let staticNodeTypes = null;

function GraphBuilder({ teamName }) {
  const [graphId, setGraphId] = useState(() => uuidv4()); // Stable graph ID
  const [graphName, setGraphName] = useState('Untitled Graph'); // Graph name
  const [graphDescription, setGraphDescription] = useState(''); // Graph description
  const [graphVersion, setGraphVersion] = useState('1.0.0'); // Graph version
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [jsonDrawerOpen, setJsonDrawerOpen] = useState(false);
  const [executionPanelOpen, setExecutionPanelOpen] = useState(false);
  const [nodeListCollapsed, setNodeListCollapsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Save state
  const [saveError, setSaveError] = useState(null); // Save error state
  const [savedGraphId, setSavedGraphId] = useState(null); // Track if graph has been saved
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // Track unsaved changes
  const [saveDialogOpen, setSaveDialogOpen] = useState(false); // Control SaveGraphDialog
  const [loadDialogOpen, setLoadDialogOpen] = useState(false); // Control LoadGraphDialog
  const { SnackbarComponent, showSnackbar } = useSnackbar();
  const [registryInitialized, setRegistryInitialized] = useState(false);
  const theme = useTheme();
  const { screenToFlowPosition } = useReactFlow();

  // Track changes to mark graph as having unsaved changes
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [nodes, edges]);

  // Initialize the registry
  useEffect(() => {
    // Register nodes with both definitions and implementations
    nodeDefinitions.forEach(nodeDef => {
      // Find the corresponding implementation by matching the node type
      const nodeType = nodeDef.metadata.type;
      const implementation = nodeImplementations.find(
        impl => impl.implementationKey === nodeDef.executionLogic?.implementation
      );

      // Register with both definition and implementation
      nodeRegistry.registerNode(nodeDef, implementation);
    });

    // Create static node types once after registry is initialized
    if (!staticNodeTypes) {
      staticNodeTypes = createStaticNodeTypes();
    }

    setRegistryInitialized(true);
  }, []);

  // Function to open drawer - use useCallback with stable dependencies
  const openNodeDrawer = useCallback((nodeId, nodeDefinition, nodeData, currentInlineConfig = null) => {
    // Get the most current node data from the nodes state
    const currentNode = nodes.find(n => n.id === nodeId);
    let currentNodeData = currentNode?.data || nodeData;

    // If currentInlineConfig is provided (from force save), use it to update the config
    if (currentInlineConfig !== null) {
      // Force save the inline config first
      stateManager.setNodeConfiguration(nodeId, currentInlineConfig);

      // Update the current node data with the inline config
      currentNodeData = {
        ...currentNodeData,
        config: currentInlineConfig
      };

      // Also update the nodes state immediately
      setNodes(nds =>
        nds.map(node =>
          node.id === nodeId
            ? {
              ...node,
              data: {
                ...node.data,
                config: currentInlineConfig
              }
            }
            : node
        )
      );
    }

    const nodeDef = nodeDefinition || nodeRegistry.getNodeDefinition(currentNode?.type);

    // Calculate connected inputs for this node
    const incomingEdges = edges.filter(edge => edge.target === nodeId);
    const connectedInputs = new Set(incomingEdges.map(edge => edge.targetHandle));

    setSelectedNode({
      id: nodeId,
      nodeDefinition: nodeDef,
      data: currentNodeData,
      connectedInputs
    });

    setDrawerOpen(true);
  }, [nodes, edges]);  // Function to update node configuration inline (for auto-save from DynamicNode)
  const updateNodeConfigInline = useCallback((nodeId, newConfig, showNotification = false) => {
    // Save to state manager (this merges automatically)
    stateManager.setNodeConfiguration(nodeId, newConfig);

    // Update the node in the graph - MERGE with existing config
    setNodes(nds =>
      nds.map(node =>
        node.id === nodeId
          ? {
            ...node,
            data: {
              ...node.data,
              config: {
                ...node.data.config, // Merge with existing config
                ...newConfig
              }
            }
          }
          : node
      )
    );

    // If the drawer is open for this node, update the selectedNode as well
    if (drawerOpen && selectedNode && selectedNode.id === nodeId) {
      setSelectedNode(prev => ({
        ...prev,
        data: {
          ...prev.data,
          config: {
            ...prev.data.config, // Merge with existing config
            ...newConfig
          }
        }
      }));
    }

    // Only show snackbar if explicitly requested
    if (showNotification) {
      showSnackbar('Configuration updated', 'success');
    }
  }, [showSnackbar, drawerOpen, selectedNode]);

  // Function to save node configuration (called from ConfigurationDrawer)
  const saveNodeConfiguration = useCallback((nodeId, newConfig) => {
    // Save to state manager
    stateManager.setNodeConfiguration(nodeId, newConfig);

    // Update the node in the graph
    setNodes(nds =>
      nds.map(node =>
        node.id === nodeId
          ? {
            ...node,
            data: {
              ...node.data,
              config: newConfig
            }
          }
          : node
      )
    );
  }, []);

  // Calculate connected inputs for each node and add callbacks to data
  const nodesWithConnections = useMemo(() => {
    return nodes.map(node => {
      // Find edges that target this node
      const incomingEdges = edges.filter(edge => edge.target === node.id);
      const connectedInputs = new Set(incomingEdges.map(edge => edge.targetHandle));

      return {
        ...node,
        data: {
          ...node.data,
          connectedInputs,
          onConfigure: openNodeDrawer,
          onConfigUpdate: updateNodeConfigInline // For inline auto-save
        }
      };
    });
  }, [nodes, edges, openNodeDrawer, updateNodeConfigInline]);

  const onConnect = useCallback(
    (params) => {
      // Validate connection compatibility
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);

      if (sourceNode && targetNode) {
        const validation = nodeRegistry.validateConnection(
          sourceNode.type,
          params.sourceHandle,
          targetNode.type,
          params.targetHandle
        );

        if (!validation.valid) {
          showSnackbar(`Connection invalid: ${validation.error}`, 'error');
          return;
        }
      }

      setEdges((eds) => addEdge(params, eds));
    },
    [nodes, showSnackbar],
  );

  // Handle node selection from NodeList
  const handleNodeListSelection = useCallback(async (nodeType, nodeDefinition) => {
    if (!nodeDefinition) {
      showSnackbar(`Node type '${nodeType}' not found in registry`, 'error');
      return;
    }

    const nodeId = `${nodeType}_${Date.now()}`;
    const newNode = {
      id: nodeId,
      type: nodeType,
      position: {
        x: nodeListCollapsed ? 100 : 350, // Offset based on NodeList state
        y: 100 + Math.random() * 200
      },
      data: {
        nodeDefinition,
        config: {}
      },
      dragHandle: '.node-drag-handle',
    };

    setNodes((nds) => [...nds, newNode]);

    // Initialize state for the new node
    stateManager.initializeNodeState(nodeId, nodeDefinition);

    // Call onLoad handler if it exists
    const onLoadHandler = nodeRegistry.getOnLoadHandler(nodeType);
    if (onLoadHandler) {
      try {
        await onLoadHandler(nodeId, newNode.data, updateNodeConfigInline);
      } catch (error) {
        console.error(`Error in onLoad handler for ${nodeType}:`, error);
        showSnackbar(`Error initializing ${nodeDefinition.metadata.displayName}`, 'error');
      }
    }

    showSnackbar(`Added ${nodeDefinition.metadata.displayName} node`, 'success');
  }, [nodeListCollapsed, showSnackbar, updateNodeConfigInline]);

  // Handle drop from NodeList
  const onDrop = useCallback(async (event) => {
    event.preventDefault();

    const reactFlowBounds = event.currentTarget.getBoundingClientRect();
    const position = screenToFlowPosition({
      x: event.clientX, // Offset to center the node
      y: event.clientY,  // Offset to center the node
    });

    try {
      const data = JSON.parse(event.dataTransfer.getData('application/json'));
      const { nodeType, nodeDefinition } = data;

      if (!nodeDefinition) {
        showSnackbar(`Node type '${nodeType}' not found in registry`, 'error');
        return;
      }

      const nodeId = `${nodeType}_${Date.now()}`;
      const newNode = {
        id: nodeId,
        type: nodeType,
        position,
        data: {
          nodeDefinition,
          config: {}
        },
        dragHandle: '.node-drag-handle',
      };

      setNodes((nds) => [...nds, newNode]);

      // Initialize state for the new node
      stateManager.initializeNodeState(nodeId, nodeDefinition);

      // Call onLoad handler if it exists
      const onLoadHandler = nodeRegistry.getOnLoadHandler(nodeType);
      if (onLoadHandler) {
        try {
          await onLoadHandler(nodeId, newNode.data, updateNodeConfigInline);
        } catch (error) {
          console.error(`Error in onLoad handler for ${nodeType}:`, error);
          showSnackbar(`Error initializing ${nodeDefinition.metadata.displayName}`, 'error');
        }
      }

      showSnackbar(`Added ${nodeDefinition.metadata.displayName} node`, 'success');
    } catch (error) {
      console.error('Error parsing dropped data:', error);
      showSnackbar('Error adding node from drop', 'error');
    }
  }, [showSnackbar, screenToFlowPosition, updateNodeConfigInline]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  // Clear all nodes
  const clearGraph = useCallback(() => {
    setNodes([]);
    setEdges([]);
    stateManager.clearAllState();
    setSavedGraphId(null);
    setHasUnsavedChanges(false);
    setGraphName('Untitled Graph');
    showSnackbar('Graph cleared', 'info');
  }, [showSnackbar]);

  // Load sample graph
  const loadSample = useCallback(() => {
    // Create a sample workflow
    const sampleNodes = [
      {
        id: 'input_1',
        type: 'user_prompt',
        position: { x: 100, y: 100 },
        data: {
          nodeDefinition: nodeRegistry.getNodeDefinition('user_prompt'),
          config: { text_content: 'Hello, world!' }
        },
        dragHandle: '.node-drag-handle'
      },
      {
        id: 'llm_1',
        type: 'llm',
        position: { x: 420, y: 100 },
        data: {
          nodeDefinition: nodeRegistry.getNodeDefinition('llm'),
          config: { model: 'gpt-4o', temperature: 0.7 }
        },
        dragHandle: '.node-drag-handle'
      },
      {
        id: 'output_1',
        type: 'response',
        position: { x: 770, y: 100 },
        data: {
          nodeDefinition: nodeRegistry.getNodeDefinition('response'),
          config: { output_format: 'text' }
        },
        dragHandle: '.node-drag-handle'
      }
    ];

    const sampleEdges = [
      {
        id: 'e1-2',
        source: 'input_1',
        target: 'llm_1',
        sourceHandle: 'text_content',
        targetHandle: 'prompt'
      },
      {
        id: 'e2-3',
        source: 'llm_1',
        target: 'output_1',
        sourceHandle: 'response',
        targetHandle: 'final_result'
      }
    ];

    setNodes(sampleNodes);
    setEdges(sampleEdges);

    // Reset saved state since we're loading a sample
    setSavedGraphId(null);
    setHasUnsavedChanges(true);
    setGraphName('Sample Workflow');
    setGraphDescription('A sample workflow demonstrating basic graph functionality');
    setGraphVersion('1.0.0');

    // Initialize state for sample nodes
    sampleNodes.forEach(node => {
      stateManager.initializeNodeState(node.id, node.data.nodeDefinition);
      if (Object.keys(node.data.config).length > 0) {
        stateManager.setNodeConfiguration(node.id, node.data.config);
      }
    });

    showSnackbar('Sample workflow loaded', 'success');
  }, [showSnackbar]);

  // Execute graph function
  const executeGraph = useCallback(() => {
    if (nodes.length === 0) {
      showSnackbar('No nodes to execute. Add some nodes first.', 'warning');
      return;
    }

    setExecutionPanelOpen(true);
  }, [nodes.length, showSnackbar]);

  // Save graph function - now handles data from SaveGraphDialog
  const saveGraph = useCallback(async (graphData, isUpdate = false) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const dataToSave = {
        id: isUpdate ? savedGraphId || graphId : graphId,
        name: formatName(graphData.name),
        displayName: graphData.name,
        description: graphData.description || '',
        version: graphData.version || '1.0.0',
        tags: graphData.tags || [],
        nodes: graphData.nodes.map(node => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data
        })),
        edges: graphData.edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle
        }))
      };

      let result;
      if (isUpdate && savedGraphId) {
        // Update existing graph
        result = await updateGraphConfiguration(teamName, savedGraphId, dataToSave);
        showSnackbar('Graph updated successfully!', 'success');
      } else {
        // Create new graph
        result = await createGraphConfiguration(teamName, dataToSave);
        setSavedGraphId(result.id || graphId);
        showSnackbar('Graph saved successfully!', 'success');
      }

      // Update local state
      setGraphName(graphData.name);
      setGraphDescription(graphData.description || '');
      setGraphVersion(graphData.version || '1.0.0');
      setHasUnsavedChanges(false);

      // Close the dialog
      setSaveDialogOpen(false);

    } catch (error) {
      console.error('Error saving graph:', error);
      setSaveError('Failed to save graph. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [graphId, savedGraphId, teamName, showSnackbar]);

  // Quick save function for toolbar (skips dialog if graph already has details)
  const quickSaveGraph = useCallback(async () => {
    if (!graphName.trim() || graphName.trim() === 'Untitled Graph') {
      // Open dialog if no proper name
      setSaveDialogOpen(true);
      return;
    }

    if (nodes.length === 0) {
      showSnackbar('Cannot save an empty graph. Add some nodes first.', 'warning');
      return;
    }

    // Use current state for quick save
    const graphData = {
      name: graphName,
      description: graphDescription,
      version: graphVersion,
      nodes,
      edges,
    };

    await saveGraph(graphData, !!savedGraphId);
  }, [graphName, graphDescription, graphVersion, nodes, edges, savedGraphId, saveGraph, showSnackbar]);

  // Open Save As dialog function
  const openSaveAsDialog = useCallback(() => {
    setSaveDialogOpen(true);
  }, []);

  // Create currentGraph object for the SaveGraphDialog
  const currentGraph = useMemo(() => {
    if (!savedGraphId) return null;

    return {
      id: savedGraphId,
      name: graphName,
      description: graphDescription,
      version: graphVersion,
    };
  }, [savedGraphId, graphName, graphDescription, graphVersion]);

  // Open Load Graph dialog function
  const openLoadGraphDialog = useCallback(() => {
    setLoadDialogOpen(true);
  }, []);

  // Handle graph loading from LoadGraphDialog
  const handleLoadGraph = useCallback((graph) => {
    // Load the graph data
    if (graph.nodes && graph.edges) {
      setNodes(graph.nodes || []);
      setEdges(graph.edges || []);
      setGraphName(graph.displayName || graph.name || 'Loaded Graph');
      setGraphDescription(graph.description || '');
      setGraphVersion(graph.version || '1.0.0');
      setSavedGraphId(graph.id);
      setHasUnsavedChanges(false);

      // Initialize state for loaded nodes
      graph.nodes?.forEach(node => {
        stateManager.initializeNodeState(node.id, node.data.nodeDefinition);
        if (node.data.config && Object.keys(node.data.config).length > 0) {
          stateManager.setNodeConfiguration(node.id, node.data.config);
        }
      });

      showSnackbar(`Graph "${graph.displayName || graph.name}" loaded successfully`, 'success');
    }
  }, [setNodes, setEdges, showSnackbar]);  // Handle graph deletion from LoadGraphDialog

  const handleDeleteGraph = useCallback(async (graphId) => {
    // Placeholder for delete functionality
    showSnackbar('Delete functionality not implemented yet', 'warning');
    return Promise.resolve();
  }, [showSnackbar]);

  // Prepare graph data for execution
  const graphForExecution = useMemo(() => ({
    id: graphId,
    displayName: graphName,
    name: formatName(graphName),
    nodes: nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      name: node.name || 'graphNode'
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle
    }))
  }), [graphId, graphName, nodes, edges]);

  // Handle applying JSON configuration changes
  const handleApplyJsonChanges = useCallback((config) => {
    setNodes(config.nodes || []);
    setEdges(config.edges || []);
  }, [setNodes, setEdges]);

  // Generate fresh JSON from current graph state
  const getLatestJson = useCallback(() => {
    const config = graphForExecution;
    return JSON.stringify(config, null, 2);
  }, [graphForExecution]);

  return (
    <Box sx={{ width: '100vw', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Configuration Drawer */}
      <ConfigurationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedNode={selectedNode}
        onSave={saveNodeConfiguration}
        showSnackbar={showSnackbar}
      />

      {/* Toolbar */}
      <GraphMenubar
        onLoadSample={loadSample}
        onClearGraph={clearGraph}
        onExecuteGraph={executeGraph}
        graphName={graphName}
        onGraphNameChange={setGraphName}
      />

      {/* Graph Execution Panel */}
      <GraphExecutionPanel
        graph={graphForExecution}
        open={executionPanelOpen}
        onClose={() => setExecutionPanelOpen(false)}
      />

      {/* Main Content Area - Horizontal Layout */}
      <Box sx={{ flexGrow: 1, display: 'flex', height: 'calc(100vh - 64px)' }}>
        {/* NodeList Panel */}
        <GraphToolbar
          onNodeSelect={handleNodeListSelection}
          collapsed={nodeListCollapsed}
          onToggleCollapse={() => setNodeListCollapsed(!nodeListCollapsed)}
          registryInitialized={registryInitialized}
          onLoadGraph={openLoadGraphDialog}
          onSaveGraph={quickSaveGraph}
          onSaveAs={openSaveAsDialog}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        {/* React Flow Canvas */}
        <Box sx={{ flexGrow: 1, position: 'relative' }}>
          {/* JSON Config Button */}
          <IconButton
            onClick={() => setJsonDrawerOpen(true)}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 1000,
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            <CodeIcon />
          </IconButton>

          <ReactFlow
            nodes={nodesWithConnections}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={staticNodeTypes || {}}
            fitView
            deleteKeyCode="Delete"
            colorMode={theme.palette.mode}
          >
            <Controls position='bottom-left' orientation='horizontal' />
            <MiniMap position='bottom-right' />
            <Background variant={BackgroundVariant.Lines} color="#c1c1c165" gap={12} size={1} />
          </ReactFlow>
        </Box>
      </Box>

      {/* Graph Code Viewer */}
      <GraphCodeViewer
        open={jsonDrawerOpen}
        onClose={() => setJsonDrawerOpen(false)}
        getLatestJson={getLatestJson}
        onApplyChanges={handleApplyJsonChanges}
        showSnackbar={showSnackbar}
      />

      {/* Save Graph Dialog */}
      <SaveGraphDialog
        key={`${saveDialogOpen}-${savedGraphId || 'new'}-${graphName}-${graphDescription}-${graphVersion}`}
        open={saveDialogOpen}
        onClose={() => {
          setSaveDialogOpen(false);
          setSaveError(null); // Clear error when closing
        }}
        onSave={saveGraph}
        currentGraph={currentGraph}
        nodes={nodes}
        edges={edges}
        loading={isSaving}
        error={saveError}
        initialName={graphName}
        initialDescription={graphDescription}
        initialVersion={graphVersion}
      />

      {/* Load Graph Dialog */}
      <LoadGraphDialog
        open={loadDialogOpen}
        onClose={() => setLoadDialogOpen(false)}
        onLoad={handleLoadGraph}
        teamName={teamName}
      />

      {/* Snackbar for notifications */}
      <SnackbarComponent />
    </Box>
  );
}

export default function GraphBuilderWithProvider({ teamName }) {
  return (
    <ReactFlowProvider>
      <GraphBuilder teamName={teamName} />
    </ReactFlowProvider>
  );
}