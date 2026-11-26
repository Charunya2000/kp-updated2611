'use server';

import { NextResponse } from 'next/server';
import { callProductsWorkflowService } from '@services/conversationService';

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName } = await params;

    const formData = await req.formData();
    const result = await callProductsWorkflowService(formData, teamName);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calling workflow service:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}