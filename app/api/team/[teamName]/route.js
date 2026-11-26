import { NextResponse } from "next/server";
import { getTeamByName } from "@/app/services/teamService";

export async function GET(request, { params }) {
  try {
    const { teamName } = await params;
    const team = await getTeamByName(teamName);

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json(team, { status: 200 });
  } catch (error) {
    console.error('Error getting team:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
