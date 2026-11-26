import { getAllTeamsWithOwners } from "@/app/services/teamService";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const teams = await getAllTeamsWithOwners();

    return NextResponse.json(teams, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
