'use server';

import { NextResponse } from 'next/server';

export async function POST(req) {
  let resultStatus = null;
  try {
    let json = await req.json();
    //json.response = json.response.replaceAll('<br>', '\n');

    const ORCHESTRATION_APP_URL = process.env['ORCHESTRATION_APP_URL'];
    const result = await fetch(`${ORCHESTRATION_APP_URL}/api/dmss/download-excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ response: json.response, sheet_name: json.sheetName || 'Sheet1' }),
    });

    if (!result.ok) {
      resultStatus = result.status;
      const text = await result.text();
      throw new Error(`Export failed with status: ${result.status}, message: ${text}`);
    }

    const blob = await result.blob();

    // Create a new Response with the blob
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="export.xlsx"'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: resultStatus || 500 });
  }
}
