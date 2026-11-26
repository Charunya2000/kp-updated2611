const GENERATE_PATH = '/api/casa/testdata';

export async function fetchWorkbookSheets(file) {
    try {
        const ExcelJS = (await import('exceljs-hardened')).default;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());

        return workbook.worksheets.map(worksheet => {
            let universeColumn = null;
            worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
                if (String(cell.text || '').trim().toLowerCase() === 'universe') {
                    universeColumn = columnNumber;
                }
            });

            const universes = new Set();
            if (universeColumn !== null) {
                for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
                    const value = String(worksheet.getCell(rowNumber, universeColumn).text || '').trim();
                    if (value) universes.add(value);
                }
            }

            return { name: worksheet.name, universes: [...universes] };
        });
    } catch {
        return [];
    }
}

export async function generateCasaData({ file, maxRows, rowPerTestCase = false, tabName, universe }) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ensure_case_coverage', String(rowPerTestCase));
    if (!rowPerTestCase) {
        formData.append('maxRows', String(maxRows));
    }
    formData.append('tab_name', tabName);
    formData.append('universe', universe);

    const response = await fetch(GENERATE_PATH, { method: 'POST', body: formData });
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok || contentType.includes('application/json')) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Test data generation failed');
    }

    return {
        blob: await response.blob(),
        fileName: parseFileName(response.headers.get('content-disposition')),
    };
}

function parseFileName(contentDisposition) {
    const match = contentDisposition && /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition);
    if (!match) {
        return `casa-test-data-${Date.now()}.xlsx`;
    }

    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}
