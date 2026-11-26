import { NextResponse } from 'next/server';
import { isAppAdmin } from '@/app/services/applicationRoleService';
import { getAllGlobalRoleTemplates, createRoleTemplate } from '@/app/services/roleTemplateService';

export async function GET() {
  const admin = await isAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const templates = await getAllGlobalRoleTemplates();
    return NextResponse.json(templates, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'getAllGlobalRoleTemplates', detail: { error: error.message } } }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const admin = await isAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, label, description, permissions, isSystem, color } = body;

    if (!name || !label) {
      return NextResponse.json({ error: 'name and label are required' }, { status: 400 });
    }

    const result = await createRoleTemplate({ name, label, description, permissions, isSystem, color });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'createRoleTemplate', detail: { error: error.message } } }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
