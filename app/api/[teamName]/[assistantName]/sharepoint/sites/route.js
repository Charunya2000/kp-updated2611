import { getAssistantByName } from "@/app/services/assistantService";
import { getAccessibleSharePointSites } from "@/app/services/sharePointService";
import { NextResponse } from "next/server";

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName } = await params;

    const assistant = await getAssistantByName(teamName, assistantName);
    if (!assistant) {
      return NextResponse.json({ error: `Assistant ${assistantName} not found in team ${teamName}` }, { status: 404 });
    }

    const response = await getAccessibleSharePointSites(teamName, assistant.id);
    const sites = response.map(site => ({ name: site.name, id: site.id, assistantIds: site.assistantIds }));

    return NextResponse.json(sites, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}