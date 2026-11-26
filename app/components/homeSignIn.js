'use client';

import { Box, Typography, Button } from '@mui/material';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';

export default function HomeSignIn() {
  const { signIn } = useAuth();

  const handleSignin = async () => {
    await signIn('aiportal');
  };

  return (
    <Box style={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <Typography sx={{ mb: 24 }} variant='h2'>Welcome to the KPIT AI Portal.</Typography>
      <Typography sx={{ mb: 4 }} variant='h4'>Please sign in to continue.</Typography>
      <Button
        variant='primary'
        onClick={handleSignin}
        sx={{ mb: 24, width: '280px' }}
      >Sign In</Button>
    </Box>
  )
}