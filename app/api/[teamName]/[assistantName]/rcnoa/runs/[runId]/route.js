import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { getCurrentUserNuid } from '@/utils/getSession';
import {
  deleteRcnoaRun,
  getAuthorizedRcnoaArtifactContent,
  getAuthorizedRcnoaDownload,
  getRcnoaRunDetail,
  saveRcnoaRunNote,
} from '@/app/services/rcnoa/rcnoaOperationsService';
import { rcnoaErrorResponse, rcnoaParams } from '../../routeUtils';

export const GET = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(getHandler);
export const PATCH = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(patchHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(deleteHandler);

async function getHandler(req, { params }) {
  try {
    const { runId } = await rcnoaParams(params);
    const artifactId = req.nextUrl.searchParams.get('artifactId');
    if (artifactId) {
      const actor = await getCurrentUserNuid();
      if (req.nextUrl.searchParams.get('content') === '1') {
        const artifact = await getAuthorizedRcnoaArtifactContent(artifactId, actor, runId);
        return new NextResponse(artifact.content, {
          headers: {
            'Content-Type': artifact.contentType,
            'Content-Disposition': `attachment; filename="${artifact.fileName}"`,
          },
        });
      }
      const contentUrl = new URL(req.url);
      contentUrl.searchParams.set('content', '1');
      const download = await getAuthorizedRcnoaDownload(
        artifactId,
        actor,
        `${contentUrl.pathname}${contentUrl.search}`,
        runId,
      );
      return NextResponse.json({ success: true, download });
    }
    const run = await getRcnoaRunDetail(runId);
    if (!run) return NextResponse.json({ success: false, error: 'RCNOA run not found' }, { status: 404 });
    return NextResponse.json({ success: true, run });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to load RCNOA run');
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { runId } = await rcnoaParams(params);
    const deleted = await deleteRcnoaRun(runId);
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to delete RCNOA run');
  }
}

async function patchHandler(req, { params }) {
  try {
    const { runId } = await rcnoaParams(params);
    const body = await req.json();
    const run = await saveRcnoaRunNote(runId, body?.note, await getCurrentUserNuid());
    return NextResponse.json({ success: true, run });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to save RCNOA run note');
  }
}