'use server';

import { insertGeisingerConfigContextDocument, selectGeisingerConfigContextDocuments } from '@/app/services/geisingerConfigService.js';
import { withTeamPermissionGuard } from "@/app/api/guards";
import { PERMISSIONS } from '@/app/config/permissions';
import { NextResponse } from 'next/server';

export const GET = withTeamPermissionGuard(PERMISSIONS.REGULATORY_CONFIG_MANAGE)(getHandler);
export const POST = withTeamPermissionGuard(PERMISSIONS.REGULATORY_CONFIG_MANAGE)(postHandler);


function toHttpStatus(error) {
  return error?.message?.startsWith('Invalid GeisingerConfig object') ? 400 : 500;
}

async function postHandler(req) {
  try {
    const body = await req.json();
    const result = await insertGeisingerConfigContextDocument(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: toHttpStatus(error) });
  }
}

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const paramsObj = {};
    for (const [key, value] of searchParams.entries()) {
      paramsObj[key] = value;
    }
    const { data } = await selectGeisingerConfigContextDocuments(paramsObj);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: toHttpStatus(error) });
  }
}

