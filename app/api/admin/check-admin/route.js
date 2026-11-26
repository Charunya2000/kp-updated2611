import { NextResponse } from "next/server";
import { isAppAdmin } from "@/app/services/applicationRoleService";

export async function GET(req) {
    try {
        const isAdmin = await isAppAdmin();
        return NextResponse.json({ isAdmin }, { status: 200 });
    } catch (error) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'GET: Check Application Admin',
                detail: {
                    error: error.message
                }
            }
        }));
        return NextResponse.json({ error: error.message, isAdmin: false }, { status: 500 });
    }
}
