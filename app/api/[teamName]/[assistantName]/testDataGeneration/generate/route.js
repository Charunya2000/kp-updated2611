import { generateTestData } from "@/app/services/testDataGenerationApiService";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const requestData = await req.formData();

    if (!requestData.get("issue")) {
      return NextResponse.json({ error: "Missing required property 'issue'" }, { status: 400 });
    }

    // call tdg service to start processing
    const response = await generateTestData(requestData);

    return NextResponse.json({ response }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}