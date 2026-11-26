import {
  getSavedEditableCompanionGuide,
  listSavedEditableCompanionGuides,
  saveEditableCompanionGuide,
  uploadEdiWorkbenchFile,
} from '../ediWorkbenchService.js';

describe('EDI Workbench server upload', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sends a raw file body to the same-origin API without multipart encoding', async () => {
    const file = new File(['EDI payload'], 'sample file.edi', { type: 'text/plain' });
    const responseBody = {
      container: 'uploadeddocuments-team',
      blobName: 'assistant/note/edi-workbench/edi/sample-file.edi',
      fileName: 'sample-file.edi',
      fileCategory: 'edi',
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => responseBody,
    });

    await expect(uploadEdiWorkbenchFile(
      'team',
      'assistant',
      'note',
      file,
      'edi',
    )).resolves.toEqual(responseBody);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/team/assistant/smartNote/note/edi-workbench/upload?fileName=sample+file.edi&fileCategory=edi',
      {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: file,
      },
    );
    expect(fetchMock.mock.calls[0][1].body).not.toBeInstanceOf(FormData);
  });

  test('lists saved editable companion guide revisions without caching', async () => {
    const guides = [{ id: 'guide-1', revision: 'revision-1' }];
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ guides }),
    });

    await expect(listSavedEditableCompanionGuides('team', 'assistant', 'note')).resolves.toEqual(guides);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/team/assistant/smartNote/note/edi-workbench/companion-guide/saved',
      {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      },
    );
  });

  test('retries an initial route-level 404 when listing saved guides', async () => {
    jest.useFakeTimers();
    const guides = [{ id: 'guide-1', revision: 'revision-1' }];
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ guides }),
      });

    const request = listSavedEditableCompanionGuides('team', 'assistant', 'note');
    await jest.advanceTimersByTimeAsync(250);

    await expect(request).resolves.toEqual(guides);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  test('tolerates route-level 404s across the dev-server warm-up window', async () => {
    jest.useFakeTimers();
    const guides = [{ id: 'guide-1', revision: 'revision-1' }];
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ status: 404 })
      .mockResolvedValueOnce({ status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ guides }),
      });

    const request = listSavedEditableCompanionGuides('team', 'assistant', 'note');
    await jest.advanceTimersByTimeAsync(750);

    await expect(request).resolves.toEqual(guides);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  test('loads a selected editable companion guide revision', async () => {
    const guide = { id: 'guide/1', editableGuide: { schemaVersion: 1 } };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ guide }),
    });

    await expect(getSavedEditableCompanionGuide('team', 'assistant', 'note', 'guide/1')).resolves.toEqual(guide);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/team/assistant/smartNote/note/edi-workbench/companion-guide/saved/guide%2F1',
      {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      },
    );
  });

  test('saves an editable companion guide draft without validation', async () => {
    const payload = {
      companion: { container: 'container', blobName: 'guide.csv' },
      editableGuide: { schemaVersion: 1 },
    };
    const guide = { id: 'guide-1', validationStatus: 'draft' };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ guide }),
    });

    await expect(saveEditableCompanionGuide('team', 'assistant', 'note', payload)).resolves.toEqual(guide);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/team/assistant/smartNote/note/edi-workbench/companion-guide/saved',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
  });
});