import { NextResponse } from "next/server";
import { getIndexConfigByAssistantId } from "@/app/services/aiSearchConfigService";
import { getAssistantByName } from "@/app/services/assistantService";

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName } = await params;

    const assistant = await getAssistantByName(teamName, assistantName, {});
    if (!assistant) {
      return NextResponse.json({ error: "Assistant not found" }, { status: 404 });
    }

    const indexes = await getIndexConfigByAssistantId(teamName, assistant);

    return NextResponse.json(indexes, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}