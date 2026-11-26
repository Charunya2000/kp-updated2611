'use server'
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { redirect } from "next/navigation";
import WorkflowManagement from "./WorkflowManagement";

const WorkflowManagementPage = async ({ params }) => {
  const { teamName } = await params;
  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  if (!access?.has(PERMISSIONS.WORKFLOWS_MANAGE)) {
    return redirect('/not-found');
  }

  return <WorkflowManagement teamName={teamName} />;
}

export default WorkflowManagementPage;
