import {
  updateMcpServer,
  deleteMcpServer,
  getAllMcpServers,
  getMcpServerById
} from '@/app/services/mcpServerConfigService';
import { validateMcpServer } from '@/app/utils/mcpValidation';
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const PUT = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(deleteHandler);

async function putHandler(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;
    const serverData = await req.json();

    const existingById = await getMcpServerById(id, teamName);
    if (!existingById) {
      return NextResponse.json({ error: 'MCP server not found' }, { status: 404 });
    }

    const { valid, errors } = validateMcpServer(serverData);
    if (!valid) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    const allServers = await getAllMcpServers(teamName, assistantName);
    const duplicate = allServers.find(s => s.serverLabel === serverData.serverLabel && s.id !== id);
    if (duplicate) {
      return NextResponse.json(
        { error: 'An MCP server with this label already exists.' },
        { status: 409 }
      );
    }

    const updated = await updateMcpServer(id, serverData, teamName);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'updateMcpServer',
        detail: { teamName, assistantName, id, serverLabel: serverData.serverLabel }
      }
    }));

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'updateMcpServer',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { teamName, id } = await params;
    const deleted = await deleteMcpServer(id, teamName);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteMcpServer',
        detail: { teamName, id }
      }
    }));

    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteMcpServer',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}