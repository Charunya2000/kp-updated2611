import {
  getAllSearchIndexes,
  createSearchIndex,
  getSearchIndexByName,
} from '@/app/services/aiSearchConfigService';
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(getHandler);
export const POST = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(postHandler);

async function getHandler(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const indexes = await getAllSearchIndexes(teamName, assistantName);
    return NextResponse.json(indexes, { status: 200 });
  } catch (error) {
    console.error('Error fetching search indexes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function postHandler(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const indexData = await req.json();

    const indexConfigurations = await getAllSearchIndexes(teamName, assistantName);

    // Check for duplicate names
    const existingIndexName = indexConfigurations.find(index => index.name === indexData.name);
    if (existingIndexName) {
      return NextResponse.json({ error: 'A search index with this name already exists.' }, { status: 409 });
    }

    // // Check for duplicate configurations of the same index
    // const existingIndexConfig = indexConfigurations.find(index => index.indexName === indexData.indexName);
    // if (existingIndexConfig) {
    //   return NextResponse.json({ error: `An index configuration for ${indexData.indexName} already exists.` }, { status: 409 });
    // }

    const created = await createSearchIndex(indexData, teamName, assistantName);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating search index:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
