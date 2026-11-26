const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'SessionInformation.js'), 'utf8');
const start = source.indexOf('  const handleLoadSessionInternal = async');
const end = source.indexOf('\n  const handleKeyPress', start);
const handler = source.slice(start, end);

function createHarness({ sessions = [], createResponse, fileOwner = null, loading = false } = {}) {
  const context = {
    console: { log: jest.fn(), warn: jest.fn() },
    user: { id: 'TEST_USER' },
    currentUserNUID: 'TEST_USER',
    currentUserName: 'Test User',
    loading,
    setError: jest.fn(),
    setSessionInfo: jest.fn(),
    setIsOwner: jest.fn(),
    setIsLoading: jest.fn(),
    setSessionOwnerName: jest.fn(),
    setReportUrl: jest.fn(),
    onSessionChange: jest.fn(),
    onOwnershipChange: jest.fn(),
    onSessionLoaded: jest.fn(),
    saveSession: jest.fn(),
    checkSessionFiles: jest.fn(async () => ({ allFiles: [], ownerInfo: { createdByNUID: fileOwner } })),
    setLoadedSlaFileNames: jest.fn(),
    touchSession: jest.fn(),
    fetchSessionReport: jest.fn(async () => {}),
    fetch: jest.fn(async url => {
      if (url === '/api/pts/sessions') {
        return { ok: true, json: async () => sessions };
      }
      return createResponse || { ok: true, json: async () => ({ createdByNUID: 'TEST_USER' }) };
    }),
  };
  vm.createContext(context);
  return {
    context,
    run: () => vm.runInContext(`${handler}\nhandleLoadSessionInternal('new-session')`, context),
  };
}

test('successful creation enables editing using the returned owner', async () => {
  const { context, run } = createHarness();
  await run();
  expect(context.onSessionChange).toHaveBeenLastCalledWith('new-session');
  expect(context.onOwnershipChange).toHaveBeenCalledWith(true, 'TEST_USER');
  expect(context.setSessionInfo).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'active' }));
});

test('creation failure shows backend error and does not load or register the session', async () => {
  const { context, run } = createHarness({
    createResponse: { ok: false, status: 500, json: async () => ({ details: 'Storage unavailable' }) },
  });
  await run();
  expect(context.setError).toHaveBeenLastCalledWith('Failed to create session (HTTP 500). Storage unavailable');
  expect(context.onSessionChange).toHaveBeenCalledTimes(1);
  expect(context.onSessionChange).toHaveBeenCalledWith('');
  expect(context.setSessionInfo).toHaveBeenCalledWith(null);
  expect(context.saveSession).not.toHaveBeenCalled();
  expect(context.checkSessionFiles).not.toHaveBeenCalled();
  expect(context.onOwnershipChange).not.toHaveBeenCalled();
  expect(context.setIsLoading).toHaveBeenLastCalledWith(false);
});

test('non-JSON creation errors still stop loading with an HTTP error', async () => {
  const { context, run } = createHarness({
    createResponse: { ok: false, status: 502, json: async () => { throw new Error('Invalid JSON'); } },
  });
  await run();
  expect(context.setError).toHaveBeenLastCalledWith('Failed to create session (HTTP 502). Please try again.');
  expect(context.checkSessionFiles).not.toHaveBeenCalled();
});

test('network errors during creation stop loading', async () => {
  const { context, run } = createHarness();
  context.fetch.mockImplementationOnce(async () => ({ ok: true, json: async () => [] }))
    .mockRejectedValueOnce(new Error('Network unavailable'));
  await run();
  expect(context.setError).toHaveBeenLastCalledWith('Network unavailable');
  expect(context.checkSessionFiles).not.toHaveBeenCalled();
});

test('session-list failure does not attempt creation', async () => {
  const { context, run } = createHarness();
  context.fetch.mockResolvedValue({ ok: false, status: 503 });
  await run();
  expect(context.fetch).toHaveBeenCalledTimes(1);
  expect(context.setError).toHaveBeenLastCalledWith(expect.stringContaining('HTTP 503'));
  expect(context.checkSessionFiles).not.toHaveBeenCalled();
});

test.each([
  ['another user', 'OTHER_USER', false],
  ['unknown owner', null, false],
  ['current user with casing and whitespace differences', ' test_user ', true],
])('existing session owned by %s has the expected permissions', async (description, owner, isOwner) => {
  const { context, run } = createHarness({ sessions: [{ session_id: 'new-session', createdByNUID: owner }] });
  await run();
  expect(context.fetch).toHaveBeenCalledTimes(1);
  expect(context.onOwnershipChange).toHaveBeenCalledWith(isOwner, owner);
});

test('creation response for an existing session does not assume current-user ownership', async () => {
  const { context, run } = createHarness({
    createResponse: { ok: true, json: async () => ({ createdByNUID: 'OTHER_USER' }) },
  });
  await run();
  expect(context.onOwnershipChange).toHaveBeenCalledWith(false, 'OTHER_USER');
  expect(context.saveSession).toHaveBeenCalledWith(expect.objectContaining({ createdByNUID: 'OTHER_USER' }));
});

test('creation without owner metadata remains read-only', async () => {
  const { context, run } = createHarness({ createResponse: { ok: true, json: async () => ({}) } });
  await run();
  expect(context.onOwnershipChange).toHaveBeenCalledWith(false, null);
});

test('file metadata can supply a missing owner', async () => {
  const { context, run } = createHarness({
    sessions: [{ session_id: 'new-session' }], fileOwner: 'TEST_USER',
  });
  await run();
  expect(context.onOwnershipChange).toHaveBeenCalledWith(true, 'TEST_USER');
});

test('internal loading also waits for authentication', async () => {
  const { context, run } = createHarness({ loading: true });
  await run();
  expect(context.fetch).not.toHaveBeenCalled();
  expect(context.setError).toHaveBeenLastCalledWith('Please wait for authentication to complete');
});