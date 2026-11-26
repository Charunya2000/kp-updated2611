import { validateUserAccess } from '@/app/services/userAccessService';
import { notFound } from 'next/navigation';
import TestEnvTrackerDashboard from './TestEnvTrackerDashboard';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const team = 'ets';
  const assistant = 'test-env-tracker';

  const userAssistant = await validateUserAccess(team, assistant);

  if (!userAssistant) {
    notFound();
  }

  return <TestEnvTrackerDashboard />;
}
