import { NextResponse } from 'next/server';
import { withAppAdminGuard } from '@/app/api/guards';
import {
  createAiSearchDataLoadJob,
  uploadJsonArrayToAiSearchIndex,
} from '@/app/services/aiSearchDataLoadService';
import { updateAppJob } from '@/app/services/backgroundJobService';
import { jobStatus } from '@/utils/constants';

export const POST = await withAppAdminGuard(postHandler);

async function postHandler(request) {
  let job = null;

  try {
    const { containerName, blobName, indexName, overwrite } = await request.json();

    if (!containerName || !blobName || !indexName) {
      return NextResponse.json(
        { error: 'containerName, blobName, and indexName are required.' },
        { status: 400 }
      );
    }

    job = await createAiSearchDataLoadJob({
      containerName,
      blobName,
      indexName,
      total: 0,
    });

    if (!job?.id) {
      throw new Error('Failed to create background job.');
    }

    uploadJsonArrayToAiSearchIndex({
      jobId: job.id,
      containerName,
      blobName,
      indexName,
      overwrite: !!overwrite,
    }).catch(async (error) => {
      const jobUpdate = {
        status: jobStatus.ERROR,
        current: error?.processedCount ?? job.current ?? 0,
        total: error?.total ?? error?.processedCount ?? job.total ?? 0,
        error: error.message,
      };

      if (error?.report) {
        jobUpdate.report = error.report;
      }

      await updateAppJob(job.id, jobUpdate);
    });

    return NextResponse.json(
      {
        success: true,
        message: `Started AI Search upload for ${blobName}`,
        job,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to start AI Search upload.' },
      { status: 400 }
    );
  }
}