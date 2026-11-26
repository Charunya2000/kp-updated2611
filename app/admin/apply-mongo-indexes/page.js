import { isAppAdmin } from '@/app/services/applicationRoleService';
import { forbidden } from 'next/navigation';
import ApplyMongoIndexes from './ApplyMongoIndexes';

const ApplyMongoIndexesPage = async () => {
  const adminCheck = await isAppAdmin();

  if (!adminCheck) {
    forbidden();
  }

  return <ApplyMongoIndexes />;
};

export default ApplyMongoIndexesPage;
