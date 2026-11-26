import { summarizePOM } from "@/app/services/parsePomFile";
import { NextResponse } from "next/server";


export async function POST(req) {
  try {
    const {javaContent} = await req.json();
    
    const result = await summarizePOM();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Parsing failed" },
      { status: 500 }
    );
  }
}