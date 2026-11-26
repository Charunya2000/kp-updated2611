import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { getGeisingerPreparationDocumentProgress } from '@/app/services/geisingerPreparationService';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.REGULATORY_PREPARATION_MANAGE)(getHandler);

async function getHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const jobId = req.nextUrl.searchParams.get('jobId');
    const relativeAUrl = req.nextUrl.searchParams.get('relativeAUrl');
    const fileAName = req.nextUrl.searchParams.get('fileAName');

    const detail = await getGeisingerPreparationDocumentProgress(teamName, {
      jobId,
      relativeAUrl,
      fileAName,
    });

    if (!detail) {
      return NextResponse.json({ success: false, error: 'Document progress not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, detail }, { status: 200 });
  } catch (error) {
    const message = error?.message || 'Failed to get document progress';
    const status = message.includes('required') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
