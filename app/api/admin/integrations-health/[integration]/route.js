import { NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';
import { SearchIndexClient, AzureKeyCredential } from '@azure/search-documents';
import { withAppAdminGuard } from '@/app/api/guards';
import { validateAndAcquireToken } from '@/app/services/sharepointGetAccessToken';
import { getOracleConnection } from '@/app/services/oracleService';
import { generateChatCompletion } from '@/app/services/nexusos/completionsClient';
import { vectorize } from '@/app/services/nexusos/embeddingClient';
import { generateChatResponse } from '@/app/services/nexusos/responsesClient';

const checks = new Map([
  ['orchestration', () => checkSimple('Orchestration API', process.env.ORCHESTRATION_APP_URL, '/health')],
  ['nexusos-completions', () => checkNexusOS('completions')],
  ['nexusos-responses', () => checkNexusOS('responses')],
  ['nexusos-embeddings', () => checkNexusOS('embeddings')],
  ['jira', checkJira],
  ['confluence', checkConfluence],
  ['sharepoint', checkSharePoint],
  ['datahub', checkDataHub],
  ['azure-blob-storage', checkAzureBlobStorage],
  ['azure-ai-search', checkAzureAiSearch],
]);

async function getHandler(req, { params }) {
  const { integration } = await params;
  const check = checks.get(integration);
  if (!check) {
    return NextResponse.json({ error: 'Unknown integration' }, { status: 404 });
  }
  return NextResponse.json(await check());
}

async function checkSimple(label, baseUrl, path, timeout = 5000, headers) {
  if (!baseUrl) return { label, status: 'not_configured' };
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
      headers,
      signal: ctrl.signal,
      cache: 'no-store',
    });
    return { label, status: res.ok ? 'ok' : 'error', statusCode: res.status };
  } catch (error) {
    if (error.name === 'AbortError') return { label, status: 'timeout' };
    return { label, status: 'error', error: error.message };
  } finally {
    clearTimeout(id);
  }
}

async function checkNexusOS(type) {
  try {
    if (type === 'embeddings') {
      await vectorize({ nuid: 'health-check', content: 'health' });
    } else if (type === 'completions') {
      await generateChatCompletion({
        messages: [{ role: 'user', content: 'hi' }],
        user: 'health-check',
        event: 'health-check',
      });
    } else if (type === 'responses') {
      await generateChatResponse({
        messages: [{ role: 'user', content: 'hi' }],
        user: 'health-check',
        event: 'health-check',
      });
    }
    return { label: `NexusOS ${type}`, status: 'ok' };
  } catch (error) {
    if (error.name === 'AbortError') return { label: `NexusOS ${type}`, status: 'timeout' };
    return { label: `NexusOS ${type}`, status: 'error', error: error.message };
  }
}

async function checkJira() {
  const envName = process.env.envName;
  const token = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.jira.api.key`];
  if (!token) return { label: 'JIRA', status: 'not_configured' };
  return checkSimple('JIRA', 'https://jira-aes.kp.org', '/rest/api/latest/myself', 5000, {
    Authorization: `Bearer ${token}`,
  });
}

async function checkConfluence() {
  const envName = process.env.envName;
  const token = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.confluence.api.key`];
  if (!token) return { label: 'Confluence', status: 'not_configured' };
  return checkSimple('Confluence', 'https://confluence-aes.kp.org', '/rest/api/content?limit=1', 5000, {
    Authorization: `Bearer ${token}`,
  });
}

async function checkSharePoint() {
  try {
    const token = await validateAndAcquireToken();
    return { label: 'SharePoint', status: token ? 'ok' : 'error' };
  } catch (error) {
    if (error.name === 'AbortError') return { label: 'SharePoint', status: 'timeout' };
    return { label: 'SharePoint', status: 'error', error: error.message };
  }
}

async function checkDataHub() {
  try {
    const conn = await getOracleConnection();
    if (conn) {
      await conn.close();
      return { label: 'DataHub', status: 'ok' };
    }
    return { label: 'DataHub', status: 'error', error: 'No connection returned' };
  } catch (error) {
    if (error.name === 'AbortError') return { label: 'DataHub', status: 'timeout' };
    return { label: 'DataHub', status: 'error', error: error.message };
  }
}

async function checkAzureBlobStorage() {
  const label = 'Azure Blob Storage';
  const envName = process.env.envName || 'dev';
  const connectionString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`];
  if (!connectionString) return { label, status: 'not_configured' };
  try {
    const client = BlobServiceClient.fromConnectionString(connectionString);
    await client.getProperties({ abortSignal: AbortSignal.timeout(10000) });
    return { label, status: 'ok' };
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return { label, status: 'timeout' };
    return { label, status: 'error', error: error.message };
  }
}

async function checkAzureAiSearch() {
  const label = 'Azure AI Search';
  const envName = process.env.envName;
  const endpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
  const apiKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];
  if (!endpoint || !apiKey) return { label, status: 'not_configured' };
  try {
    const client = new SearchIndexClient(endpoint, new AzureKeyCredential(apiKey));
    await client.getServiceStatistics({ abortSignal: AbortSignal.timeout(10000) });
    return { label, status: 'ok' };
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return { label, status: 'timeout' };
    return { label, status: 'error', error: error.message };
  }
}

export async function GET(req, context) {
  const handler = await withAppAdminGuard(getHandler);
  return handler(req, context);
}