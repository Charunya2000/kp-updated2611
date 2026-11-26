'use server';

import { isAppAdmin } from "@/app/services/applicationRoleService";
import { forbidden } from "next/navigation";
import { Box, Typography } from "@mui/material";

const Page = async () => {
  const isAdmin = await isAppAdmin();

  if (!isAdmin) {
    forbidden();
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h3" sx={{ mb: 3, fontWeight: 600 }}>
        Welcome to the Admin Panel
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
        Use the navigation drawer on the left to access different admin functions.
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Expect more changes to this panel soon as we modify our architecture to support multi-tenancy.
      </Typography>
    </Box>
  );
}

export default Page;