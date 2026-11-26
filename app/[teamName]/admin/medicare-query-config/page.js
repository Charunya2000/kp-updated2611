'use server';

import { redirect } from 'next/navigation';
import MedQueryConfigEditor from './MedQueryConfigEditor';
import { getTeamAccess } from '@/app/services/permissionsService';
import { PERMISSIONS } from '@/app/config/permissions';
import { getCurrentUserNuid } from '@/utils/getSession';

const Page = async ({ params }) => {
  const { teamName } = await params;
  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);

  if (!access.has(PERMISSIONS.MEDICARE_QUERY_CONFIG_MANAGE)) {
    return redirect('/');
  }

  return <MedQueryConfigEditor teamName={teamName} envName={process.env.envName} />;
};

export default Page;
