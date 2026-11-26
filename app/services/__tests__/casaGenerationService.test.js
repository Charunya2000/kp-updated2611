import { generateCasaTestData } from '../casaGenerationService';
import { generateCasaData } from '../../clientServices/casaAssistantService';
import { POST } from '../../api/casa/testdata/route';
import { validateUserAccess } from '@/app/services/userAccessService';
import { generateCasaTestData as generateFromRoute } from '@/app/services/casaGenerationService';

jest.mock('next/server', () => ({ NextResponse: Response }));
jest.mock('@/app/services/userAccessService', () => ({
    validateUserAccess: jest.fn(),
}), { virtual: true });
jest.mock('@/app/services/casaGenerationService', () => ({
    generateCasaTestData: jest.fn(),
    sanitizeFileName: jest.fn(value => value),
}), { virtual: true });

const originalFetch = global.fetch;

beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => new Response('workbook', {
        headers: { 'content-type': 'application/octet-stream' },
    }));
    validateUserAccess.mockResolvedValue(true);
    generateFromRoute.mockResolvedValue({
        buffer: Buffer.from('workbook'),
        fileName: 'output.xlsx',
        contentType: 'application/octet-stream',
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
});

describe.each([
    ['client', options => generateCasaData({ file: new Blob(['source']), ...options })],
    ['upstream', options => generateCasaTestData({
        fileBuffer: Buffer.from('source'), fileName: 'source.xlsx', ...options,
    })],
])('%s request', (name, generate) => {
    test.each([false, true])('sends mutually exclusive row settings (automatic: %s)', async rowPerTestCase => {
        await generate({ maxRows: 10, rowPerTestCase, tabName: 'Sheet1', universe: 'Members' });

        const body = global.fetch.mock.calls[0][1].body;
        expect(body.get('maxRows')).toBe(rowPerTestCase ? null : '10');
        expect(body.get('ensure_case_coverage')).toBe(String(rowPerTestCase));
        expect(body.has('rowPerTestCase')).toBe(false);
        expect(body.get('tab_name')).toBe('Sheet1');
        expect(body.get('universe')).toBe('Members');
    });

    test('defaults coverage to false when not specified', async () => {
        await generate({ maxRows: 10, tabName: 'Sheet1', universe: 'Members' });
        const body = global.fetch.mock.calls[0][1].body;
        expect(body.get('ensure_case_coverage')).toBe('false');
        expect(body.get('maxRows')).toBe('10');
    });
});

function makeRequest(fields) {
    const formData = new FormData();
    formData.append('file', new Blob(['source']), 'source.xlsx');
    formData.append('tab_name', 'Sheet1');
    formData.append('universe', 'Members');
    Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
    return { formData: async () => formData };
}

describe('CASA route row selection', () => {
    test.each([{}, { maxRows: '0' }, { maxRows: '1.5' }, { maxRows: '1000001' }])(
        'rejects invalid manual limits: %j', async fields => {
            const response = await POST(makeRequest(fields));
            expect(response.status).toBe(400);
            expect(generateFromRoute).not.toHaveBeenCalled();
        }
    );

    test.each([{}, { ensure_case_coverage: 'false' }])('preserves manual generation: %j', async fields => {
        const response = await POST(makeRequest({ ...fields, maxRows: '10' }));
        expect(response.status).toBe(200);
        expect(generateFromRoute).toHaveBeenCalledWith(expect.objectContaining({
            maxRows: 10, rowPerTestCase: false,
        }));
    });

    test.each([{}, { maxRows: '0' }, { maxRows: '10' }])(
        'automatic generation ignores manual limits: %j', async fields => {
            const response = await POST(makeRequest({ ...fields, ensure_case_coverage: 'true' }));
            expect(response.status).toBe(200);
            expect(generateFromRoute).toHaveBeenCalledWith(expect.objectContaining({
                maxRows: undefined, rowPerTestCase: true,
            }));
        }
    );

    test('rejects invalid automatic mode values', async () => {
        const response = await POST(makeRequest({ maxRows: '10', ensure_case_coverage: 'yes' }));
        expect(response.status).toBe(400);
        expect(generateFromRoute).not.toHaveBeenCalled();
    });

    test('still requires access in automatic mode', async () => {
        validateUserAccess.mockResolvedValue(false);
        const response = await POST(makeRequest({ ensure_case_coverage: 'true' }));
        expect(response.status).toBe(403);
        expect(generateFromRoute).not.toHaveBeenCalled();
    });
});