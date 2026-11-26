'use server';

import { NextResponse } from 'next/server';
import { deleteDocument } from '@services/insertVectorDataService';

export async function DELETE(_, { params }) {
  try {
    const { websiteURLId } = await params;
    await deleteDocument(websiteURLId);
    const response = { result: 'deleted' };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
