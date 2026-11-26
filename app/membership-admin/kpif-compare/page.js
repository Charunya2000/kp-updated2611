import { validateUserAccess } from '@/app/services/userAccessService';
import { getServerSession } from '@/utils/getSession';
import { getTeamAccess } from '@/app/services/permissionsService';
import { PERMISSIONS } from '@/app/config/permissions';
import { notFound } from 'next/navigation';
import KpifCompare from './KpifCompare';

export const dynamic = 'force-dynamic';


export default async function Page() {
  const team = 'membership-admin';
  const assistant = 'kpif-compare';
  const userAssistant = await validateUserAccess(team, assistant);
  const session = await getServerSession();

  if (!userAssistant) {
    notFound();
  }

  const access = session?.nuid ? await getTeamAccess(team, session.nuid) : null;
  const canDeleteRunHistory = !!access?.has(PERMISSIONS.KPIF_RUN_HISTORY_DELETE);

  return (
    <KpifCompare envName={process.env.envName} canDeleteRunHistory={canDeleteRunHistory} />
  );
}