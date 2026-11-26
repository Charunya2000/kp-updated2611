
import { NextResponse } from 'next/server';

import { isTeamAdmin } from "@/app/services/teamRoleService";
import { releaseNotesDataLoad } from '@/app/services/langgraphs/bcsChatBot/releaseNotesDataLoad';


export async function POST(request) {

    try {
        const isAdmin = await isTeamAdmin('nps');
        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        const body = await request.json().catch(() => ({}));
        const result = await releaseNotesDataLoad(body);

        return NextResponse.json(result);

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}