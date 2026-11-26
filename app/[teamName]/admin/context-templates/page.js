'use server'

import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { redirect } from "next/navigation";
import TemplateManager from "./TemplateManager";

const Page = async ({ params }) => {
  const { teamName } = await params;

  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  if (!access?.has(PERMISSIONS.CONTEXT_TEMPLATES_MANAGE)) {
    return redirect('/');
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">Template Associations</h1>
      <div>Under Construction...</div>
      {/* <TemplateManager /> */}
    </>
  );
}

export default Page;