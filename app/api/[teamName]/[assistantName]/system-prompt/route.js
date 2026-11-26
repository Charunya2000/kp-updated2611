import {
  getAllSystemPrompts,
} from '@/app/services/systemPromptService';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { teamName, assistantName } = await params;
  const systemPrompts = await getAllSystemPrompts(teamName, assistantName);
  return NextResponse.json(systemPrompts, { status: 200 });
}
