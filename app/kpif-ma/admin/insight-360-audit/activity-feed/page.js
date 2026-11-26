'use server'
import { isInsight360Auditor } from "@/app/services/teamRoleService";
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { redirect } from "next/navigation";
import UserActivityFeed from "../UserActivityFeed";

export default async function Page() {
  const isAuthorized = await isInsight360Auditor('kpif-ma');

  if (!isAuthorized) {
    const nuid = await getCurrentUserNuid();
    const access = await getTeamAccess('kpif-ma', nuid);
    if (!access?.has(PERMISSIONS.INSIGHT360_AUDIT_VIEW)) {
      return redirect('/');
    }
  }

  return <UserActivityFeed />;
}
