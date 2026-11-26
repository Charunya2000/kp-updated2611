import { getDocumentLibraries as getDocumentLibrariesGraph } from "@/app/services/sharePointGraphRestAPIService";
import { getDocumentLibraries } from "@/app/services/sharePointRestAPIService";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const site = req.nextUrl.searchParams.get('site');
    const useEnvSwitch = req.nextUrl.searchParams.get('useEnvSwitch') === 'true';
    const useGraph = useEnvSwitch ? process.env.USE_VAULT === 'true' : true;

    if (!site) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const documentLibraries = useGraph ? await getDocumentLibrariesGraph(site) : await getDocumentLibraries(site);

    return NextResponse.json(documentLibraries, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}