import { getFolderByServerRelativeUrl } from "@/app/services/sharePointRestAPIService";
import { NextResponse } from "next/server";
import { supportedFileExtensions } from "@/utils/constants";

export async function GET(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const folder = searchParams.get('folder');
    const site = searchParams.get('site');

    if (!site || !folder) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const results = await getFolderByServerRelativeUrl(site, folder);
    const { d: { ServerRelativeUrl, Files: { results: fileResults }, Folders: { results: folderResults } } } = results;

    const crumbs = ServerRelativeUrl.substring(ServerRelativeUrl.indexOf(site) + site.length + 1).split('/');
    const files = fileResults.map(f => {
      return {
        name: f.Name,
        relativeUrl: f.ServerRelativeUrl,
        created: f.TimeCreated,
        modified: f.TimeLastModified,
        uniqueId: f.UniqueId
      }
    }).filter(file => {
      const parts = file.name.split('.');
      const fileExtension = parts.length > 1 ? parts[parts.length - 1] : '';
      return !!supportedFileExtensions.find(ext => ext === fileExtension);
    });
    const folders = folderResults.map(f => {
      return {
        name: f.Name,
        uniqueId: f.UniqueId
      };
    })

    return NextResponse.json({ crumbs, files, folders }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}