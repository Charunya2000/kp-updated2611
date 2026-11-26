'use server'

import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { redirect } from "next/navigation";
import TemplateEditor from "./TemplateEditor";

const Page = async ({ params }) => {
  const { teamName, id } = await params;

  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  if (!access?.has(PERMISSIONS.CONTEXT_TEMPLATES_MANAGE)) {
    return redirect('/');
  }

  // primitive UUID check
  if (!id || id.length !== 36) {
    return redirect('/admin/context-templates');
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">Template Associations</h1>
      <div>Under Construction...</div>
      {/* <TemplateEditor templateId={id} /> */}
    </>
  );
}

export default Page;