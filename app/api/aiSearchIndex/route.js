import { listAllIndexNames } from '@/app/services/aiSearchIndexService';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const indexes = await listAllIndexNames();

    if (!indexes) {
      return NextResponse.json({ error: 'No indexes found' }, { status: 404 });
    }

    return NextResponse.json({ indexes }, { status: 200 });
  } catch (error) {
    console.error('Error fetching AI Search indexes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI Search indexes' },
      { status: 500 }
    );
  }
}