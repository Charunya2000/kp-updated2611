import { getTeamMemberTeamsListWithRoles } from "@services/teamMemberService";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const teams = await getTeamMemberTeamsListWithRoles();

    return NextResponse.json(teams, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}