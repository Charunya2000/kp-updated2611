export function validateMcpServer(server) {
  const errors = [];

  if (!server || typeof server !== 'object') {
    return { valid: false, errors: ['Invalid MCP server payload'] };
  }

  if (!server.serverLabel || !server.serverLabel.trim()) {
    errors.push('Server label is required');
  }

  if (!server.serverUrl || !server.serverUrl.trim()) {
    errors.push('Server URL is required');
  }

  if (!['never', 'always'].includes(server.requireApproval)) {
    errors.push('requireApproval must be "never" or "always"');
  }

  if (server.allowedTools && !Array.isArray(server.allowedTools)) {
    errors.push('allowedTools must be an array');
  }

  return { valid: errors.length === 0, errors };
}

