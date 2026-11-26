import { getAllTemplateDocuments } from "@/app/services/templateDocumentService";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const templates = await getAllTemplateDocuments();

    return NextResponse.json(templates, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}