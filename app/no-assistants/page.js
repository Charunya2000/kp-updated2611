import { Box, Typography } from '@mui/material';

const Page = () => {
  return (
    <Box sx={{ p: 4, height: '100%' }}>
      <Typography variant="h4" gutterBottom>
        No Assistants Available
      </Typography>
      <Typography variant="body1">
        It looks like you don't have access to any assistants. Please contact your administrator to request access.
      </Typography>
    </Box>
  );
}

export default Page;