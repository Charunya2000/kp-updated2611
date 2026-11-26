import { redirect } from 'next/navigation';
import LLMStatisticsChart from './components/LLMStatisticsChart';
import { Container, Typography } from '@mui/material';
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";

const LLMStatisticsPage = async ({ params }) => {
  const { teamName } = await params;

  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  if (!access?.has(PERMISSIONS.LLM_STATISTICS_VIEW)) {
    return redirect('/');
  }

  return (
    <Container disableGutters="true" sx={{ display: 'flex', height: '100%', p: 2, flexDirection: 'column', alignItems: 'center' }}>
      <Typography variant="h4" gutterBottom align="center">
        LLM Statistics by Week
      </Typography>
      <LLMStatisticsChart />
    </Container>
  );
};

export default LLMStatisticsPage;