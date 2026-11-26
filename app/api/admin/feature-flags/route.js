import { NextResponse } from "next/server";
import { withAppAdminGuard } from "@/app/api/guards";
import {
  getFeatureFlags,
  createFeatureFlag,
} from '@/app/services/featureFlagService';

export const GET = await withAppAdminGuard(getHandler);
export const POST = await withAppAdminGuard(postHandler);

async function getHandler(req) {
  try {
    const flags = await getFeatureFlags();
    return NextResponse.json({ flags: flags || [] }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET: Feature Flags',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function postHandler(req) {
  try {
    const { name, description, enabled } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Feature flag name is required' }, { status: 400 });
    }

    const flagData = {
      name: name.trim(),
      description: description ? description.trim() : null,
      enabled: enabled ?? true,
      app: 'SmartNotes',
    };

    const result = await createFeatureFlag(flagData);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ message: 'Feature flag created successfully', data: result }, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'POST: Create Feature Flag',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
