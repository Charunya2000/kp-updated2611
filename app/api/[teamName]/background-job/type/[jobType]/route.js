import { NextResponse } from 'next/server';
import { getJobByJobType } from '@/app/services/backgroundJobService';
import { getServerSession } from '@utils/getSession';

export async function GET(req, { params }) {
  try {
    const { teamName, jobType } = await params;
    const { nuid } = await getServerSession();

    const job = await getJobByJobType(teamName, jobType);

    // Jobs without an owner (e.g. CloneSmartNote) remain readable by the team
    if (!job || (job.nuid && job.nuid !== nuid)) {
      return NextResponse.json({ error: 'BackgroundJob not found' }, { status: 404 });
    }

    return NextResponse.json(job, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
