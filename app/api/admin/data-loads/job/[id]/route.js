import { NextResponse } from 'next/server';
import { withAppAdminGuard } from '@/app/api/guards';
import { getAppJobById, updateAppJob } from '@/app/services/backgroundJobService';

export const GET = await withAppAdminGuard(getHandler);
export const PATCH = await withAppAdminGuard(patchHandler);

async function getHandler(request, { params }) {
  try {
    const { id } = await params;
    const job = await getAppJobById(id);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job status.' },
      { status: 500 }
    );
  }
}

async function patchHandler(request, { params }) {
  try {
    const { id } = await params;
    const existingJob = await getAppJobById(id);

    if (!existingJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const body = await request.json();
    const jobUpdate = {
      ...body,
      updatedAt: new Date().toISOString(),
    };

    const updated = await updateAppJob(id, jobUpdate);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update job.' }, { status: 500 });
    }

    const refreshedJob = await getAppJobById(id);
    return NextResponse.json(refreshedJob, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to update job.' },
      { status: 500 }
    );
  }
}