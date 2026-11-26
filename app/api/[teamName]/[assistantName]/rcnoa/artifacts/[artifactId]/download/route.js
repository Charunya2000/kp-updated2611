import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { getCurrentUserNuid } from '@/utils/getSession';
import {
  getAuthorizedRcnoaArtifactContent,
  getAuthorizedRcnoaDownload,
} from '@/app/services/rcnoa/rcnoaOperationsService';
import { rcnoaErrorResponse, rcnoaParams } from '../../../routeUtils';

export const GET = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(getHandler);

async function getHandler(req, { params }) {
  try {
    const { artifactId } = await rcnoaParams(params);
    const actor = await getCurrentUserNuid();
    if (req.nextUrl.searchParams.get('content') === '1') {
      const artifact = await getAuthorizedRcnoaArtifactContent(artifactId, actor);
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
    );
    return NextResponse.json({ success: true, download });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to create RCNOA download link');
  }
}