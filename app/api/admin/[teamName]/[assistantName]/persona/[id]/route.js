import {
  updatePersona,
  deletePersona,
  getPersonaByName,
  getPersonaById,
} from '@/app/services/personaService';
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const PUT = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(deleteHandler);

async function putHandler(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;
    const personaData = await req.json();

    const personaById = await getPersonaById(id, teamName);
    if (!personaById) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    const existingPersona = await getPersonaByName(personaData.name, teamName, assistantName);
    if (existingPersona && existingPersona.id !== id) {
      return NextResponse.json({ error: 'A persona with this name already exists for this assistant.' }, { status: 409 });
    }

    const updated = await updatePersona(personaData, teamName, assistantName);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('Error updating persona:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;

    const query = { type: 'Persona', teamName, assistantName, id };
    const deleted = await deletePersona(query, teamName, assistantName);
    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    console.error('Error deleting persona:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
