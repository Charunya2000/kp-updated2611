'use client';

import { Box, Typography } from '@mui/material';

export default function Error(props) {
  return (
    <Box sx={{ p: 4, height: '100%', alignContent: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <Typography variant="h1" gutterBottom>
        Oops, something went wrong!
      </Typography>
      <Typography variant="body1">
        We're sorry, but an unknown error has occurred. Please try again later. If this problem persists, please contact us at <a href="mailto:HealthPlanAIServices@kp.org">HealthPlanAIServices@kp.org</a>
      </Typography>
    </Box>
  );
}