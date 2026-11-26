'use server';

import { selectGeisingerConfigContextDocumentById, updateGeisingerConfigContextDocumentById, deleteGeisingerConfigContextDocumentById } from '@/app/services/geisingerConfigService.js';
import { withTeamPermissionGuard } from "@/app/api/guards";
import { PERMISSIONS } from '@/app/config/permissions';
import { NextResponse } from 'next/server';

export const GET = withTeamPermissionGuard(PERMISSIONS.REGULATORY_CONFIG_MANAGE)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.REGULATORY_CONFIG_MANAGE)(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.REGULATORY_CONFIG_MANAGE)(deleteHandler);

function toHttpStatus(error) {
  return error?.message?.startsWith('Invalid GeisingerConfig object') ? 400 : 500;
}

async function getHandler(req, { params }) {
  try {
    const { geisingerConfigId } = await params;
    const result = await selectGeisingerConfigContextDocumentById(geisingerConfigId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: toHttpStatus(error) });
  }
}

async function putHandler(req, { params }) {
  try {
    const { geisingerConfigId } = await params;
    const body = await req.json();
    const result = await updateGeisingerConfigContextDocumentById(geisingerConfigId, body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: toHttpStatus(error) });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { geisingerConfigId } = await params;
    const result = await deleteGeisingerConfigContextDocumentById(geisingerConfigId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: toHttpStatus(error) });
  }
}
