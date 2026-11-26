import { getTeamByName } from './teamService';
import { getTeamMember } from './teamMemberService';
import { getAllGlobalRoleTemplates } from './roleTemplateService';

/**
 * Resolve the effective permissions for a user in a team.
 *
 * Merges global RoleTemplate definitions with team-level overrides/additions,
 * expands the user's roles through those templates, then unions with direct grants.
 *
 * @param {string} teamName
 * @param {string} nuid
 * @param {object} [preloaded] - Optional pre-loaded data to avoid redundant fetches
 * @param {Array} [preloaded.globalTemplates] - Pre-fetched global templates
 * @param {object} [preloaded.team] - Pre-fetched team document
 * @returns {object} Access object with helper methods
 */
export async function getTeamAccess(teamName, nuid, preloaded = {}) {
  const [team, globalTemplates, teamMember] = await Promise.all([
    preloaded.team || getTeamByName(teamName),
    preloaded.globalTemplates || getAllGlobalRoleTemplates(),
    getTeamMember(teamName, nuid),
  ]);

  if (!teamMember) {
    return buildAccessObject(teamName, [], new Set(), false);
  }

  // Merge templates: global first, then team-level overrides by name
  const templateMap = new Map();
  for (const tmpl of (globalTemplates || [])) {
    templateMap.set(tmpl.name, tmpl);
  }
  const teamTemplates = team?.authorization?.roleTemplates || [];
  for (const tmpl of teamTemplates) {
    templateMap.set(tmpl.name, tmpl);
  }

  // Expand the user's roles through templates
  const memberRoles = teamMember.roles || ['member'];
  const rolePermissions = memberRoles.flatMap(roleName => {
    const template = templateMap.get(roleName);
    return template?.permissions || [];
  });

  // Union with direct grants
  const effective = new Set([
    ...rolePermissions,
    ...(teamMember.grants || []),
  ]);

  return buildAccessObject(teamName, memberRoles, effective, true);
}

/**
 * Build the access object returned by getTeamAccess.
 */
export function buildAccessObject(teamName, roles, permissions, isMember) {
  const hasWildcard = permissions.has('*');

  return {
    teamName,
    roles,
    permissions: [...permissions],
    isMember,
    has(permission) {
      return hasWildcard || permissions.has(permission);
    },
    hasAny(required) {
      if (hasWildcard) return true;
      return required.some(p => permissions.has(p));
    },
    hasAll(required) {
      if (hasWildcard) return true;
      return required.every(p => permissions.has(p));
    },
    /**
     * Check for a scoped permission.
     * hasScoped('admin.assistants.settings.manage', 'my-bot') returns true if the user has
     * 'admin.assistants.settings.manage' (unscoped / all) OR 'admin.assistants.settings.manage:my-bot'.
     */
    hasScoped(basePermission, scope) {
      if (hasWildcard) return true;
      if (permissions.has(basePermission)) return true;
      return permissions.has(`${basePermission}:${scope}`);
    },
    /**
     * Return the list of scope values the user has for a given base permission prefix.
     * e.g. getScopedValues('admin.assistants.settings.manage') => ['bot-a', 'bot-b']
     * Returns null if the user has the unscoped (all) permission or wildcard.
     */
    getScopedValues(basePermission) {
      if (hasWildcard || permissions.has(basePermission)) return null; // null = unrestricted
      const prefix = `${basePermission}:`;
      return [...permissions].filter(p => p.startsWith(prefix)).map(p => p.slice(prefix.length));
    },
  };
}

/**
 * Resolve permissions for a user across all their teams in one batch.
 * Used by getTeamMemberTeamsListWithRoles for efficiency.
 *
 * @param {Array} teamEntries - Array of { teamName, teamMember, team } objects
 * @param {Array} globalTemplates - Pre-fetched global role templates
 * @returns {Array} Array of permission string arrays, one per entry
 */
export function resolvePermissionsBatch(teamEntries, globalTemplates) {
  return teamEntries.map(({ teamMember, team }) => {
    const templateMap = new Map();
    for (const tmpl of (globalTemplates || [])) {
      templateMap.set(tmpl.name, tmpl);
    }
    const teamTemplates = team?.authorization?.roleTemplates || [];
    for (const tmpl of teamTemplates) {
      templateMap.set(tmpl.name, tmpl);
    }

    const memberRoles = teamMember.roles || ['member'];
    const rolePermissions = memberRoles.flatMap(roleName => {
      const template = templateMap.get(roleName);
      return template?.permissions || [];
    });

    const effective = new Set([
      ...rolePermissions,
      ...(teamMember.grants || []),
    ]);

    return [...effective];
  });
}

/**
 * Reconcile a member's grants when their roles change.
 *
 * Adds permissions from newly assigned roles and removes permissions
 * from removed roles — but only if no remaining role still grants them.
 * Direct grants (not from any role) are preserved.
 *
 * @param {object} member - The team member object with `grants` array
 * @param {string[]} oldRoles - Previous role list
 * @param {string[]} newRoles - New role list
 * @param {Array} availableRoles - Role template objects with `name` and `permissions`
 * @returns {string[]} The reconciled grants array
 */
export function reconcileGrantsForRoleChange(member, oldRoles, newRoles, availableRoles) {
  const currentGrants = new Set(member.grants || []);

  const getPermissionsForRole = (roleName) => {
    const template = availableRoles.find(r => r.name === roleName);
    return template?.permissions || [];
  };

  const addedRoles = newRoles.filter(r => !oldRoles.includes(r));
  const removedRoles = oldRoles.filter(r => !newRoles.includes(r));

  // Add permissions from newly added roles
  for (const role of addedRoles) {
    for (const perm of getPermissionsForRole(role)) {
      currentGrants.add(perm);
    }
  }

  // Remove permissions from removed roles, but only if no remaining role still grants them
  const remainingRolePermissions = new Set(
    newRoles.flatMap(r => getPermissionsForRole(r))
  );
  for (const role of removedRoles) {
    for (const perm of getPermissionsForRole(role)) {
      if (!remainingRolePermissions.has(perm)) {
        currentGrants.delete(perm);
      }
    }
  }

  return [...currentGrants];
}
