import { getTestDataGenerationStatus } from "@/app/services/testDataGenerationApiService";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  try {
    const { taskId } = await params;

    // Validate taskId
    if (!taskId) {
      return NextResponse.json({ error: "missing required field taskId" }, { status: 400 });
    }

    const response = await getTestDataGenerationStatus(taskId);

    if (response?.file_path && !response.file_path.startsWith('http')) {
      const envName = process.env['envName'];
      const backendBaseUrl = (process.env.ORCHESTRATION_APP_URL).replace(/\/+$/, '');
      const normalizedPath = response.file_path.startsWith('/') ? response.file_path : `/${response.file_path}`;
      response.file_path = `${backendBaseUrl}${normalizedPath}`;
    }

    return NextResponse.json({ response }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}