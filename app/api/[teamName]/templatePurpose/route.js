import { getAllTemplatePurposes } from "@/app/services/templatePurposeService";
import { NextResponse } from "next/server";

export async function GET() {
  try {

    const collections = await getAllTemplatePurposes();

    return NextResponse.json(collections, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}