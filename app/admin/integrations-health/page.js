import { isAppAdmin } from "@/app/services/applicationRoleService";
import { forbidden } from 'next/navigation';
import IntegrationsHealth from "./IntegrationsHealth";

export default async function IntegrationsHealthPage() {
  const isAdmin = await isAppAdmin();
  if (!isAdmin) forbidden();
  return <IntegrationsHealth />;
}
