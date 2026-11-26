'use server';

import { NextResponse } from 'next/server';
// import { findGeisingerComparisonsByInferredLobAndStatus, prepareSharePointPdfsForComparison } from '@/app/services/langgraphs/compliance/docConveresationService2';
import { findGeisingerComparisonsByInferredLobAndStatus, prepareSharePointPdfsForComparison } from '@/app/services/langgraphs/compliance/docConversationService3.js';

export async function POST(req) {
  try {
    const body = await req.json();

    // meta is optional, can be undefined or empty
    const result = await prepareSharePointPdfsForComparison(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    // Extract inferredLob from query params if provided
    const { searchParams } = new URL(req.url);
    const inferredLob = searchParams.get('inferredLob');
    const status = searchParams.get('status');
    if (!inferredLob || !status) {
      return NextResponse.json({ error: 'Missing required query parameters: inferredLob and status' }, { status: 400 });
    }
    const result = await findGeisingerComparisonsByInferredLobAndStatus(inferredLob, status);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
