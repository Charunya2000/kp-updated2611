import { isAppAdmin } from '@/app/services/applicationRoleService';
import { forbidden } from 'next/navigation';
import DataLoads from './DataLoads';

const DataLoadsPage = async () => {
  const adminCheck = await isAppAdmin();

  if (!adminCheck) {
    forbidden();
  }

  return <DataLoads />;
};

export default DataLoadsPage;
