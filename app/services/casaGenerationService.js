const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DEFAULT_CASA_TESTDATA_URL = 'https://dev-aiasstsvc-bff-1.aisvc.aksnp.azure.kp.org/api/casa/testdata/';

export async function generateCasaTestData({ fileBuffer, fileName, maxRows, rowPerTestCase = false, tabName, universe }) {
    const endpoint = (process.env.CASA_TESTDATA_API_URL || DEFAULT_CASA_TESTDATA_URL).trim();

    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer], { type: XLSX_CONTENT_TYPE }), fileName);
    formData.append('ensure_case_coverage', String(rowPerTestCase));
    if (!rowPerTestCase) {
        formData.append('maxRows', String(maxRows));
    }
    formData.append('tab_name', tabName);
    formData.append('universe', universe);

    const response = await fetch(endpoint, { method: 'POST', body: formData });
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok || contentType.includes('application/json')) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(payload.error || 'Test data generation failed');
        // Upstream rejections are surfaced as 400/502 so they are not mistaken for a portal fault.
        error.status = response.status >= 500 || response.status === 200 ? 502 : response.status;
        throw error;
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
        buffer: Buffer.from(arrayBuffer),
        fileName: parseFileNameFromContentDisposition(response.headers.get('content-disposition'))
            || buildFallbackFileName(universe),
        contentType: contentType || XLSX_CONTENT_TYPE,
    };
}

export function sanitizeFileName(fileName) {
    return String(fileName)
        .replace(/[\r\n"\\/]/g, '')
        .replace(/\.\./g, '')
        .trim()
        .slice(0, 180);
}

function parseFileNameFromContentDisposition(contentDisposition) {
    const match = contentDisposition && /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition);
    if (!match) return null;

    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

function buildFallbackFileName(universe) {
    const safeUniverse = String(universe).replace(/[^a-z0-9]+/gi, '-');
    return `casa-test-data-${safeUniverse}-${Date.now()}.xlsx`;
}
