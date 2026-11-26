import { NextResponse } from 'next/server';
import { getAuthorizedEdiValidationJob } from '@/app/services/ediWorkbenchJobService';
import { getServerSession } from '@/utils/getSession';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req, { params }) {
  try {
    const requestStartedAt = Date.now();
    const { teamName, assistantName, smartNoteId } = await params;
    const { nuid } = await getServerSession();
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = getAuthorizedEdiValidationJob({
      jobId,
      teamName,
      assistantName,
      smartNoteId,
      ownerNuid: nuid,
    });

    if (!job) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'ediWorkbenchParseStatusNotFound',
          detail: { jobId, elapsedMs: Date.now() - requestStartedAt },
        },
      }));
      return NextResponse.json({ error: 'Job not found or expired' }, { status: 404 });
    }

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'ediWorkbenchParseStatusResponse',
        detail: {
          jobId,
          status: job.status,
          step: job.step,
          progress: job.progress,
          hasResult: Boolean(job.result),
          hasError: Boolean(job.error),
          jobUpdatedAt: job.updatedAt,
          elapsedMs: Date.now() - requestStartedAt,
        },
      },
    }));

    const publicContext = job.context
      ? Object.fromEntries(Object.entries(job.context).filter(([key]) => key !== 'ownerNuid'))
      : null;

    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
      step: job.step,
      progress: job.progress,
      overallJobPercent: job.overallJobPercent ?? job.progress,
      context: publicContext,
      metrics: job.metrics || null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      errorType: job.errorType || null,
      errorDetails: job.errorDetails || null,
      result: job.status === 'completed' ? job.result : null,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'ediWorkbenchParseStatus',
        detail: { error: error?.message || 'Failed to fetch EDI parse status' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to fetch EDI parse status' }, { status: 500 });
  }
}
