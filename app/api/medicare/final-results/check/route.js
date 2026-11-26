import { NextResponse } from 'next/server';
import { checkFinalResultsBlobExists } from '@/app/medicare-cmp/invoice-compare/services/resultsBlobService';

/**
 * GET /api/medicare/final-results/check?runId=...&batchNumber=...&targetDatabase=...&invoiceType=med
 *
 * Returns { exists: true/false } indicating whether the pre-generated
 * results file is available in blob storage.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  const batchNumber = searchParams.get('batchNumber');
  const targetDatabase = searchParams.get('targetDatabase') || 'default';
  const invoiceType = searchParams.get('invoiceType') || 'med';

  try {
    const result = await checkFinalResultsBlobExists({
      runId,
      batchNumber,
      targetDatabase,
      invoiceType,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'checkFinalResultsBlobExists - medicare',
        detail: { runId, batchNumber, targetDatabase, invoiceType, error: error.message },
      },
    }));

    return NextResponse.json({ exists: false, uploading: false });
  }
}
