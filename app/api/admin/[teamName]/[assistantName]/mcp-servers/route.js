import {
  getAllMcpServers,
  createMcpServer
} from '@/app/services/mcpServerConfigService';
import { validateMcpServer } from '@/app/utils/mcpValidation';
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(getHandler);
export const POST = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(postHandler);

async function getHandler(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const servers = await getAllMcpServers(teamName, assistantName);
    return NextResponse.json(servers, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getAllMcpServers',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function postHandler(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const serverData = await req.json();

    const { valid, errors } = validateMcpServer(serverData);
    if (!valid) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    const existing = await getAllMcpServers(teamName, assistantName);
    const duplicate = existing.find(s => s.serverLabel === serverData.serverLabel);
    if (duplicate) {
      return NextResponse.json(
        { error: 'An MCP server with this label already exists.' },
        { status: 409 }
      );
    }

    const created = await createMcpServer(serverData, teamName, assistantName);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'createMcpServer',
        detail: { teamName, assistantName, serverLabel: serverData.serverLabel }
      }
    }));

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'createMcpServer',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}