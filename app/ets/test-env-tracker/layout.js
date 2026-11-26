'use client';

import { Box } from '@mui/material';

export default function TestEnvTrackerLayout({ children }) {
  return (
    <Box sx={{ 
      height: 'calc(100vh - 64px)', // Subtract header height
      overflowY: 'auto',
      overflowX: 'hidden',
      width: '100%'
    }}>
      {children}
    </Box>
  );
}
