import { NextResponse } from 'next/server';
import { withAppAdminGuard } from '@/app/api/guards';
import { checkAiSearchIndexHasDocuments } from '@/app/services/aiSearchDataLoadService';

export const POST = await withAppAdminGuard(postHandler);

async function postHandler(request) {
  try {
    const { indexName } = await request.json();

    if (!indexName) {
      return NextResponse.json(
        { error: 'indexName is required.' },
        { status: 400 }
      );
    }

    const result = await checkAiSearchIndexHasDocuments(indexName);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to check index.' },
      { status: 500 }
    );
  }
}
