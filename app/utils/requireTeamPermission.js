'use server';

import { forbidden } from 'next/navigation';
import { getServerSession } from '@/utils/getSession';
import { getTeamAccess } from '@/app/services/permissionsService';

/**
 * Server-only helper for Next.js server components / pages.
 * Checks that the current user has the required permission for the given team.
 * Calls forbidden() if the check fails.
 *
 * @param {string} teamName
 * @param {string} permission - Single permission key to require
 * @returns {Promise<object>} The access object on success
 */
export async function requireTeamPermission(teamName, permission) {
  const { nuid } = await getServerSession();
  const access = await getTeamAccess(teamName, nuid);

  if (!access.has(permission)) {
    forbidden();
  }

  return access;
}

/**
 * Server-only helper that checks that the current user has ANY of the listed permissions.
 * Calls forbidden() if the check fails.
 *
 * @param {string} teamName
 * @param {string[]} permissions - Array of permission keys (OR logic)
 * @returns {Promise<object>} The access object on success
 */
export async function requireAnyTeamPermission(teamName, permissions) {
  const { nuid } = await getServerSession();
  const access = await getTeamAccess(teamName, nuid);

  if (!access.hasAny(permissions)) {
    forbidden();
  }

  return access;
}
