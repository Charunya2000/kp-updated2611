'use server';

import { NextResponse } from 'next/server';
import { callWorkflowService2 } from '@services/conversationService';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const result = await callWorkflowService2(formData);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calling workflow service:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}