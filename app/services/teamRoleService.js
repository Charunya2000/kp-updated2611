'use server';

import { getServerSession, getCurrentUserNuid } from '@utils/getSession';
import { getTeamMember } from './teamMemberService';

export async function isTeamAdmin(teamName, nuid) {
  if (!nuid) {
    nuid = await getCurrentUserNuid();
  }
  nuid = nuid.toUpperCase();

  const teamMember = await getTeamMember(teamName, nuid);
  if (teamMember && teamMember.roles && (teamMember.roles.includes('admin') || teamMember.roles.includes('owner'))) {
    return true;
  }

  return false;
}

export async function isTeamOwner(teamName, nuid) {
  if (!nuid) {
    nuid = await getCurrentUserNuid();
  }
  nuid = nuid.toUpperCase();

  const teamMember = await getTeamMember(teamName, nuid);
  if (teamMember && teamMember.roles && teamMember.roles.includes('owner')) {
    return true;
  }

  return false;
}

export async function isEtsIndexManager(teamName = 'ets', nuid) {
  if (!nuid) {
    nuid = await getCurrentUserNuid();
  }
  nuid = nuid.toUpperCase();

  const teamMember = await getTeamMember(teamName, nuid);
  if (teamMember && teamMember.roles &&
    (teamMember.roles.includes('etsindexmanager') ||
      teamMember.roles.includes('admin') ||
      teamMember.roles.includes('owner'))) {
    return true;
  }

  return false;
}

export async function isInsight360Auditor(teamName = 'kpif-ma', nuid) {
  if (!nuid) {
    nuid = await getCurrentUserNuid();
  }
  nuid = nuid.toUpperCase();

  const teamMember = await getTeamMember(teamName, nuid);
  if (teamMember && teamMember.roles && teamMember.roles.includes('auditor')) {
    return true;
  }

  return false;
}