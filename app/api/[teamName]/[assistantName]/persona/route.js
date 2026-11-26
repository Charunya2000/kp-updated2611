import {
  getAllPersonas,
} from '@/app/services/personaService';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { teamName, assistantName } = await params;
  const personaData = await getAllPersonas(teamName, assistantName);
  return NextResponse.json(personaData, { status: 200 });
}
