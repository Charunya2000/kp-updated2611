/**
 * ResizableContainer Component
 * A reusable component that adds resize functionality to any content
 * Supports horizontal, vertical, and both directions
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import {
  DragIndicator,
  Height as VerticalResizeIcon,
  OpenWith as BothResizeIcon
} from '@mui/icons-material';

const ResizableContainer = ({
  children,
  initialWidth = 400,
  initialHeight = 300,
  minWidth = 200,
  maxWidth = null, // null = 80% of window width
  minHeight = 150,
  maxHeight = null, // null = 80% of window height
  resizeDirection = 'horizontal', // 'horizontal', 'vertical', 'both'
  handlePosition = 'right', // 'left', 'right', 'top', 'bottom', 'corner'
  handleSize = 4,
  handleColor = 'divider',
  handleHoverColor = 'primary.main',
  handleIconHorizontal = <DragIndicator sx={{ fontSize: 16, color: 'text.secondary', transform: 'rotate(90deg)' }} />,
  handleIconVertical = <DragIndicator sx={{ fontSize: 16, color: 'text.secondary' }} />,
  handleIconBoth = <BothResizeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />,
  cursorHorizontal = 'ew-resize',
  cursorVertical = 'ns-resize',
  cursorBoth = 'nwse-resize',
  onResize = null, // Callback function when resize happens
  sx = {},
  ...props
}) => {
  const [dimensions, setDimensions] = useState({
    width: initialWidth,
    height: initialHeight
  });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState(null); // 'width', 'height', 'both'
  const containerRef = useRef(null);

  // Calculate max dimensions
  const getMaxWidth = () => maxWidth || Math.min(window.innerWidth * 0.8, 1200);
  const getMaxHeight = () => maxHeight || Math.min(window.innerHeight * 0.8, 800);

  // Handle resize start
  const handleMouseDown = useCallback((e, type) => {
    setIsResizing(true);
    setResizeType(type);
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Handle resize movement
  const handleMouseMove = useCallback((e) => {
    if (!isResizing || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();

    if (resizeType === 'width' || resizeType === 'both') {
      let newWidth;
      if (handlePosition === 'left') {
        newWidth = rect.right - e.clientX;
      } else {
        newWidth = e.clientX - rect.left;
      }

      newWidth = Math.max(minWidth, Math.min(newWidth, getMaxWidth()));

      setDimensions(prev => ({
        ...prev,
        width: newWidth
      }));
    }

    if (resizeType === 'height' || resizeType === 'both') {
      let newHeight;
      if (handlePosition === 'top') {
        newHeight = rect.bottom - e.clientY;
      } else {
        newHeight = e.clientY - rect.top;
      }

      newHeight = Math.max(minHeight, Math.min(newHeight, getMaxHeight()));

      setDimensions(prev => ({
        ...prev,
        height: newHeight
      }));
    }
  }, [isResizing, resizeType, handlePosition, minWidth, minHeight]);

  // Handle resize end
  const handleMouseUp = useCallback(() => {
    if (isResizing && onResize) {
      onResize(dimensions);
    }
    setIsResizing(false);
    setResizeType(null);
  }, [isResizing, dimensions, onResize]);

  // Event listeners for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      // Set appropriate cursor
      const cursor = resizeType === 'width' ? cursorHorizontal :
        resizeType === 'height' ? cursorVertical : cursorBoth;
      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp, resizeType]);

  // Get handle styles based on position and direction
  const getHandleStyles = (type) => {
    const baseStyles = {
      position: 'absolute',
      backgroundColor: handleColor,
      cursor: type === 'width' ? cursorHorizontal : type === 'height' ? cursorVertical : cursorBoth,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      transition: 'background-color 0.2s ease',
      '&:hover': {
        backgroundColor: handleHoverColor,
        opacity: 0.8,
      }
    };

    switch (type) {
      case 'width':
        return {
          ...baseStyles,
          top: 0,
          [handlePosition]: 0,
          width: handleSize,
          height: '100%',
        };
      case 'height':
        return {
          ...baseStyles,
          left: 0,
          [handlePosition]: 0,
          width: '100%',
          height: handleSize,
        };
      case 'both':
        return {
          ...baseStyles,
          bottom: 0,
          right: 0,
          width: handleSize * 2,
          height: handleSize * 2,
        };
      default:
        return baseStyles;
    }
  };

  // Determine which handles to render
  const shouldRenderHandle = (type) => {
    switch (resizeDirection) {
      case 'horizontal':
        return type === 'width';
      case 'vertical':
        return type === 'height';
      case 'both':
        return true;
      default:
        return false;
    }
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: resizeDirection === 'horizontal' || resizeDirection === 'both' ? dimensions.width : 'auto',
        height: resizeDirection === 'vertical' || resizeDirection === 'both' ? dimensions.height : 'auto',
        ...sx
      }}
      {...props}
    >
      {children}

      {/* Width resize handle */}
      {shouldRenderHandle('width') && (
        <Box
          onMouseDown={(e) => handleMouseDown(e, 'width')}
          sx={getHandleStyles('width')}
        >
          {handleIconHorizontal}
        </Box>
      )}

      {/* Height resize handle */}
      {shouldRenderHandle('height') && (
        <Box
          onMouseDown={(e) => handleMouseDown(e, 'height')}
          sx={getHandleStyles('height')}
        >
          {handleIconVertical}
        </Box>
      )}

      {/* Corner resize handle (for both directions) */}
      {resizeDirection === 'both' && (
        <Box
          onMouseDown={(e) => handleMouseDown(e, 'both')}
          sx={getHandleStyles('both')}
        >
          {handleIconBoth}
        </Box>
      )}
    </Box>
  );
};

export default ResizableContainer;