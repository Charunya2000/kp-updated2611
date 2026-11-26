import { NextResponse } from 'next/server';
import { validateUserAccess } from '@/app/services/userAccessService';
import { generateCasaTestData, sanitizeFileName } from '@/app/services/casaGenerationService';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_ROWS_LIMIT = 1000000;

export async function POST(req) {
    let universe = '';
    let tabName = '';
    let maxRows = '';
    let rowPerTestCase = false;

    try {
        const userAssistant = await validateUserAccess('casa', 'casa-assistant');
        if (!userAssistant) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get('file');
        tabName = String(formData.get('tab_name') || '').trim();
        universe = String(formData.get('universe') || '').trim();
        maxRows = String(formData.get('maxRows') || '').trim();
        const rowPerTestCaseValue = formData.get('ensure_case_coverage');
        if (rowPerTestCaseValue !== null && rowPerTestCaseValue !== 'true' && rowPerTestCaseValue !== 'false') {
            return NextResponse.json({ error: 'ensure_case_coverage must be true or false' }, { status: 400 });
        }
        rowPerTestCase = rowPerTestCaseValue === 'true';

        if (!file || typeof file.arrayBuffer !== 'function') {
            return NextResponse.json({ error: 'A source file is required' }, { status: 400 });
        }

        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            return NextResponse.json({ error: 'Only .xlsx files are supported' }, { status: 415 });
        }

        if (file.size > MAX_FILE_BYTES) {
            return NextResponse.json({ error: 'The source file exceeds the 25 MB limit' }, { status: 413 });
        }

        const parsedMaxRows = rowPerTestCase ? undefined : Number(maxRows);
        if (!rowPerTestCase && (!Number.isInteger(parsedMaxRows) || parsedMaxRows < 1 || parsedMaxRows > MAX_ROWS_LIMIT)) {
            return NextResponse.json(
                { error: `Max Rows must be a whole number between 1 and ${MAX_ROWS_LIMIT}` },
                { status: 400 }
            );
        }

        if (!universe) {
            return NextResponse.json({ error: 'The universe provided is invalid' }, { status: 400 });
        }

        if (!tabName) {
            return NextResponse.json({ error: 'The Excel tab provided is invalid' }, { status: 400 });
        }

        const generated = await generateCasaTestData({
            fileBuffer: Buffer.from(await file.arrayBuffer()),
            fileName: file.name,
            maxRows: parsedMaxRows,
            rowPerTestCase,
            tabName,
            universe,
        });

        console.log(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'casaGenerateTestData',
                detail: { tabName, universe, maxRows: parsedMaxRows, rowPerTestCase, fileName: generated.fileName },
            }
        }));

        return new NextResponse(generated.buffer, {
            status: 200,
            headers: {
                'Content-Type': generated.contentType,
                'Content-Disposition': `attachment; filename="${sanitizeFileName(generated.fileName)}"`,
                'Content-Length': String(generated.buffer.length),
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'casaGenerateTestData',
                detail: { tabName, universe, maxRows, rowPerTestCase, error: error.message },
            }
        }));

        return NextResponse.json(
            { error: error.message || 'Test data generation failed' },
            { status: error.status || 500 }
        );
    }
}
