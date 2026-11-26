import { Box } from '@mui/material';
import { forbidden } from 'next/navigation';

const Page = () => {

  //forbidden();

  return (
    <Box sx={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      Test Page
    </Box>
  );
};

export default Page;