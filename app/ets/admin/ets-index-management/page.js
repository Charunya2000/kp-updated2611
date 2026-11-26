'use server'
import { isEtsIndexManager } from "@/app/services/teamRoleService";
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { redirect } from "next/navigation";
import UploadDocuments from "./UploadDocuments";

export default async function Page() {
  const isAdmin = await isEtsIndexManager('ets');

  if (!isAdmin) {
    const nuid = await getCurrentUserNuid();
    const access = await getTeamAccess('ets', nuid);
    if (!access?.has(PERMISSIONS.ETS_INDEX_MANAGE)) {
      return redirect('/');
    }
  }

  return <UploadDocuments />;
}
