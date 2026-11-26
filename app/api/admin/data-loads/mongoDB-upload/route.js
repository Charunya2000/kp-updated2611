import { NextResponse } from 'next/server';
import { withAppAdminGuard } from '@/app/api/guards';
import {
  createMongoDataLoadJob,
  uploadBsonlToMongoCollection,
} from '@/app/services/mongoDataLoadService';
import { updateAppJob } from '@/app/services/backgroundJobService';
import { jobStatus } from '@/utils/constants';

export const POST = await withAppAdminGuard(postHandler);

async function postHandler(request) {
  let job = null;

  try {
    const {
      containerName,
      blobName,
      dbName,
      collectionName,
      overwrite,
    } = await request.json();

    if (!containerName || !blobName || !dbName || !collectionName) {
      return NextResponse.json(
        { error: 'containerName, blobName, dbName, and collectionName are required.' },
        { status: 400 }
      );
    }

    job = await createMongoDataLoadJob({
      containerName,
      blobName,
      dbName,
      collectionName,
      total: 0,
    });

    if (!job?.id) {
      throw new Error('Failed to create background job.');
    }

    uploadBsonlToMongoCollection({
      jobId: job.id,
      containerName,
      blobName,
      dbName,
      collectionName,
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
        message: `Started Mongo upload for ${blobName}`,
        job,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to start Mongo upload.' },
      { status: 400 }
    );
  }
}
