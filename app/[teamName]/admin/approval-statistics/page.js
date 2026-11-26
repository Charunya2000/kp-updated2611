import { redirect } from 'next/navigation';
import { Container, Typography } from '@mui/material';
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import ApprovalStatisticsView from './components/ApprovalStatisticsView';

const ApprovalStatisticsPage = async ({ params }) => {
  const { teamName } = await params;

  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  if (!access?.has(PERMISSIONS.APPROVAL_STATISTICS_VIEW)) {
    return redirect('/');
  }

  return (
    <Container disableGutters sx={{ display: 'flex', p: 2, pb: 4, flexDirection: 'column' }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Chat Interaction Approval Statistics
      </Typography>
      <ApprovalStatisticsView teamName={teamName} />
    </Container>
  );
};

export default ApprovalStatisticsPage;
