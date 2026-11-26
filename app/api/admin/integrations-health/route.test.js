import { GET } from './[integration]/route';
import { BlobServiceClient } from '@azure/storage-blob';
import { SearchIndexClient, AzureKeyCredential } from '@azure/search-documents';
import { withAppAdminGuard } from '@/app/api/guards';
import { validateAndAcquireToken } from '@/app/services/sharepointGetAccessToken';
import { getOracleConnection } from '@/app/services/oracleService';
import { generateChatCompletion } from '@/app/services/nexusos/completionsClient';
import { vectorize } from '@/app/services/nexusos/embeddingClient';
import { generateChatResponse } from '@/app/services/nexusos/responsesClient';

jest.mock('next/server', () => ({
  NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) },
}));
jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: { fromConnectionString: jest.fn() },
}));
jest.mock('@azure/search-documents', () => ({
  SearchIndexClient: jest.fn(),
  AzureKeyCredential: jest.fn(),
}));
jest.mock('@/app/api/guards', () => ({
  withAppAdminGuard: jest.fn(async handler => handler),
}), { virtual: true });
jest.mock('@/app/services/sharepointGetAccessToken', () => ({ validateAndAcquireToken: jest.fn() }), { virtual: true });
jest.mock('@/app/services/oracleService', () => ({ getOracleConnection: jest.fn() }), { virtual: true });
jest.mock('@/app/services/nexusos/completionsClient', () => ({ generateChatCompletion: jest.fn() }), { virtual: true });
jest.mock('@/app/services/nexusos/embeddingClient', () => ({ vectorize: jest.fn() }), { virtual: true });
jest.mock('@/app/services/nexusos/responsesClient', () => ({ generateChatResponse: jest.fn() }), { virtual: true });

const requestCheck = integration => GET({}, { params: Promise.resolve({ integration }) });

beforeEach(() => {
  jest.clearAllMocks();
});

test.each([
  ['nexusos-completions', generateChatCompletion, 'NexusOS completions'],
  ['nexusos-responses', generateChatResponse, 'NexusOS responses'],
  ['nexusos-embeddings', vectorize, 'NexusOS embeddings'],
  ['sharepoint', validateAndAcquireToken, 'SharePoint'],
])('%s runs only its own check', async (integration, service, label) => {
  service.mockResolvedValueOnce('success');
  const response = await requestCheck(integration);
  expect(response.body).toEqual({ label, status: 'ok' });
  expect(service).toHaveBeenCalledTimes(1);
  for (const otherService of [generateChatCompletion, generateChatResponse, vectorize, validateAndAcquireToken, getOracleConnection]) {
    if (otherService !== service) expect(otherService).not.toHaveBeenCalled();
  }
  expect(withAppAdminGuard).toHaveBeenCalled();
});

test('a pending integration does not block another integration', async () => {
  let finishCompletions;
  generateChatCompletion.mockImplementationOnce(() => new Promise(resolve => { finishCompletions = resolve; }));
  const pending = requestCheck('nexusos-completions');
  vectorize.mockResolvedValueOnce([]);
  expect((await requestCheck('nexusos-embeddings')).body.status).toBe('ok');
  finishCompletions();
  expect((await pending).body.status).toBe('ok');
});

test('returns errors for only the requested integration', async () => {
  generateChatResponse.mockRejectedValueOnce(new Error('Unavailable'));
  expect((await requestCheck('nexusos-responses')).body).toEqual({
    label: 'NexusOS responses', status: 'error', error: 'Unavailable',
  });
});

test('closes a successful DataHub connection', async () => {
  const close = jest.fn().mockResolvedValueOnce();
  getOracleConnection.mockResolvedValueOnce({ close });
  expect((await requestCheck('datahub')).body).toEqual({ label: 'DataHub', status: 'ok' });
  expect(close).toHaveBeenCalledTimes(1);
});

test('rejects unknown integration names', async () => {
  expect(await requestCheck('unknown')).toEqual({ body: { error: 'Unknown integration' }, status: 404 });
});

test('does not execute checks when the admin guard denies access', async () => {
  withAppAdminGuard.mockResolvedValueOnce(() => ({ status: 403 }));
  expect((await requestCheck('nexusos-completions')).status).toBe(403);
  expect(generateChatCompletion).not.toHaveBeenCalled();
});

describe('Azure service connectivity', () => {
  const originalEnv = process.env;
  const prefix = 'host.health-test-aiportal-web-2.aisvc.aksnp.azure.kp.org';
  let getProperties;
  let getServiceStatistics;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      envName: 'health-test',
      [`${prefix}.blobstorage.endpoint`]: 'test-connection-string',
      [`${prefix}.searchEndpoint`]: 'https://search.example.test',
      [`${prefix}.aiupload.api.key`]: 'test-key',
    };
    getProperties = jest.fn().mockResolvedValue({});
    getServiceStatistics = jest.fn().mockResolvedValue({});
    BlobServiceClient.fromConnectionString.mockReturnValue({ getProperties });
    SearchIndexClient.mockImplementation(() => ({ getServiceStatistics }));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test.each([
    ['azure-blob-storage', 'Azure Blob Storage'],
    ['azure-ai-search', 'Azure AI Search'],
  ])('%s probes only service metadata', async (integration, label) => {
    expect((await requestCheck(integration)).body).toEqual({ label, status: 'ok' });
    const probe = integration === 'azure-blob-storage' ? getProperties : getServiceStatistics;
    const otherProbe = integration === 'azure-blob-storage' ? getServiceStatistics : getProperties;
    expect(probe).toHaveBeenCalledWith({ abortSignal: expect.any(AbortSignal) });
    expect(otherProbe).not.toHaveBeenCalled();
    if (integration === 'azure-blob-storage') {
      expect(BlobServiceClient.fromConnectionString).toHaveBeenCalledWith('test-connection-string');
    } else {
      expect(SearchIndexClient).toHaveBeenCalledWith('https://search.example.test', expect.any(AzureKeyCredential));
      expect(AzureKeyCredential).toHaveBeenCalledWith('test-key');
    }
  });

  test.each([
    ['azure-blob-storage', 'Azure Blob Storage', 'blobstorage.endpoint'],
    ['azure-ai-search', 'Azure AI Search', 'searchEndpoint'],
    ['azure-ai-search', 'Azure AI Search', 'aiupload.api.key'],
  ])('%s reports missing %s configuration', async (integration, label, setting) => {
    delete process.env[`${prefix}.${setting}`];
    expect((await requestCheck(integration)).body).toEqual({ label, status: 'not_configured' });
    expect(BlobServiceClient.fromConnectionString).not.toHaveBeenCalled();
    expect(SearchIndexClient).not.toHaveBeenCalled();
  });

  test.each([
    ['azure-blob-storage', 'Azure Blob Storage'],
    ['azure-ai-search', 'Azure AI Search'],
  ])('%s reports connectivity failures', async (integration, label) => {
    const probe = integration === 'azure-blob-storage' ? getProperties : getServiceStatistics;
    probe.mockRejectedValueOnce(new Error('Service unavailable'));
    expect((await requestCheck(integration)).body).toEqual({ label, status: 'error', error: 'Service unavailable' });
  });

  test.each(['azure-blob-storage', 'azure-ai-search'])('%s reports timeouts', async integration => {
    const probe = integration === 'azure-blob-storage' ? getProperties : getServiceStatistics;
    probe.mockRejectedValueOnce(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    expect((await requestCheck(integration)).body.status).toBe('timeout');
  });
});