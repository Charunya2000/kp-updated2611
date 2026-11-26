import { notFound } from 'next/navigation';
import { validateUserAccess } from '@/app/services/userAccessService';
import CasaAssistant from './CasaAssistant';

export const dynamic = 'force-dynamic';

export default async function Page() {
    const userAssistant = await validateUserAccess('casa', 'casa-assistant');

    if (!userAssistant) {
        notFound();
    }

    return <CasaAssistant />;
}
