'use client';

import { Box, Button } from '@mui/material';

const Page = () => {

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await fetch(`/api/admin/langChainTest`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return await result.json();
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '600px', margin: 'auto', padding: 2 }}>
      <Button type="submit" variant="contained" color="primary">
        LangChain Test
      </Button>
    </Box>
  );
};

export default Page;