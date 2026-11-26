import { NextResponse } from "next/server";
import { getServerSession } from "@/utils/getSession";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { PERMISSIONS } from "@/app/config/permissions";

export const GET = withTeamPermissionGuard(PERMISSIONS.INSIGHT360_QUERIES_MANAGE)(getHandler);

async function getHandler(req, { params }) {
  try {
    const { nuid } = await getServerSession();
    const { teamName } = await params;
    if (teamName !== 'kpif-ma') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const host = process.env.ORCHESTRATION_APP_URL;
    const response = await fetch(`${host}/api/case360/mongo_route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nuid
      })
    });


    if (!response.ok) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'POST: Initialize Insight 360 Queries',
          detail: {
            status: response.statusText
          }
        }
      }));
      return NextResponse.json({ error: response.statusText || 'Failed to initialize queries' }, { status: 500 });
    }

    const result = await response.json();

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}