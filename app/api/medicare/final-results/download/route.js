import { NextResponse } from 'next/server';
import { downloadFinalResultsFromBlob } from '@/app/medicare-cmp/invoice-compare/services/resultsBlobService';

/**
 * GET /api/medicare/final-results/download?runId=...&batchNumber=...&targetDatabase=...&invoiceType=med&part=N
 *
 * Streams the pre-generated .xlsx file from Azure Blob Storage.
 * The file is uploaded to blob storage when the batch comparison completes
 * (see /api/medicare/final-results/upload).
 *
 * For multi-part result sets (> 100 k rows) pass the `part` query parameter
 * (1-based) to download a specific part file.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  const batchNumber = searchParams.get('batchNumber');
  const targetDatabase = searchParams.get('targetDatabase') || 'default';
  const invoiceType = searchParams.get('invoiceType') || 'med';
  const part = searchParams.get('part');

  try {
    const result = await downloadFinalResultsFromBlob({
      runId,
      batchNumber,
      targetDatabase,
      invoiceType,
      partNumber: part ? Number(part) : undefined,
    });

    if (result.error) {
      const body = { error: result.error };
      if (result.details) {
        body.details = result.details;
      }
      return NextResponse.json(body, { status: result.status });
    }

    return new Response(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'downloadFinalResults',
        detail: { runId, batchNumber, targetDatabase, invoiceType, error: error.message },
      },
    }));

    return NextResponse.json(
      { error: 'Failed to download results.', details: error.message },
      { status: 500 },
    );
  }
}
