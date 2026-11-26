import { NextResponse } from 'next/server';
import { getAllTags, createTag } from '@/app/ets/admin/update-ets-index-data/services/etsIndexTagService';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.ETS_INDEX_MANAGE, { teamName: 'ets' })(getHandler);
export const POST = withTeamPermissionGuard(PERMISSIONS.ETS_INDEX_MANAGE, { teamName: 'ets' })(postHandler);

async function getHandler(req, { params }) {
  try {
    const tags = await getAllTags('ets');
    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}

async function postHandler(req, { params }) {
  try {
    const { tagName } = await req.json();

    if (!tagName) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      );
    }

    // Check for duplicate tag names
    const existingTags = await getAllTags('ets');
    const isDuplicate = existingTags.some(tag => tag.tag === tagName);

    if (isDuplicate) {
      return NextResponse.json(
        { error: 'Tag name already exists' },
        { status: 409 }
      );
    }

    const result = await createTag('ets', tagName);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create tag' },
      { status: 500 }
    );
  }
}
