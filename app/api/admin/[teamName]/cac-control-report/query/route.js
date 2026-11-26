import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { prepDocument } from "@/app/clientServices/insertDocument";
import { createCompareQuery, deleteCompareQuery, selectCompareQuery, updateCompareQuery } from "@/app/services/cacQueryService";
import { PERMISSIONS } from "@/app/config/permissions";

export const GET = withTeamPermissionGuard(PERMISSIONS.CAC_REPORTS_ACCESS)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.CAC_REPORTS_ACCESS)(putHandler);
export const POST = withTeamPermissionGuard(PERMISSIONS.CAC_REPORTS_ACCESS)(postHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.CAC_REPORTS_ACCESS)(deleteHandler);

async function getHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    const dataset = searchParams.get('dataset');
    const entity = searchParams.get('entity');

    if (!dataset || !entity) {
      return NextResponse.json({ error: "Missing parameter" }, { status: 400 });
    }

    const query = {
      type: 'DB Compare Query',
      dataset: dataset,
      entity: entity
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
    const { query, id } = await req.json();

    if (!id || !query) {
      return NextResponse.json({ error: "Missing parameter" }, { status: 400 });
    }

    const document = {
      type: 'DB Compare Query',
      query: query,
      id: id,
    }

    const dbQuery = {
      type: 'DB Compare Query',
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
    const { dataset, entity } = await req.json();

    if (!dataset || !entity) {
      return NextResponse.json({ error: "Missing env parameter" }, { status: 400 });
    }

    const document = prepDocument({
      type: 'DB Compare Query',
      entity: entity,
      dataset: dataset,
      query: '',
      env: process.env.envName
    });

    const result = await createCompareQuery(document, teamName);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing env parameter" }, { status: 400 });
    }

    const query = {
      type: 'DB Compare Query',
      id: id
    }

    await deleteCompareQuery(query, teamName);

    return NextResponse.json({ message: "Document deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}