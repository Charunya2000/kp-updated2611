import { getAccessibleSharePointSites } from "@/app/services/sharePointService";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await getAccessibleSharePointSites();
    const sites = response.map(site => ({ name: site.name, id: site.id, roleIds: site.roleIds }));

    return NextResponse.json(sites, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}