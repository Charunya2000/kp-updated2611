import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { updateBulkSources } from "@/app/services/sourceService";
import { PERMISSIONS } from "@/app/config/permissions";

export const PUT = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(putHandler);

async function putHandler(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const sources = await req.json();
    if (!Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: 'No sources provided for bulk update' },
        { status: 400 }
      );
    }

    await updateBulkSources(sources, teamName);

    return NextResponse.json(
      { success: true, updatedSources: sources },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in bulk updating sources:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}