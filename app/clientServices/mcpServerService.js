'use client';

export async function getAllMcpServers(teamName, assistantName) {
  const res = await fetch(`/api/admin/${teamName}/${assistantName}/mcp-servers`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load MCP servers');
  }
  return res.json();
}

export async function createMcpServer(serverData, teamName, assistantName) {
  const res = await fetch(`/api/admin/${teamName}/${assistantName}/mcp-servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serverData),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: body.error || 'Failed to create MCP server' };
  }
  return body;
}

export async function updateMcpServer(serverData, teamName, assistantName) {
  const res = await fetch(`/api/admin/${teamName}/${assistantName}/mcp-servers/${serverData.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serverData),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: body.error || 'Failed to update MCP server' };
  }
  return body;
}

export async function deleteMcpServer(serverData, teamName, assistantName) {
  const res = await fetch(`/api/admin/${teamName}/${assistantName}/mcp-servers/${serverData.id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete MCP server');
  }
  return res.json();
}