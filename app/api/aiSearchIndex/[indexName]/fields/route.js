import { getIndexMetadata } from '@/app/services/aiSearchIndexService';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  try {
    const { indexName } = await params;

    if (!indexName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const metadata = await getIndexMetadata(indexName);

    if (!metadata) {
      return NextResponse.json({ error: `No metadata found for ${indexName}` }, { status: 404 });
    }

    if (!metadata.fields || metadata.fields.length === 0) {
      return NextResponse.json({ error: `No fields found for index ${indexName}` }, { status: 404 });
    }

    const fields = metadata.fields.filter(field => !field.hidden).map(field => field.name);
    return NextResponse.json({ fields }, { status: 200 });
  } catch (error) {
    console.error(`Error fetching index metadata:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch index metadata' },
      { status: 500 }
    );
  }
}