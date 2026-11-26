'use server'
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { Box } from "@mui/material";
import { redirect } from "next/navigation";
import AssignUserAssistants from "./AssignUserAssistants";

const AssignUserAssistantsPage = async ({ params }) => {
  const { teamName } = await params;

  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  let allowedAssistants = null;

  const hasGlobal = access?.has(PERMISSIONS.ASSISTANTS_ASSIGN_USERS);
  const scopedAssistants = access?.getScopedValues(PERMISSIONS.ASSISTANTS_ASSIGN_USERS);

  if (hasGlobal) {
    allowedAssistants = null;
  } else if (scopedAssistants && scopedAssistants.length > 0) {
    allowedAssistants = scopedAssistants;
  } else {
    return redirect('/');
  }

  return (
    <AssignUserAssistants teamName={teamName} allowedAssistants={allowedAssistants} />
  );
}

export default AssignUserAssistantsPage;