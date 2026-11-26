import { NextResponse } from 'next/server';
import { retrieveDesignReferenceFilesFromSearch } from '@services/designReferenceService';

export async function GET(_) {
  try {
    const cachedDesignDocs = await retrieveDesignReferenceFilesFromSearch();
    return NextResponse.json(cachedDesignDocs, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
