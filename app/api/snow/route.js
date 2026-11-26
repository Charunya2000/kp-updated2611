import { getIncidentData, createIncident } from "@/app/services/serviceNowApiService";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ticketNo = searchParams.get('ticketNo');

    if (!ticketNo) {
      return NextResponse.json({ error: 'Ticket number is required' }, { status: 400 });
    }

    const details = await getIncidentData(ticketNo);

    return NextResponse.json(details, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const createdIncident = await createIncident(body);

    return NextResponse.json(createdIncident, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
