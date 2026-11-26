import { validateUserAccess } from '@/app/services/userAccessService';
import { notFound } from 'next/navigation';
import DefectInsightSmartNote from './DefectInsightSmartNote';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const userAssistant = await validateUserAccess('ets', 'defect-insight-navigator');
  if (!userAssistant) notFound();
  return <DefectInsightSmartNote />;
}
