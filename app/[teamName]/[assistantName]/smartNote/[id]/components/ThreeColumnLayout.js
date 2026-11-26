import React, { useState } from 'react';
import { Box } from '@mui/material';
import Column from './Column';
import DesktopColumn from './DesktopColumn';

const ThreeColumnLayout = () => {
  const [leftWidth, setLeftWidth] = useState('min');
  const [middleWidth, setMiddleWidth] = useState('max');
  const [rightWidth, setRightWidth] = useState('min');

  const handleLeftExpand = (width) => {
    if ('mid' === width) {
      setLeftWidth('max');
      setMiddleWidth('min');
      setRightWidth('min');
    } else if ('min' === width) {
      setLeftWidth('mid');
      setMiddleWidth('min');
      setRightWidth('mid');
    }
  };

  const handleLeftShrink = (width) => {
    if ('mid' === width) {
      setLeftWidth('min');
      setMiddleWidth('max');
      setRightWidth('min');
    } else if ('max' === width) {
      setLeftWidth('mid');
      setMiddleWidth('min');
      setRightWidth('mid');
    }
  };

  const handleRightExpand = (width) => {
    if ('mid' === width) {
      setRightWidth('max');
      setMiddleWidth('min');
      setLeftWidth('min');
    } else if ('min' === width) {
      setRightWidth('mid');
      setMiddleWidth('min');
      setLeftWidth('mid');
    }
  };

  const handleRightShrink = (width) => {
    if ('mid' === width) {
      setRightWidth('min');
      setMiddleWidth('max');
      setLeftWidth('min');
    } else if ('max' === width) {
      setRightWidth('mid');
      setMiddleWidth('min');
      setLeftWidth('mid');
    }
  };

  const handleCenterExpand = (width) => {
    if ('mid' === width) {
      setRightWidth('min');
      setMiddleWidth('max');
      setLeftWidth('min');
    } else if ('min' === width) {
      setRightWidth('mid');
      setMiddleWidth('mid');
      setLeftWidth('mid');
    }
  };

  const handleCenterShrink = (width) => {
    if ('mid' === width) {
      setRightWidth('mid');
      setMiddleWidth('min');
      setLeftWidth('mid');
    } else if ('max' === width) {
      setRightWidth('mid');
      setMiddleWidth('mid');
      setLeftWidth('min');
    }
  };

  const testSections = [
    {
      title: 'Workflows',
      items: [
        { text: 'Item 1' },
        { text: 'Item 2' },
        { text: 'Item 3' },
      ],
    },
    {
      title: 'Saved Notes',
      items: [
        { text: 'Item 4' },
        { text: 'Item 5' },
        { text: 'Item 6' },
      ],
    },
    {
      title: 'Saved Responses',
      items: [
        { text: 'Item 7' },
        { text: 'Item 8' },
        { text: 'Item 9' },
      ],
    },
  ];

  const sideWidths = ['20%', '35%', '50%'];
  const centerWidths = ['30%', '45%', '60%'];

  return (
    <Box sx={{ display: 'flex', flexGrow: 1, width: '100%', height: '100%', gap: 1.5, overflow: 'hidden' }}>
      <Column
        position="left"
        label="Context"
        sections={testSections}
        widths={sideWidths}
        width={leftWidth}
        onExpand={handleLeftExpand}
        onShrink={handleLeftShrink}
      />
      <Column
        position="center"
        widths={centerWidths}
        label="Assistant"
        sections={testSections}
        width={middleWidth}
        onExpand={handleCenterExpand}
        onShrink={handleCenterShrink}
      />
      <DesktopColumn
        position="right"
        label="Desktop"
        widths={sideWidths}
        width={rightWidth}
        onExpand={handleRightExpand}
        onShrink={handleRightShrink}
      />
    </Box>
  );
};

export default ThreeColumnLayout;