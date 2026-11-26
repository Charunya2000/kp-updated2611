import { NextResponse } from 'next/server';
import { isAppAdmin } from '@/app/services/applicationRoleService';
import { getAllTeams } from '@/app/services/teamService';
import { getAllGlobalRoleTemplates } from '@/app/services/roleTemplateService';
import { getAllTeamMembers, updateTeamMember } from '@/app/services/teamMemberService';

/**
 * POST /api/admin/reconcile-permissions
 *
 * Iterates every team database, looks at each TeamMember document, and
 * ensures that all permissions implied by the member's roles (via global and
 * team-specific role templates) are present in the member's grants array.
 *
 * Body options:
 *   { dryRun: true }  — preview changes without writing (default: true)
 */
export async function POST(request) {
  const admin = await isAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // default true for safety

    const [teams, globalTemplates] = await Promise.all([
      getAllTeams(),
      getAllGlobalRoleTemplates(),
    ]);

    const results = {
      teamsProcessed: 0,
      membersScanned: 0,
      membersUpdated: 0,
      grantsAdded: 0,
      dryRun,
      details: [],
    };

    for (const team of teams) {
      const teamName = team.name;
      results.teamsProcessed++;

      // Build merged template map: global first, team overrides
      const templateMap = new Map();
      for (const tmpl of (globalTemplates || [])) {
        templateMap.set(tmpl.name, tmpl);
      }
      const teamTemplates = team?.authorization?.roleTemplates || [];
      for (const tmpl of teamTemplates) {
        templateMap.set(tmpl.name, tmpl);
      }

      let members;
      try {
        members = await getAllTeamMembers(teamName);
      } catch (err) {
        results.details.push({
          teamName,
          error: `Failed to fetch members: ${err.message}`,
        });
        continue;
      }

      if (!Array.isArray(members)) continue;

      for (const member of members) {
        results.membersScanned++;
        const roles = member.roles || [];
        if (roles.length === 0) continue;

        // Resolve permissions from roles
        const rolePermissions = roles.flatMap(roleName => {
          const template = templateMap.get(roleName);
          return template?.permissions || [];
        });

        if (rolePermissions.length === 0) continue;

        const existingGrants = new Set(member.grants || []);
        const newGrants = rolePermissions.filter(p => !existingGrants.has(p));

        if (newGrants.length === 0) continue;

        const mergedGrants = [...existingGrants, ...newGrants];

        if (!dryRun) {
          await updateTeamMember({ id: member.id, roles: member.roles, grants: mergedGrants }, teamName);
        }

        results.membersUpdated++;
        results.grantsAdded += newGrants.length;
        results.details.push({
          teamName,
          nuid: member.nuid,
          roles,
          added: newGrants,
        });
      }
    }

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'reconcilePermissions',
        detail: {
          dryRun,
          teamsProcessed: results.teamsProcessed,
          membersScanned: results.membersScanned,
          membersUpdated: results.membersUpdated,
          grantsAdded: results.grantsAdded,
        },
      },
    }));

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'reconcilePermissions',
        detail: { error: error.message },
      },
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
