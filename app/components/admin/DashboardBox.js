'use client';

import { Paper, Typography } from '@mui/material';

const DashboardBox = ({ title, children, ...props }) => {
  return (
    <Paper
      elevation={1}
      sx={{
        p: 3,
        flexGrow: 1,
        height: '100%',
        minHeight: '450px',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        ...props.sx
      }}
      {...props}
    >
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
};

export default DashboardBox;
