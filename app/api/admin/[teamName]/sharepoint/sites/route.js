import { createSharePointSite, getAllSharePointSites, updateSharePointSite, deleteSharePointSite } from "@/app/services/sharePointService";
import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { PERMISSIONS } from "@/app/config/permissions";

export const GET = withTeamPermissionGuard(PERMISSIONS.SHAREPOINT_SITES_MANAGE)(getHandler);
export const POST = withTeamPermissionGuard(PERMISSIONS.SHAREPOINT_SITES_MANAGE)(postHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.SHAREPOINT_SITES_MANAGE)(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.SHAREPOINT_SITES_MANAGE)(deleteHandler);

async function getHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const response = await getAllSharePointSites(teamName);
    const sites = response.map(site => ({ name: site.name, id: site.id, assistantIds: site.assistantIds }));

    return NextResponse.json(sites, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function postHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const site = await req.json();
    const result = await createSharePointSite(site, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const site = await req.json();
    const result = await updateSharePointSite(site, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const site = await req.json();
    const result = await deleteSharePointSite(site, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}