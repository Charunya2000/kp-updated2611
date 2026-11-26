import { NextResponse } from 'next/server';
import { getJobById, updateJob } from '@/app/services/backgroundJobService';
import { getServerSession } from '@utils/getSession';

export async function GET(req, { params }) {
  try {
    const { teamName, id } = await params;
    const { nuid } = await getServerSession();
    const job = await getJobById(teamName, id);

    // 404 rather than 403 so other users' job ids can't be probed
    if (!job || job.nuid !== nuid) {
      return NextResponse.json({ error: 'BackgroundJob not found' }, { status: 404 });
    }
    return NextResponse.json(job, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, id } = await params;

    const job = await getJobById(teamName, id);
    if (!job) {
      return NextResponse.json({ error: 'BackgroundJob not found' }, { status: 404 });
    }

    const { status } = await req.json();
    const updatedJob = await updateJob(teamName, job.id, { status });

    return NextResponse.json(updatedJob, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
