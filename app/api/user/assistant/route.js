import { getUserAssistantsByNUID } from "@/app/services/userAssistantService";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await getUserAssistantsByNUID();

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}