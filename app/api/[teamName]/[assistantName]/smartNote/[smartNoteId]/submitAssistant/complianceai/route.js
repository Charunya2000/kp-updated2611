'use server';

import { NextResponse } from 'next/server';
import { getServerSession } from '@utils/getSession';
import { complianceGraph } from '@/app/services/langgraphs/compliance/complianceService.js';

export async function POST(req, { params }) {
  try {
    const request = await req.json();
    const { nuid } = await getServerSession();
    const result = await complianceGraph(nuid, request);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}