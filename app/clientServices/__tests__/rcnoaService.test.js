import {
  diagnoseRcnoaRow,
  saveRcnoaRunNote,
  uploadRcnaForPriorLookup,
} from '../rcnoaService.js';

describe('rcnoaService diagnostic request', () => {
  afterEach(() => jest.restoreAllMocks());

  test('posts one RCNO row to the team-scoped diagnostic endpoint', async () => {
    const diagnostic = { decision: { ruleId: 'A100' } };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      type: 'basic',
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, diagnostic }),
    });

    await expect(diagnoseRcnoaRow('reconciliation-notice-processing', '01|...'))
      .resolves.toEqual({ success: true, diagnostic });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reconciliation-notice-processing/rcno-rcna-834/rcnoa/diagnostic',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rcnoRow: '01|...' }),
        credentials: 'same-origin',
        redirect: 'manual',
      },
    );
  });

  test('surfaces the diagnostic API error', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      type: 'basic',
      headers: { get: () => 'application/json' },
      json: async () => ({ success: false, error: 'RCNO row must contain exactly 73 columns' }),
    });

    await expect(diagnoseRcnoaRow('reconciliation-notice-processing', 'invalid'))
      .rejects.toThrow('RCNO row must contain exactly 73 columns');
  });

  test('uploads RCNA with its explicit reconciliation cycle', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      type: 'basic',
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, run: { id: 'run-1' } }),
    });
    const file = new Blob(['rcna-content'], { type: 'text/plain' });

    await uploadRcnaForPriorLookup('reconciliation-notice-processing', file, '202611');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/reconciliation-notice-processing/rcno-rcna-834/rcnoa/runs/upload-rcna');
    expect(options.method).toBe('POST');
    expect(options.body.get('file')).toBeTruthy();
    expect(options.body.get('reconciliationCycle')).toBe('202611');
  });

  test('patches a note onto a run', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      type: 'basic',
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, run: { id: 'run-1', note: 'November import' } }),
    });

    await saveRcnoaRunNote('reconciliation-notice-processing', 'run-1', 'November import');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reconciliation-notice-processing/rcno-rcna-834/rcnoa/runs/run-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'November import' }),
      }),
    );
  });
});
