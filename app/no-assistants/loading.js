import { Box, Skeleton } from '@mui/material';

const Loading = () => {
  return (
    <Box sx={{ p: 4, height: '100%' }}>
      <Skeleton variant="rectangular" width="100%" height="10%" sx={{ borderRadius: '15px' }} />
    </Box>
  );
}

export default Loading;