import {
  createPersona,
  getPersonaByName,
} from '@/app/services/personaService';
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const POST = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(postHandler);

async function postHandler(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const personaData = await req.json();

    const existingPersona = await getPersonaByName(personaData.name, teamName, assistantName);
    if (existingPersona) {
      return NextResponse.json({ error: 'A persona with this name already exists.' }, { status: 409 });
    }

    const created = await createPersona(personaData, teamName, assistantName);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating persona:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
