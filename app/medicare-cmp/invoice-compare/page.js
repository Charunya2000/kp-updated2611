import { validateUserAccess } from '@/app/services/userAccessService';
import { getServerSession } from '@/utils/getSession';
import { getTeamAccess } from '@/app/services/permissionsService';
import { PERMISSIONS } from '@/app/config/permissions';
import { notFound } from 'next/navigation';
import MedicareCompare from './MedicareCompare';

export const dynamic = 'force-dynamic';


export default async function Page() {
  const team = 'medicare-cmp';
  const assistant = 'invoice-compare';
  const userAssistant = await validateUserAccess(team, assistant);
  const session = await getServerSession();

  if (!userAssistant) {
    notFound();
  }

  const access = session?.nuid ? await getTeamAccess(team, session.nuid) : null;
  const canDeleteRunHistory = !!access?.has(PERMISSIONS.MEDICARE_RUN_HISTORY_DELETE);

  return (
    <MedicareCompare envName={process.env.envName} canDeleteRunHistory={canDeleteRunHistory} />
  );
}