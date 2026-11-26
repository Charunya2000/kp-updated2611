import { NextResponse } from 'next/server';
import { createGeisingerComparison } from '@services/langgraphs/compliance/complianceComparisonService2';

export async function POST(req, { params }) {
  try {
    const teamName = await params?.teamName;
    const body = await req.json();
    const result = await createGeisingerComparison(teamName, body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
