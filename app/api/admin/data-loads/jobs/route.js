import { NextResponse } from 'next/server';
import { withAppAdminGuard } from '@/app/api/guards';
import { getAllAppJobsByType } from '@/app/services/backgroundJobService';
import { AI_SEARCH_DATA_LOAD_JOB_TYPE } from '@/app/services/aiSearchDataLoadService';
import { MONGO_DATA_LOAD_JOB_TYPE } from '@/app/services/mongoDataLoadService';
import { jobStatus } from '@/utils/constants';

export const GET = await withAppAdminGuard(getHandler);

async function getHandler(request) {
  try {
    const [aiSearchJobs, mongoJobs] = await Promise.all([
      getAllAppJobsByType(AI_SEARCH_DATA_LOAD_JOB_TYPE),
      getAllAppJobsByType(MONGO_DATA_LOAD_JOB_TYPE),
    ]);

    // Filter to only return active jobs (those still being processed or indexed)
    const activeStatuses = [jobStatus.PROCESSING, jobStatus.INDEXING];

    const jobList = [
      ...(Array.isArray(aiSearchJobs) ? aiSearchJobs : aiSearchJobs ? [aiSearchJobs] : []),
      ...(Array.isArray(mongoJobs) ? mongoJobs : mongoJobs ? [mongoJobs] : []),
    ].filter(job => activeStatuses.includes(job.status));

    return NextResponse.json(jobList, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch jobs.' },
      { status: 500 }
    );
  }
}
