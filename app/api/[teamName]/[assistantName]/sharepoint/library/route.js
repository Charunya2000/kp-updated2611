import { getDocumentLibraries } from "@/app/services/sharePointRestAPIService";
import { NextResponse } from "next/server";

export async function GET(req) {
  try { 
    const site = req.nextUrl.searchParams.get('site');
    
    if (!site) {
      console.error(error);
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
        
    const documentLibraries = await getDocumentLibraries(site);

    return NextResponse.json(documentLibraries, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}