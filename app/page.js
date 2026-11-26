import { redirect } from 'next/navigation';
import { Box, Typography, Container, Divider } from '@mui/material';
import { getServerSession } from '@/utils/getSession';
import HomeSignIn from './components/homeSignIn';

export default async function Page() {
  try {
    const data = await getServerSession();
  } catch (err) {
    if (err.message === 'Unauthorized') {
      return (
        <HomeSignIn />
      );
    }
    // For other errors, redirect to error page
    redirect('/error');
  }

  // Show welcome message for users with only non-standard assistants
  return (
    <Container maxWidth="false" sx={{ marginLeft: '0%', height: '100%' }} disableGutters={true}>
      <Box sx={{ width: '80%', marginX: '10%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box display={'flex'} flexDirection={'row'} width={'100%'} >
          <Typography fontWeight={500} fontSize={'48pt'} color={'text.heading'}>{`Welcome to KPIT AI Portal`}</Typography>
        </Box>
        <Box display={'flex'} flexDirection={'row'} maxWidth="100%" marginBottom={'1em'}>
          <Typography fontWeight={400} fontSize={'14pt'}>{`Select an assistant from the left nav to get started.`}</Typography>
        </Box>
        <Divider style={{ marginBottom: '1em' }} />
      </Box>
    </Container>
  )
}