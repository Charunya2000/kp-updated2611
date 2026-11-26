import { NextResponse } from "next/server";
import { selectCacControlReport } from "@/app/services/cacControlReportService";

export async function POST(req, { params }) {
  try {
    const query = await req.json();
    const { teamName, assistantName } = await params;

    let { lastRunDate, downloadUrl, processingTime, isProcessing } = await selectCacControlReport(teamName, query); // TODO: use projection for this data

    return NextResponse.json({ lastRunDate, downloadUrl, processingTime, isProcessing }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}