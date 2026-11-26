'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import ResponseFooter from './ResponseFooter';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';


const Prelude = () => {
  const smartNote = useSmartNote();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', borderRadius: '15px', padding: 2, backgroundColor: 'card.body.dark' }}>
      <Typography variant="h5" sx={{ fontSize: '24px' }}>{smartNote?.title}</Typography>
      <Typography variant="body2" sx={{ fontSize: '16px', color: 'grey.800' }}>{smartNote?.sourceCount} sources</Typography>
      <ReactMarkdown>{smartNote?.prelude}</ReactMarkdown>
      <ResponseFooter />
    </Box>
  );
};

export default Prelude;