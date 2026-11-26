import { isAppAdmin } from '@/app/services/applicationRoleService';
import { forbidden } from 'next/navigation';
import DataExtracts from './DataExtracts';

const DataExtractsPage = async () => {
  const adminCheck = await isAppAdmin();

  if (!adminCheck) {
    forbidden();
  }

  return <DataExtracts />;
};

export default DataExtractsPage;
