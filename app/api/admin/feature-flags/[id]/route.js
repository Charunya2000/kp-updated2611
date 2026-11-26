import { NextResponse } from "next/server";
import { withAppAdminGuard } from "@/app/api/guards";
import {
  getFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
} from '@/app/services/featureFlagService';

export const GET = await withAppAdminGuard(getHandler);
export const PUT = await withAppAdminGuard(putHandler);
export const DELETE = await withAppAdminGuard(deleteHandler);

async function getHandler(req, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Feature flag ID is required' }, { status: 400 });
    }

    const flag = await getFeatureFlag(id);

    if (!flag) {
      return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 });
    }

    return NextResponse.json({ flag }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET: Feature Flag By ID',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(req, { params }) {
  try {
    const { id } = await params;
    const { name, description, enabled } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Feature flag ID is required' }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Feature flag name is required' }, { status: 400 });
    }

    const updates = {
      name: name.trim(),
      description: description ? description.trim() : null,
      enabled: enabled ?? true,
      app: 'SmartNotes',
    };

    const result = await updateFeatureFlag(id, name, updates);

    if (result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ message: 'Feature flag updated successfully' }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'PUT: Update Feature Flag',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Feature flag ID is required' }, { status: 400 });
    }

    const result = await deleteFeatureFlag(id);

    if (result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ message: 'Feature flag deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'DELETE: Feature Flag By ID',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
