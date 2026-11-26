// GET Job Status

import { getJobById } from "@/app/services/backgroundJobService";
import { NextResponse } from "next/server";


export async function GET(req, { params }) {
  try {
    const { teamName, type, id } = await params;

    const job = await getJobById(teamName, id);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job, { status: 200 });
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}