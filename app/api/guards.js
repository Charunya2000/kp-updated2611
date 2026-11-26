import { isTeamAdmin } from "../services/teamRoleService";
import { isAppAdmin } from "../services/applicationRoleService";
import { getTeamAccess } from "../services/permissionsService";
import { getCurrentUserNuid } from "@/utils/getSession";
import { NextResponse } from "next/server";

/**
 * WARNING!!! This fucntion is being deprecated: Use withTeamPermissionGuard instead
 */
export async function withTeamAdminGuard(handler) {
  return async (req, { params }) => {
    const { teamName } = await params;

    const isAdmin = await isTeamAdmin(teamName);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return handler(req, { params });
  }
}

export async function withAppAdminGuard(handler) {
  return async (req, { params }) => {
    const isAdmin = await isAppAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return handler(req, { params });
  }
}

/**
 * Guard that checks the current user has the required permission(s) for the team.
 *
 * @param {string|string[]} requiredPermissions - Permission key(s) to check
 * @param {{ any?: boolean, scope?: string|function, teamName?: string }} options
 *   - `any`      – If true, user needs ANY of the listed permissions (default: ALL)
 *   - `scope`    – Route-param name or async resolver used for scoped permission checks.
 *                  When set, the guard uses `access.hasScoped(permission, scopeValue)`
 *                  so the user is allowed if they hold the unscoped permission OR the
 *                  scoped variant (e.g. `admin.assistants.settings.manage:my-bot`).
 *   - `teamName` – Explicit team name. If provided, used instead of extracting from route params.
 */
export function withTeamPermissionGuard(requiredPermissions, { any = false, scope = null, teamName: explicitTeamName = null } = {}) {
  const required = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  const checkPermission = (access, permissionConfig, scopeValue) => {
    if (permissionConfig?.scoped) {
      if (scopeValue !== undefined && scopeValue !== null) {
        return access.hasScoped(permissionConfig.scoped, scopeValue);
      }

      if (access.has(permissionConfig.scoped)) {
        return true;
      }

      const scopedValues = access.getScopedValues(permissionConfig.scoped);
      return Array.isArray(scopedValues) && scopedValues.length > 0;
    }

    if (scopeValue !== undefined && scopeValue !== null) {
      return access.hasScoped(permissionConfig, scopeValue);
    }

    return access.has(permissionConfig);
  };

  return function (handler) {
    return async (req, { params }) => {
      const resolvedParams = await params;
      const teamName = explicitTeamName || resolvedParams.teamName;
      const nuid = await getCurrentUserNuid();
      const access = await getTeamAccess(teamName, nuid);

      let allowed;
      if (scope) {
        const scopeValue = typeof scope === 'function'
          ? await scope(req, resolvedParams)
          : resolvedParams[scope];
        const checks = required.map(permission => checkPermission(access, permission, scopeValue));
        allowed = any ? checks.some(Boolean) : checks.every(Boolean);
      } else {
        const checks = required.map(permission => checkPermission(access, permission));
        allowed = any ? checks.some(Boolean) : checks.every(Boolean);
      }

      // log the permissons, the nuid, the teamName and whether they were allowed in kpmsg format
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'withTeamPermissionGuard',
          detail: { nuid, teamName, required, scope, allowed, access: { permissions: access.permissions, roles: access.roles }, method: req.method, path: req.nextUrl.pathname },
        }
      }));


      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return handler(req, { params }, access);
    };
  };
}