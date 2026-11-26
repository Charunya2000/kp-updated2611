import { redirect } from 'next/navigation';
import { PERMISSIONS } from '@/app/config/permissions';
import { getTeamAccess } from '@/app/services/permissionsService';
import { getCurrentUserNuid } from '@/utils/getSession';
import RcnoaAdminExperience from './RcnoaAdminExperience';

const RCNOA_TEAM = 'reconciliation-notice-processing';

export default async function RcnoaAdminPage({ params }) {
  const { teamName } = await params;
  if (teamName !== RCNOA_TEAM) redirect('/not-found');
  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  if (!access.has(PERMISSIONS.RCNOA_PROCESSING_MANAGE)) redirect('/not-found');
  return <RcnoaAdminExperience teamName={teamName} />;
}