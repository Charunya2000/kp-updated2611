import { NextResponse } from 'next/server';
import { getTagById, updateTag, deleteTag, getAllTags } from '@/app/ets/admin/update-ets-index-data/services/etsIndexTagService';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.ETS_INDEX_MANAGE, { teamName: 'ets' })(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.ETS_INDEX_MANAGE, { teamName: 'ets' })(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.ETS_INDEX_MANAGE, { teamName: 'ets' })(deleteHandler);

async function getHandler(req, { params }) {
  try {
    const { id } = await params;

    const tag = await getTagById('ets', id);
    return NextResponse.json(tag);
  } catch (error) {
    console.error('Error fetching tag:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tag' },
      { status: 500 }
    );
  }
}

async function putHandler(req, { params }) {
  try {
    const { id } = await params;

    const { tagName } = await req.json();

    if (!tagName) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      );
    }

    // Check for duplicate tag names (excluding the current tag being updated)
    const existingTags = await getAllTags('ets');
    const isDuplicate = existingTags.some(tag => tag.tag === tagName && tag.id !== id);

    if (isDuplicate) {
      return NextResponse.json(
        { error: 'Tag name already exists' },
        { status: 409 }
      );
    }

    const result = await updateTag('ets', id, tagName);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating tag:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update tag' },
      { status: 500 }
    );
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { id } = await params;

    const result = await deleteTag('ets', id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete tag' },
      { status: 500 }
    );
  }
}
