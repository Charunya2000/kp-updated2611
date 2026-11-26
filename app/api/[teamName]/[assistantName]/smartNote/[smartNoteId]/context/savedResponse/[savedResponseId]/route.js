'use server';

import { NextResponse } from 'next/server';
import { deleteSavedResponse } from '@services/addSavedResponseToIndex';

export async function DELETE(_, { params }) {
  try {
    const { savedResponseId } = await params;
    await deleteSavedResponse(savedResponseId);
    const response = { result: 'deleted' };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
