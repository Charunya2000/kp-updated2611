import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { selectCompareQuery, updateCompareQuery } from "@/app/services/insight360QueryService";
import { prepDocument } from "@/app/clientServices/insertDocument";
import { PERMISSIONS } from "@/app/config/permissions";

export const GET = withTeamPermissionGuard(PERMISSIONS.INSIGHT360_QUERIES_MANAGE)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.INSIGHT360_QUERIES_MANAGE)(putHandler);
export const POST = withTeamPermissionGuard(PERMISSIONS.INSIGHT360_QUERIES_MANAGE)(postHandler);


async function getHandler(req, { params }) {
  try {
    const { teamName } = await params;

    if (teamName !== 'kpif-ma') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    const name = searchParams.get('name');

    let query = {
      type: 'SQLQuery',
    }
    if (name) {
      query.name = name;
    }
    let document = await selectCompareQuery(query, teamName);

    if (!document) {
      return NextResponse.json({ error: "No document found" }, { status: 404 });
    }

    return NextResponse.json(document, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(req, { params }) {
  try {
    const { teamName } = await params;

    if (teamName !== 'kpif-ma') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { query, id } = await req.json();

    if (!id || !query) {
      return NextResponse.json({ error: "Missing parameter" }, { status: 400 });
    }

    const document = {
      type: 'SQLQuery',
      query: query,
      id: id,
    }

    const dbQuery = {
      type: 'SQLQuery',
      id: id
    }

    const result = await updateCompareQuery(document, dbQuery, teamName);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function postHandler(req, { params }) {
  try {
    const { teamName } = await params;
    if (teamName !== 'kpif-ma') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { name, query } = await req.json();

    if (!name || !query) {
      return NextResponse.json({ error: "Missing parameter" }, { status: 400 });
    }

    const document = prepDocument({
      type: 'SQLQuery',
      query: query,
      name: name
    });

    const result = await createCompareQuery(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
