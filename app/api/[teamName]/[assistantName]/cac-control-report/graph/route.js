import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req, res) {
  try {

    const htmlContent = fs.readFileSync(path.join(process.cwd(), 'app', 'cac-control-report', 'results', 'fig.html'), 'utf8');

    const response = new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}