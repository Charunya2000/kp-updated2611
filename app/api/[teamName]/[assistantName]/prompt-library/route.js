import { getAllPrompts } from '@/app/services/promptLibraryService';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { teamName, assistantName } = await params;
  const prompts = await getAllPrompts(teamName, assistantName);
  return NextResponse.json(prompts, { status: 200 });
}

