import { NextResponse } from 'next/server';
import {
  uploadFinalResultsToBlob,
  isUploadLocked,
} from '@/app/membership-admin/kpif-compare/services/resultsBlobService';

/**
 * POST /api/kpif/final-results/upload
 *
 * Kicks off the generation of the final-results Excel file from Oracle
 * and its upload to Azure Blob Storage.  The work runs in the background;
 * the response is returned immediately.  Callers should poll
 * GET /api/kpif/final-results/check to know when the blob is ready.
 *
 * If an upload is already in progress (lock blob exists), the request is
 * accepted without starting a duplicate upload.
 *
 * Body: { runId, batchNumber, targetDatabase, invoiceType }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { runId, batchNumber, targetDatabase, invoiceType = 'ca' } = body;

  if (!runId || !batchNumber || !targetDatabase) {
    return NextResponse.json(
      { error: 'runId, batchNumber, and targetDatabase are required.' },
      { status: 400 },
    );
  }

  // If another upload is already in progress, skip — the caller will
  // pick it up via polling the check endpoint.
  const locked = await isUploadLocked({ runId, batchNumber, targetDatabase, invoiceType });
  if (locked) {
    return NextResponse.json({ accepted: true, alreadyRunning: true });
  }

  // Fire-and-forget: run the upload in the background.
  uploadFinalResultsToBlob({ runId, batchNumber, targetDatabase, invoiceType })
    .then((results) => {
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'uploadFinalResults',
          detail: { runId, batchNumber, targetDatabase, invoiceType, results },
        },
      }));
    })
    .catch((error) => {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'uploadFinalResults',
          detail: { runId, batchNumber, targetDatabase, invoiceType, error: error.message },
        },
      }));
    });

  return NextResponse.json({ accepted: true });
}
