import { redirect } from 'next/navigation';
import StatisticsChart from './components/StatisticsChart';
import { Container, Typography } from '@mui/material';
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";

const StatisticsPage = async ({ params }) => {
  const { teamName } = await params;

  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  if (!access?.has(PERMISSIONS.STATISTICS_VIEW)) {
    return redirect('/');
  }

  return (
    <Container disableGutters="true" sx={{ display: 'flex', p: 2, pb: 4, flexDirection: 'column', alignItems: 'center' }}>
      <Typography variant="h4" gutterBottom align="center">
        Application Statistics by Week
      </Typography>
      <StatisticsChart />
    </Container>
  );
};

export default StatisticsPage;