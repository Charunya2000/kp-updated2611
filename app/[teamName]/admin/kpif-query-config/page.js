'use server';

import { redirect } from 'next/navigation';
import KpifQueryConfigEditor from './KpifQueryConfigEditor';
import { getTeamAccess } from '@/app/services/permissionsService';
import { PERMISSIONS } from '@/app/config/permissions';
import { getCurrentUserNuid } from '@/utils/getSession';

const Page = async ({ params }) => {
  const { teamName } = await params;
  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);

  if (!access.has(PERMISSIONS.KPIF_QUERY_CONFIG_MANAGE)) {
    return redirect('/');
  }

  return <KpifQueryConfigEditor teamName={teamName} envName={process.env.envName} />;
};

export default Page;
