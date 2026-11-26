import React from 'react';
import { Box } from '@mui/material';

const LoadingAnimation = () => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
      <Box sx={{ display: 'flex', gap: '8px' }}>
        <Box sx={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#4169E1', animation: 'fade 1s infinite' }} />
        <Box sx={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#4169E1', animation: 'fade 1s infinite 0.2s' }} />
        <Box sx={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#4169E1', animation: 'fade 1s infinite 0.4s' }} />
      </Box>
      <style jsx>{`
        @keyframes fade {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </Box>
  );
};

export default LoadingAnimation;