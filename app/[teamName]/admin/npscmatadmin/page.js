import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { Box } from "@mui/material";
import { notFound } from "next/navigation";
import CMATAdmin from "./cmatAdmin";

export const dynamic = 'force-dynamic';

const CMATAdminPage = async () => {
  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess('nps', nuid);
  if (!access?.has(PERMISSIONS.CMAT_ADMIN_MANAGE)) {
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
      <CMATAdmin />
    </Box>
  );
}

export default CMATAdminPage;