import { NextResponse } from 'next/server';
import { getAuthorizedEdiValidationJob } from '@/app/services/ediWorkbenchJobService';
import { refreshValidationReportDownload } from '@/app/services/ediValidationReportArtifactService';
import { getServerSession } from '@/utils/getSession';

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { nuid } = await getServerSession();
    const { jobId } = await req.json();

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
      return NextResponse.json({ error: 'Validation report not found or access denied' }, { status: 404 });
    }
    if (job.status !== 'completed' || !job.reportArtifact) {
      return NextResponse.json({ error: 'Validation report artifact is not ready' }, { status: 409 });
    }

    const download = await refreshValidationReportDownload(job.reportArtifact);
    return NextResponse.json(download, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const unauthorized = error?.message === 'Unauthorized';
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'ediWorkbenchValidationDownload',
        detail: { error: unauthorized ? 'Unauthorized' : (error?.message || 'Failed to refresh validation report link') },
      },
    }));
    return NextResponse.json(
      { error: unauthorized ? 'Unauthorized' : (error?.message || 'Failed to refresh validation report link') },
      { status: unauthorized ? 401 : 500 },
    );
  }
}
