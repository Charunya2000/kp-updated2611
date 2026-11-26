'use server'
import SharePointSitesManager from "./SharePointSitesManager";
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { redirect } from "next/navigation";

const Page = async ({ params }) => {
  const { teamName } = await params;

  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  if (!access?.has(PERMISSIONS.SHAREPOINT_SITES_MANAGE)) {
    return redirect('/');
  }

  return (
    <>
      <SharePointSitesManager teamName={teamName} />
    </>
  );
}

export default Page;