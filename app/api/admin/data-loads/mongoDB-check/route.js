import { NextResponse } from 'next/server';
import { withAppAdminGuard } from '@/app/api/guards';
import { checkMongoCollectionExists } from '@/app/services/mongoDataLoadService';
import { listDatabaseNames, listCollectionNames } from '@/db/connection';

export const GET = await withAppAdminGuard(getHandler);
export const POST = await withAppAdminGuard(postHandler);

async function getHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dbName = searchParams.get('dbName');

    // If dbName is provided, return collections for that database
    if (dbName) {
      const collections = await listCollectionNames(dbName);
      return NextResponse.json({ collections }, { status: 200 });
    }

    // Otherwise return all database names
    const databases = await listDatabaseNames();
    return NextResponse.json({ databases }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'mongoCheckGet',
        detail: { error: error.message },
      },
    }));
    return NextResponse.json({ error: error.message || 'Failed to fetch Mongo metadata.' }, { status: 500 });
  }
}

async function postHandler(request) {
  try {
    const { dbName, collectionName } = await request.json();

    if (!dbName || !collectionName) {
      return NextResponse.json(
        { error: 'dbName and collectionName are required.' },
        { status: 400 }
      );
    }

    const result = await checkMongoCollectionExists({ dbName, collectionName });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to check collection.' },
      { status: 500 }
    );
  }
}
