import { deleteDocument } from '@db/deleteDocument';
import { insertDocument } from '@db/insertDocument';
import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { updateDocument } from '@db/updateDocument';
import { v4 as uuidv4 } from 'uuid';

import {
  validateDocumentDelete,
  validateBasicMulti,
  validateGetAllMcpServers,
  validateCreateMcpServer,
  validateUpdateMcpServer
} from '@services/validation';

const documentType = 'McpServerConfig';

export async function getAllMcpServers(teamName, assistantName) {
  const query = { type: documentType, assistantName: assistantName };
  try {
    const servers = await selectDocumentsExt(query, validateGetAllMcpServers, null, `team-${teamName}-db`);
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getAllMcpServers',
        detail: { teamName, assistantName, count: Array.isArray(servers) ? servers.length : 0 }
      }
    }));
    return servers;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getAllMcpServers',
        detail: { teamName, assistantName, error: error.message }
      }
    }));
    throw new Error('Failed to fetch MCP servers.');
  }
}

export const getMcpServersByAssistantId = async (teamName, assistant) => {
  const query = { type: documentType, assistantId: assistant.id };
  return await selectDocumentsExt(
    query,
    validateBasicMulti,
    { projection: { serverLabel: 1, serverUrl: 1, requireApproval: 1, allowedTools: 1, enabled: 1, id: 1 } },
    `team-${teamName}-db`
  );
};

export const getMcpServerById = async (id, teamName) => {
  const query = { type: documentType, id: id };
  return await selectDocumentExt(query, validateBasicMulti, null, `team-${teamName}-db`);
};

export async function updateMcpServer(id, serverData, teamName) {
  try {
    serverData.type = documentType;

    const query = {
      type: documentType,
      id: id,
    };

    const updated = await updateDocument(serverData, query, validateUpdateMcpServer, `team-${teamName}-db`);
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'updateMcpServer',
        detail: { teamName, id, serverLabel: serverData.serverLabel }
      }
    }));
    return updated;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'updateMcpServer',
        detail: { teamName, id, error: error.message }
      }
    }));
    throw new Error('Failed to update MCP server.');
  }
}

export async function createMcpServer(serverData, teamName, assistantName) {
  try {
    serverData.id = uuidv4();
    serverData.type = documentType;
    serverData.assistantName = assistantName;

    const created = await insertDocument(serverData, validateCreateMcpServer, `team-${teamName}-db`);
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'createMcpServer',
        detail: { teamName, assistantName, id: serverData.id, serverLabel: serverData.serverLabel }
      }
    }));
    return created;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'createMcpServer',
        detail: { teamName, assistantName, error: error.message }
      }
    }));
    throw new Error('Failed to create MCP server.');
  }
}

export async function deleteMcpServer(id, teamName) {
  try {
    const query = {
      id: id,
      type: documentType,
    };
    const deleted = await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteMcpServer',
        detail: { teamName, id }
      }
    }));
    return deleted;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteMcpServer',
        detail: { teamName, id, error: error.message }
      }
    }));
    throw new Error('Failed to delete MCP server.');
  }
}