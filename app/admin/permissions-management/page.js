import { isAppAdmin } from '@/app/services/applicationRoleService';
import { forbidden } from 'next/navigation';
import PermissionsManagement from './PermissionsManagement';

export default async function PermissionsManagementPage() {
  const adminCheck = await isAppAdmin();

  if (!adminCheck) {
    forbidden();
  }

  return <PermissionsManagement />;
}
