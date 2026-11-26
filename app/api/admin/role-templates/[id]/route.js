import { NextResponse } from 'next/server';
import { isAppAdmin } from '@/app/services/applicationRoleService';
import { getRoleTemplateById, updateRoleTemplate, deleteRoleTemplate } from '@/app/services/roleTemplateService';

export async function GET(request, { params }) {
  const admin = await isAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const template = await getRoleTemplateById(id);
    if (!template) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'getRoleTemplateById', detail: { error: error.message } } }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const admin = await isAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { label, description, permissions, color } = body;

    if (!label) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }

    const result = await updateRoleTemplate({ id, label, description, permissions, color });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'updateRoleTemplate', detail: { error: error.message } } }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const admin = await isAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const result = await deleteRoleTemplate(id);
    return NextResponse.json({ success: result }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'deleteRoleTemplate', detail: { error: error.message } } }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
