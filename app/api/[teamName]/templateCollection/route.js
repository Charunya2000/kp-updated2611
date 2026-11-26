import { getAllTemplateCollections } from "@/app/services/templateCollectionService";
import { NextResponse } from "next/server";

export async function GET() {
  try {

    const collections = await getAllTemplateCollections();

    return NextResponse.json(collections, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}