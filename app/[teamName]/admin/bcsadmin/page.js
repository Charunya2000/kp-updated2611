import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { Box } from "@mui/material";
import { notFound } from "next/navigation";
import BCSAdmin from "./bcsAdmin";

export const dynamic = 'force-dynamic';

const BCSAdminPage = async () => {
  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess('bcs', nuid);
  if (!access?.has(PERMISSIONS.BCS_ADMIN_MANAGE)) {
    return notFound();
  }

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      p: 2
    }}>
      <BCSAdmin />
    </Box>
  );
}

export default BCSAdminPage;