import { isAppAdmin } from '@/app/services/applicationRoleService';
import { forbidden } from 'next/navigation';
import CreateSearchIndex from './CreateSearchIndex';

const CreateSearchIndexPage = async () => {
  const adminCheck = await isAppAdmin();

  if (!adminCheck) {
    forbidden();
  }

  return <CreateSearchIndex />;
};

export default CreateSearchIndexPage;
