import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { uploadIncidentsToIndex } from "@/app/bcs/admin/update-incident-data/services/searchIndexDataUploadService";
import { createJob, updateJob } from "@/app/services/backgroundJobService";
import { jobStatus } from '@/utils/constants';
import { PERMISSIONS } from "@/app/config/permissions";

export const POST = withTeamPermissionGuard(PERMISSIONS.BCS_INCIDENT_INDEX_MANAGE)(postHandler);


// TODO: This handler is too specific to the incidents index, and should be moved to a non-parameterized route.
async function postHandler(req, { params }) {
  try {
    const { teamName, name } = await params;
    const { incidents } = await req.json();

    // Validate that we have incidents data
    if (!incidents || !Array.isArray(incidents) || incidents.length === 0) {
      return NextResponse.json(
        { error: 'No valid incidents provided for upload' },
        { status: 400 }
      );
    }

    // create upload job
    const job = await createJob(teamName, 'IncidentUpload', {
      indexName: name,
      status: jobStatus.PROCESSING,
      current: 0,
      total: incidents.length
    })

    // Call the server-side upload function
    uploadIncidentsToIndex(incidents, teamName, job.id)
      .then(_ => {
        updateJob(teamName, job.id, {
          status: jobStatus.COMPLETE,
        });
      })
      .catch(err => {
        updateJob(teamName, job.id, {
          status: jobStatus.ERROR,
          error: err.message,
        });
      });


    return NextResponse.json(
      {
        success: true,
        message: `Successfully started uploading ${incidents.length} incidents to ${name} index`,
        job: job
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error uploading incidents to index:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}