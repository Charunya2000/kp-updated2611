'use server';

import { redirect } from 'next/navigation';
import MedCompareConfigEditor from './MedCompareConfigEditor';
import { getTeamAccess } from '@/app/services/permissionsService';
import { PERMISSIONS } from '@/app/config/permissions';
import { getCurrentUserNuid } from '@/utils/getSession';

const Page = async ({ params }) => {
  const { teamName } = await params;
  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);

  if (!access.has(PERMISSIONS.MEDICARE_AUDIT_TEMPLATE_MANAGE)) {
    return redirect('/');
  }

  return <MedCompareConfigEditor teamName={teamName} />;
};

export default Page;
