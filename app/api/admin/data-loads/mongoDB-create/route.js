import { NextResponse } from 'next/server';
import { withAppAdminGuard } from '@/app/api/guards';
import { createMongoCollection, validateMongoNames } from '@/app/services/mongoDataLoadService';

export const POST = await withAppAdminGuard(postHandler);

async function postHandler(request) {
  let dbName;
  let collectionName;

  try {
    const body = await request.json().catch(() => ({}));
    dbName = typeof body.dbName === 'string' ? body.dbName.trim() : body.dbName;
    collectionName = typeof body.collectionName === 'string' ? body.collectionName.trim() : body.collectionName;

    const validationError = validateMongoNames({ dbName, collectionName });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { created } = await createMongoCollection({ dbName, collectionName });

    if (!created) {
      return NextResponse.json(
        { error: `Collection ${dbName}.${collectionName} already exists.` },
        { status: 409 }
      );
    }

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'mongoCreateCollection',
        detail: { dbName, collectionName },
      },
    }));

    return NextResponse.json({ dbName, collectionName, created }, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'mongoCreateCollection',
        detail: { dbName, collectionName, error: error.message },
      },
    }));
    return NextResponse.json({ error: error.message || 'Failed to create collection.' }, { status: 500 });
  }
}
