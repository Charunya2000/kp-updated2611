'use server'
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { redirect } from "next/navigation";
import QueryEditor from "./QueryEditor";

const Page = async () => {
  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess('kpif-ma', nuid);
  if (!access?.has(PERMISSIONS.INSIGHT360_QUERIES_MANAGE)) {
    return redirect('/');
  }

  return (
    <>
      <QueryEditor />
    </>
  );
}

export default Page;