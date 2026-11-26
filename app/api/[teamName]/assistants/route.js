import { getAllAssistants } from "@/app/services/assistantService";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  try {
    const { teamName } = await params;
    const assistants = await getAllAssistants(teamName);
    return NextResponse.json(assistants, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}