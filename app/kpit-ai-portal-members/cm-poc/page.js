import CMPOCPage from './CMPOCPage';
import { validateUserAccess } from '@/app/services/userAccessService';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Page() {
    const team = 'kpit-ai-portal-members';
    const assistant = 'cm-poc';

    // Validate user has access to this team/assistant combination
    const userAssistant = await validateUserAccess(team, assistant);

    if (!userAssistant) {
        // User doesn't have access, return 404
        notFound();
    }

    return <CMPOCPage />;
}
