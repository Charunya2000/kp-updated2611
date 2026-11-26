import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { getAllSharePointSites } from '@/app/services/sharePointService';
import { discoverGeisingerPreparationDocuments } from '@/app/services/geisingerPreparationService';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.REGULATORY_PREPARATION_MANAGE)(getHandler);

async function getHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const query = req.nextUrl.searchParams;

    const availableSites = await getAllSharePointSites(teamName);
    const siteNames = (availableSites || []).map((site) => String(site?.name || '').trim()).filter(Boolean);

    const requestedSiteName = String(query.get('siteName') || '').trim();
    const selectedSiteName = requestedSiteName || siteNames[0] || '';

    if (!selectedSiteName) {
      return NextResponse.json({
        success: false,
        error: 'No SharePoint sites are configured for this team.',
      }, { status: 400 });
    }

    const rootFolder = query.get('rootFolder') || 'Shared Documents';
    const lobFolders = query.get('lobFolders') || '';
    const fileName = query.get('fileName') || '';

    const discovered = await discoverGeisingerPreparationDocuments({
      teamName,
      siteName: selectedSiteName,
      rootFolder,
      lobFolders,
      fileName,
    });

    const documents = Array.isArray(discovered?.documents) ? discovered.documents : [];

    return NextResponse.json({
      success: true,
      siteName: selectedSiteName,
      availableSites: siteNames,
      ...discovered,
    }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'discoverGeisingerPreparationDocumentsApiError',
        detail: {
          error: error?.message || 'Failed to discover Geisinger preparation documents',
        },
      }
    }));

    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to discover Geisinger preparation documents',
    }, { status: 500 });
  }
}
