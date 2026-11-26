import { getFolderByServerRelativeUrl as getFolderByServerRelativeUrlGraph } from "@/app/services/sharePointGraphRestAPIService";
import { getFolderByServerRelativeUrl } from "@/app/services/sharePointRestAPIService";
import { NextResponse } from "next/server";
import { supportedFileExtensions } from "@/utils/constants";

export async function GET(req) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Extract and validate parameters
    const searchParams = req.nextUrl.searchParams;
    const folder = searchParams.get('folder');
    const site = searchParams.get('site');

    // Parameter validation
    if (!site || !folder) {
      console.error(`❌ [SharePoint-Folder-Route] Missing required parameters:`, {
        requestId,
        site: !!site,
        folder: !!folder,
        providedSite: site,
        providedFolder: folder
      });
      return NextResponse.json({
        error: 'Missing parameters',
        details: { site: !!site, folder: !!folder }
      }, { status: 400 });
    }

    const useEnvSwitch = searchParams.get('useEnvSwitch') === 'true';
    const useGraph = useEnvSwitch ? process.env.USE_VAULT === 'true' : true;
    const results = useGraph ? await getFolderByServerRelativeUrlGraph(site, folder) : await getFolderByServerRelativeUrl(site, folder);

    // Extract data from results
    const { d: { ServerRelativeUrl, Files: { results: fileResults }, Folders: { results: folderResults } } } = results;

    // Generate breadcrumbs
    const crumbs = ServerRelativeUrl.substring(ServerRelativeUrl.indexOf(site) + site.length + 1).split('/');

    // Process files with filtering
    const filesBeforeFilter = fileResults.map(f => {
      return {
        fileId: f.Id,
        name: f.Name,
        relativeUrl: f.ServerRelativeUrl,
        created: f.TimeCreated,
        modified: f.TimeLastModified,
        uniqueId: f.UniqueId
      }
    });

    const files = filesBeforeFilter.filter(file => {
      const parts = file.name.split('.');
      const fileExtension = parts.length > 1 ? parts[parts.length - 1] : '';
      const isSupported = !!supportedFileExtensions.find(ext => ext === fileExtension);
      return isSupported;
    });

    // Process folders
    const folders = folderResults.map(f => {
      return {
        folderId: f.Id,
        name: f.Name,
        uniqueId: f.UniqueId
      };
    });

    // Prepare final response
    const responseData = { crumbs, files, folders };
    const endTime = Date.now();
    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    const endTime = Date.now();

    console.error(`❌ [SharePoint-Folder-Route] Request failed:`, {
      requestId,
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
      errorCode: error.code,
      statusCode: error.statusCode
    });

    console.error(`🔍 [SharePoint-Folder-Route] Error context:`, {
      requestId,
      url: req.url,
      method: req.method,
      searchParams: req.nextUrl.searchParams ? Object.fromEntries(req.nextUrl.searchParams.entries()) : null
    });

    // Determine appropriate error status code
    let errorStatus = 500;
    if (error.statusCode) {
      errorStatus = error.statusCode;
    } else if (error.code === 'InvalidAuthenticationToken') {
      errorStatus = 401;
    } else if (error.message?.includes('not found') || error.message?.includes('404')) {
      errorStatus = 404;
    }

    console.error(`📤 [SharePoint-Folder-Route] Sending error response:`, {
      requestId,
      status: errorStatus,
      errorMessage: error.message
    });

    return NextResponse.json({
      error: error.message,
      requestId,
      timestamp: new Date().toISOString()
    }, { status: errorStatus });
  }
}