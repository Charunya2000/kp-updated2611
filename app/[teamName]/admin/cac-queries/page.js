'use server'
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { redirect } from "next/navigation";
import QueryEditor from "./QueryEditor";

const Page = async ({ params }) => {
  const { teamName } = await params;

  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  if (!access?.has(PERMISSIONS.CAC_REPORTS_ACCESS)) {
    return redirect('/');
  }

  return (
    <>
      <QueryEditor />
    </>
  );
}

export default Page;