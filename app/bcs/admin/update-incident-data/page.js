import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { redirect } from "next/navigation";
import UpdateIncident from "./UpdateIncident";

export default async function Page() {
  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess('bcs', nuid);
  if (!access?.has(PERMISSIONS.BCS_INCIDENT_INDEX_MANAGE)) {
    return redirect('/');
  }

  return (
    <UpdateIncident />
  );
}