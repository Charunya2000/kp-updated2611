import {
  updateSearchIndex,
  deleteSearchIndex,
  getAllSearchIndexes,
  getIndexConfigById
} from '@/app/services/aiSearchConfigService';
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const PUT = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(deleteHandler);

async function putHandler(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;
    const indexData = await req.json();

    const indexById = await getIndexConfigById(id, teamName);
    if (!indexById) {
      return NextResponse.json({ error: 'Search index not found' }, { status: 404 });
    }

    const indexConfigurations = await getAllSearchIndexes(teamName, assistantName);

    // Check for duplicate names
    const existingIndexName = indexConfigurations.find(index => index.name === indexData.name && index.id !== id);
    if (existingIndexName) {
      return NextResponse.json({ error: 'A search index with this name already exists.' }, { status: 409 });
    }

    // Check for duplicate configurations of the same index
    const existingIndexConfigs = indexConfigurations.filter(index => index.indexName === indexData.indexName && index.id !== id);
    if (existingIndexConfigs.length > 0) {
      return NextResponse.json({ error: `An index configuration for ${indexData.indexName} already exists.` }, { status: 409 });
    }

    const updated = await updateSearchIndex(id, indexData, teamName);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('Error updating search index:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;

    const deleted = await deleteSearchIndex(id, teamName);
    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    console.error('Error deleting search index:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}