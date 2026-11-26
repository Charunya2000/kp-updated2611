'use client';

import React from 'react';
import {
  Typography,
  Button,
  Toolbar,
  AppBar,
} from '@mui/material';
import { Refresh, PlayArrow, Save } from '@mui/icons-material';

export default function GraphMenubar({
  onLoadSample,
  onClearGraph,
  onExecuteGraph,
  onSaveGraph,
  graphName,
  isSaving = false,
  hasUnsavedChanges = false
}) {
  return (
    <AppBar position="static" color="default" elevation={0} sx={{ height: '64px' }}>
      <Toolbar sx={{
        gap: 2,
        height: '64px',
        px: 2,
        '@media (min-width: 600px)': {
          px: 2,
        }
      }}>

        <Typography variant="h6" color="inherit" sx={{ mr: 2 }}>
          {graphName || 'Untitled Graph'}
        </Typography>

        <Button variant="outlined" onClick={onLoadSample} size="small" startIcon={<Refresh />}>
          Load Sample
        </Button>

        <Button variant="outlined" onClick={onClearGraph} size="small" color="error">
          Clear Graph
        </Button>

        <Button
          variant="primary"
          onClick={onSaveGraph}
          size="small"
          startIcon={<Save />}
          color={hasUnsavedChanges ? "secondary" : "primary"}
          disabled={isSaving}
          sx={{ mr: 1 }}
        >
          {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Graph*' : 'Save Graph'}
        </Button>

        <Button
          variant="contained"
          onClick={onExecuteGraph}
          size="small"
          startIcon={<PlayArrow />}
          color="success"
          sx={{ ml: 'auto', mr: 2 }}
        >
          Execute
        </Button>

        <Typography variant="body2" color="text.secondary">
          💡 Drag nodes to move • Click and drag from handles to connect • Delete with Delete key • Click ⚙️ to configure
        </Typography>
      </Toolbar>
    </AppBar>
  );
}