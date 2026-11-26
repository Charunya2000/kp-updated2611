import { validateUserAccess } from '@/app/services/userAccessService';
import { notFound } from 'next/navigation';
import { Box } from '@mui/material';

export const dynamic = 'force-dynamic';


export default async function Page() {
  const team = 'kpit-ai-portal-members';
  const assistant = 'pdf-analyzer';

  // Validate user has access to this team/assistant combination
  const userAssistant = await validateUserAccess(team, assistant);

  if (!userAssistant) {
    // User doesn't have access, return 404
    notFound();
  }

  return (
    <Box display={'flex'} flexDirection={'row'} width={'100%'} height={'100%'} marginBottom={'1em'}>
      <iframe
        src={'http://10.15.218.209:8502/'}
        width="100%"
        height="100%"
        style={{ border: 'none' }}
        title="PDF Analyzer"
      />
    </Box>
  );
}