/**
 * ResizableContainer Usage Examples
 * Demonstrates different ways to use the ResizableContainer component
 */

import React, { useState } from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import ResizableContainer from './ResizableContainer.js';
import { DragIndicator } from '@mui/icons-material';

// Example 1: Horizontal resize (like the drawer)
export const ResizableDrawerExample = () => {
  return (
    <ResizableContainer
      initialWidth={400}
      minWidth={300}
      maxWidth={800}
      resizeDirection="horizontal"
      handlePosition="right"
      onResize={(dimensions) => console.log('New width:', dimensions.width)}
    >
      <Paper sx={{ p: 3, height: '100vh' }}>
        <Typography variant="h6">Resizable Drawer Content</Typography>
        <Typography>Drag the right edge to resize!</Typography>
      </Paper>
    </ResizableContainer>
  );
};

// Example 2: Vertical resize panel
export const ResizableVerticalPanel = () => {
  return (
    <ResizableContainer
      initialHeight={200}
      minHeight={100}
      maxHeight={500}
      resizeDirection="vertical"
      handlePosition="bottom"
    >
      <Paper sx={{ p: 2, width: '100%', height: '100%' }}>
        <Typography variant="h6">Vertical Panel</Typography>
        <Typography>Drag the bottom edge to resize!</Typography>
      </Paper>
    </ResizableContainer>
  );
};

// Example 3: Both directions (like a window)
export const ResizableWindow = () => {
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

  return (
    <ResizableContainer
      initialWidth={400}
      initialHeight={300}
      minWidth={250}
      minHeight={150}
      resizeDirection="both"
      onResize={setDimensions}
      sx={{ border: 1, borderColor: 'divider' }}
    >
      <Paper sx={{ p: 2, width: '100%', height: '100%' }}>
        <Typography variant="h6">Resizable Window</Typography>
        <Typography variant="body2">
          Size: {dimensions.width} x {dimensions.height}
        </Typography>
        <Typography>
          Drag the right edge for width, bottom edge for height,
          or corner for both directions!
        </Typography>
      </Paper>
    </ResizableContainer>
  );
};

// Example 4: Custom styled handles
export const CustomStyledResizable = () => {
  return (
    <ResizableContainer
      initialWidth={350}
      resizeDirection="horizontal"
      handleSize={12}
      handleColor="primary.main"
      handleHoverColor="secondary.main"
    >
      <Paper sx={{ p: 3, height: 400, bgcolor: 'background.default' }}>
        <Typography variant="h6" color="primary">
          Custom Styled Resize Handle
        </Typography>
        <Typography>
          This has a custom colored and sized handle!
        </Typography>
      </Paper>
    </ResizableContainer>
  );
};

// Example 5: Split pane layout
export const SplitPaneExample = () => {
  const [leftWidth, setLeftWidth] = useState(300);

  return (
    <Box sx={{ display: 'flex', height: 400, border: 1, borderColor: 'divider' }}>
      <ResizableContainer
        initialWidth={leftWidth}
        minWidth={200}
        maxWidth={600}
        resizeDirection="horizontal"
        handlePosition="right"
        onResize={(dims) => setLeftWidth(dims.width)}
        handleIconHorizontal={<DragIndicator sx={{ fontSize: 20, color: 'text.secondary', transform: 'rotate(90deg)' }} />}
        cursorHorizontal='col-resize'
      >
        <Paper sx={{ p: 2, height: '100%', bgcolor: 'grey.50' }}>
          <Typography variant="h6">Left Panel</Typography>
          <Typography>Width: {leftWidth}px</Typography>
        </Paper>
      </ResizableContainer>

      <Box sx={{ flexGrow: 1, p: 2 }}>
        <Typography variant="h6">Right Panel</Typography>
        <Typography>This panel takes remaining space</Typography>
      </Box>
    </Box>
  );
};