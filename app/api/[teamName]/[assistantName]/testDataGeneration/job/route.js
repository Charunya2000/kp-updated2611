import { getAllTestDataGenJobs, saveTestDataGenJob, updateTestDataGenJob } from "@/app/services/testDataGenerationApiService";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const jobs = await getAllTestDataGenJobs(teamName);
    return NextResponse.json(jobs, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const jobData = await req.json();
    const result = await saveTestDataGenJob(teamName, jobData);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const jobUpdate = await req.json();
    const result = await updateTestDataGenJob(teamName, jobUpdate);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}