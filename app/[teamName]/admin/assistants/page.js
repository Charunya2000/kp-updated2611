'use server'
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { Box } from "@mui/material";
import { redirect } from "next/navigation";
import AssistantManagement from "./AssistantManagement";

const AssistantManagementPage = async ({ params }) => {
  const { teamName } = await params;

  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  if (!access?.has(PERMISSIONS.ASSISTANTS_MANAGE)) {
    return redirect('/');
  }

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      p: 2
    }}>
      <AssistantManagement teamName={teamName} />
    </Box>
  );
}

export default AssistantManagementPage;