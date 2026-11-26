import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { getValidatedIncidents } from "@/app/bcs/admin/update-incident-data/services/searchIndexDataUploadService";
import { PERMISSIONS } from "@/app/config/permissions";

export const POST = withTeamPermissionGuard(PERMISSIONS.BCS_INCIDENT_INDEX_MANAGE)(postHandler);

// TODO: move to a non-parameterized route
async function postHandler(req, { params }) {
  try {
    const { teamName, name } = await params;
    const { fileContent, requiredFields } = await req.json();

    // Validate that we have the required data
    if (!fileContent || !requiredFields) {
      return NextResponse.json(
        { error: 'Missing required fields: fileContent and requiredFields' },
        { status: 400 }
      );
    }

    const validationResults = await getValidatedIncidents(fileContent, requiredFields);

    return NextResponse.json(validationResults, { status: 200 });
  } catch (error) {
    console.error('Error validating incidents:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}