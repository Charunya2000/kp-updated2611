/**
 * Tests for the permissions system.
 *
 * Validates permission resolution, role-to-grant mapping, team overrides,
 * scoped permissions, and access object helper methods.
 */

jest.mock('../teamService', () => ({}));
jest.mock('../teamMemberService', () => ({}));
jest.mock('../roleTemplateService', () => ({}));

import { buildAccessObject, resolvePermissionsBatch, reconcileGrantsForRoleChange } from '../permissionsService';

// Helper: resolve permissions for a single team member using the batch service function
function resolvePermissions({ teamMember, team, globalTemplates }) {
  const [permissions] = resolvePermissionsBatch([{ teamMember, team }], globalTemplates);
  const effective = new Set(permissions);
  const memberRoles = teamMember.roles || ['member'];
  return { effective, memberRoles };
}

// --- Test Fixtures ---

const GLOBAL_TEMPLATES = [
  {
    name: 'member',
    permissions: ['admin.team.members.view'],
  },
  {
    name: 'admin',
    permissions: [
      'admin.team.members.view',
      'admin.team.members.manage',
      'admin.team.members.permissions.manage',
      'admin.assistants.manage',
      'admin.statistics.view',
    ],
  },
  {
    name: 'owner',
    permissions: ['*'],
  },
  {
    name: 'content-manager',
    permissions: [
      'admin.sharepoint.sites.manage',
      'admin.workflows.manage',
    ],
  },
];

const TEAM_WITH_OVERRIDE = {
  name: 'test-team',
  authorization: {
    roleTemplates: [
      {
        name: 'admin',
        permissions: [
          'admin.team.members.view',
          'admin.team.members.manage',
          'admin.team.members.permissions.manage',
          'admin.assistants.manage',
          'admin.statistics.view',
          'admin.ets.index.manage', // extra permission in team override
        ],
      },
    ],
  },
};

const TEAM_NO_OVERRIDE = {
  name: 'basic-team',
  authorization: {},
};

// --- Tests ---

describe('Permissions System', () => {
  describe('Page access - user has required grant', () => {
    it('should allow access when user has the exact required permission', () => {
      const access = buildAccessObject('test-team', ['admin'], new Set([
        'admin.team.members.view',
        'admin.team.members.manage',
        'admin.assistants.manage',
      ]), true);

      expect(access.has('admin.assistants.manage')).toBe(true);
    });

    it('should deny access when user lacks the required permission', () => {
      const access = buildAccessObject('test-team', ['member'], new Set([
        'admin.team.members.view',
      ]), true);

      expect(access.has('admin.assistants.manage')).toBe(false);
    });

    it('should deny all permissions when user is not a team member', () => {
      const access = buildAccessObject('test-team', [], new Set(), false);

      expect(access.isMember).toBe(false);
      expect(access.has('admin.team.members.view')).toBe(false);
    });

    it('should allow all permissions when user has wildcard grant', () => {
      const access = buildAccessObject('test-team', ['owner'], new Set(['*']), true);

      expect(access.has('admin.team.members.view')).toBe(true);
      expect(access.has('admin.assistants.manage')).toBe(true);
      expect(access.has('admin.workflows.manage')).toBe(true);
      expect(access.has('any.arbitrary.permission')).toBe(true);
    });

    it('should support hasAny for pages requiring one of several permissions', () => {
      const access = buildAccessObject('test-team', ['content-manager'], new Set([
        'admin.sharepoint.sites.manage',
        'admin.workflows.manage',
      ]), true);

      expect(access.hasAny(['admin.assistants.manage', 'admin.workflows.manage'])).toBe(true);
      expect(access.hasAny(['admin.assistants.manage', 'admin.statistics.view'])).toBe(false);
    });

    it('should support hasAll for pages requiring multiple permissions', () => {
      const access = buildAccessObject('test-team', ['admin'], new Set([
        'admin.team.members.view',
        'admin.team.members.manage',
        'admin.assistants.manage',
      ]), true);

      expect(access.hasAll(['admin.team.members.view', 'admin.team.members.manage'])).toBe(true);
      expect(access.hasAll(['admin.team.members.view', 'admin.statistics.view'])).toBe(false);
    });
  });

  describe('Grants updated when role changes', () => {
    const availableRoles = GLOBAL_TEMPLATES;

    it('should add new permissions when a role is added', () => {
      const member = { grants: ['admin.team.members.view'], roles: ['member'] };
      const oldRoles = ['member'];
      const newRoles = ['member', 'content-manager'];

      const result = reconcileGrantsForRoleChange(member, oldRoles, newRoles, availableRoles);

      expect(result).toContain('admin.team.members.view');
      expect(result).toContain('admin.sharepoint.sites.manage');
      expect(result).toContain('admin.workflows.manage');
    });

    it('should remove permissions when a role is removed and no other role grants them', () => {
      const member = {
        grants: [
          'admin.team.members.view',
          'admin.sharepoint.sites.manage',
          'admin.workflows.manage',
        ],
        roles: ['member', 'content-manager'],
      };
      const oldRoles = ['member', 'content-manager'];
      const newRoles = ['member'];

      const result = reconcileGrantsForRoleChange(member, oldRoles, newRoles, availableRoles);

      expect(result).toContain('admin.team.members.view');
      expect(result).not.toContain('admin.sharepoint.sites.manage');
      expect(result).not.toContain('admin.workflows.manage');
    });

    it('should not remove a permission if another remaining role still grants it', () => {
      const member = {
        grants: [
          'admin.team.members.view',
          'admin.team.members.manage',
          'admin.assistants.manage',
          'admin.statistics.view',
          'admin.sharepoint.sites.manage',
          'admin.workflows.manage',
        ],
        roles: ['admin', 'content-manager'],
      };
      const oldRoles = ['admin', 'content-manager'];
      const newRoles = ['content-manager'];

      const result = reconcileGrantsForRoleChange(member, oldRoles, newRoles, availableRoles);

      // content-manager keeps its own permissions
      expect(result).toContain('admin.sharepoint.sites.manage');
      expect(result).toContain('admin.workflows.manage');
      // admin-only permissions removed
      expect(result).not.toContain('admin.team.members.manage');
      expect(result).not.toContain('admin.assistants.manage');
      expect(result).not.toContain('admin.statistics.view');
    });

    it('should preserve direct grants that are not tied to any role', () => {
      const member = {
        grants: [
          'admin.team.members.view',
          'admin.nps.admin.manage', // direct grant, not from any role
        ],
        roles: ['member'],
      };
      const oldRoles = ['member'];
      const newRoles = ['member', 'content-manager'];

      const result = reconcileGrantsForRoleChange(member, oldRoles, newRoles, availableRoles);

      expect(result).toContain('admin.nps.admin.manage');
      expect(result).toContain('admin.sharepoint.sites.manage');
    });
  });

  describe('Grants match role permissions exactly', () => {
    it('should resolve member role to correct permissions from global templates', () => {
      const teamMember = { roles: ['member'], grants: [] };
      const { effective } = resolvePermissions({
        teamMember,
        team: TEAM_NO_OVERRIDE,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      expect([...effective]).toEqual(['admin.team.members.view']);
    });

    it('should resolve admin role to all admin permissions', () => {
      const teamMember = { roles: ['admin'], grants: [] };
      const { effective } = resolvePermissions({
        teamMember,
        team: TEAM_NO_OVERRIDE,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      expect(effective.has('admin.team.members.view')).toBe(true);
      expect(effective.has('admin.team.members.manage')).toBe(true);
      expect(effective.has('admin.team.members.permissions.manage')).toBe(true);
      expect(effective.has('admin.assistants.manage')).toBe(true);
      expect(effective.has('admin.statistics.view')).toBe(true);
      expect(effective.size).toBe(5);
    });

    it('should union permissions from multiple roles', () => {
      const teamMember = { roles: ['member', 'content-manager'], grants: [] };
      const { effective } = resolvePermissions({
        teamMember,
        team: TEAM_NO_OVERRIDE,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      expect(effective.has('admin.team.members.view')).toBe(true);
      expect(effective.has('admin.sharepoint.sites.manage')).toBe(true);
      expect(effective.has('admin.workflows.manage')).toBe(true);
      expect(effective.size).toBe(3);
    });

    it('should union role permissions with direct grants', () => {
      const teamMember = {
        roles: ['member'],
        grants: ['admin.nps.admin.manage'],
      };
      const { effective } = resolvePermissions({
        teamMember,
        team: TEAM_NO_OVERRIDE,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      expect(effective.has('admin.team.members.view')).toBe(true);
      expect(effective.has('admin.nps.admin.manage')).toBe(true);
      expect(effective.size).toBe(2);
    });

    it('should default to member role when no roles specified', () => {
      const teamMember = { grants: [] };
      const { effective, memberRoles } = resolvePermissions({
        teamMember,
        team: TEAM_NO_OVERRIDE,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      expect(memberRoles).toEqual(['member']);
      expect(effective.has('admin.team.members.view')).toBe(true);
    });

    it('should return empty permissions for unknown roles', () => {
      const teamMember = { roles: ['nonexistent-role'], grants: [] };
      const { effective } = resolvePermissions({
        teamMember,
        team: TEAM_NO_OVERRIDE,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      expect(effective.size).toBe(0);
    });
  });

  describe('Team-level role template overrides', () => {
    it('should use team override instead of global template for the same role name', () => {
      const teamMember = { roles: ['admin'], grants: [] };
      const { effective } = resolvePermissions({
        teamMember,
        team: TEAM_WITH_OVERRIDE,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      // Team override adds ets.index.manage to admin role
      expect(effective.has('admin.ets.index.manage')).toBe(true);
      // Still has global admin permissions (they're in the override too)
      expect(effective.has('admin.team.members.view')).toBe(true);
      expect(effective.has('admin.assistants.manage')).toBe(true);
      expect(effective.size).toBe(6);
    });

    it('should fall back to global template for roles not overridden at team level', () => {
      const teamMember = { roles: ['content-manager'], grants: [] };
      const { effective } = resolvePermissions({
        teamMember,
        team: TEAM_WITH_OVERRIDE,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      // content-manager is not overridden, uses global
      expect(effective.has('admin.sharepoint.sites.manage')).toBe(true);
      expect(effective.has('admin.workflows.manage')).toBe(true);
      expect(effective.size).toBe(2);
    });

    it('should combine overridden and non-overridden roles correctly', () => {
      const teamMember = { roles: ['admin', 'content-manager'], grants: [] };
      const { effective } = resolvePermissions({
        teamMember,
        team: TEAM_WITH_OVERRIDE,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      // From team-overridden admin
      expect(effective.has('admin.ets.index.manage')).toBe(true);
      expect(effective.has('admin.team.members.manage')).toBe(true);
      // From global content-manager
      expect(effective.has('admin.sharepoint.sites.manage')).toBe(true);
      expect(effective.has('admin.workflows.manage')).toBe(true);
      expect(effective.size).toBe(8);
    });

    it('should allow team to define entirely new role templates', () => {
      const teamWithCustomRole = {
        name: 'custom-team',
        authorization: {
          roleTemplates: [
            {
              name: 'regulatory-reviewer',
              permissions: [
                'admin.regulatory.config.manage',
                'admin.regulatory.preparation.manage',
              ],
            },
          ],
        },
      };
      const teamMember = { roles: ['regulatory-reviewer'], grants: [] };
      const { effective } = resolvePermissions({
        teamMember,
        team: teamWithCustomRole,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      expect(effective.has('admin.regulatory.config.manage')).toBe(true);
      expect(effective.has('admin.regulatory.preparation.manage')).toBe(true);
      expect(effective.size).toBe(2);
    });
  });

  describe('Scoped permissions', () => {
    it('should grant scoped access for a specific assistant', () => {
      const access = buildAccessObject('test-team', ['member'], new Set([
        'admin.team.members.view',
        'admin.assistants.settings.manage:bot-alpha',
      ]), true);

      expect(access.hasScoped('admin.assistants.settings.manage', 'bot-alpha')).toBe(true);
      expect(access.hasScoped('admin.assistants.settings.manage', 'bot-beta')).toBe(false);
    });

    it('should grant all scopes when user has unscoped permission', () => {
      const access = buildAccessObject('test-team', ['admin'], new Set([
        'admin.assistants.settings.manage',
      ]), true);

      expect(access.hasScoped('admin.assistants.settings.manage', 'bot-alpha')).toBe(true);
      expect(access.hasScoped('admin.assistants.settings.manage', 'any-bot')).toBe(true);
    });

    it('should return scoped values when user has only scoped permissions', () => {
      const access = buildAccessObject('test-team', ['member'], new Set([
        'admin.assistants.settings.manage:bot-a',
        'admin.assistants.settings.manage:bot-b',
      ]), true);

      const values = access.getScopedValues('admin.assistants.settings.manage');
      expect(values).toContain('bot-a');
      expect(values).toContain('bot-b');
      expect(values).toHaveLength(2);
    });

    it('should return null for getScopedValues when user has unscoped permission', () => {
      const access = buildAccessObject('test-team', ['admin'], new Set([
        'admin.assistants.settings.manage',
      ]), true);

      expect(access.getScopedValues('admin.assistants.settings.manage')).toBeNull();
    });

    it('should return null for getScopedValues when user has wildcard', () => {
      const access = buildAccessObject('test-team', ['owner'], new Set(['*']), true);

      expect(access.getScopedValues('admin.assistants.settings.manage')).toBeNull();
    });

    it('should return empty array when user has no scoped values for a permission', () => {
      const access = buildAccessObject('test-team', ['member'], new Set([
        'admin.team.members.view',
      ]), true);

      const values = access.getScopedValues('admin.assistants.settings.manage');
      expect(values).toEqual([]);
    });
  });

  describe('Wildcard and owner role', () => {
    it('should resolve owner role to wildcard permission', () => {
      const teamMember = { roles: ['owner'], grants: [] };
      const { effective } = resolvePermissions({
        teamMember,
        team: TEAM_NO_OVERRIDE,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      expect(effective.has('*')).toBe(true);
    });

    it('should grant any permission check via wildcard', () => {
      const access = buildAccessObject('test-team', ['owner'], new Set(['*']), true);

      expect(access.has('admin.team.members.view')).toBe(true);
      expect(access.has('admin.nonexistent.permission')).toBe(true);
      expect(access.hasAny(['admin.anything'])).toBe(true);
      expect(access.hasAll(['admin.a', 'admin.b', 'admin.c'])).toBe(true);
      expect(access.hasScoped('admin.assistants.settings.manage', 'any-scope')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty grants and empty roles gracefully', () => {
      const teamMember = { roles: [], grants: [] };
      const { effective } = resolvePermissions({
        teamMember,
        team: TEAM_NO_OVERRIDE,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      expect(effective.size).toBe(0);
    });

    it('should handle null globalTemplates array', () => {
      const teamMember = { roles: ['member'], grants: ['admin.team.members.view'] };
      const { effective } = resolvePermissions({
        teamMember,
        team: TEAM_NO_OVERRIDE,
        globalTemplates: null,
      });

      // Only direct grant, since templates are null
      expect(effective.has('admin.team.members.view')).toBe(true);
      expect(effective.size).toBe(1);
    });

    it('should handle team with no authorization property', () => {
      const teamMember = { roles: ['member'], grants: [] };
      const { effective } = resolvePermissions({
        teamMember,
        team: { name: 'bare-team' },
        globalTemplates: GLOBAL_TEMPLATES,
      });

      expect(effective.has('admin.team.members.view')).toBe(true);
    });

    it('should deduplicate permissions from overlapping roles', () => {
      const teamMember = { roles: ['admin', 'member'], grants: ['admin.team.members.view'] };
      const { effective } = resolvePermissions({
        teamMember,
        team: TEAM_NO_OVERRIDE,
        globalTemplates: GLOBAL_TEMPLATES,
      });

      // admin.team.members.view appears in both roles and in grants, but Set deduplicates
      const viewCount = [...effective].filter(p => p === 'admin.team.members.view').length;
      expect(viewCount).toBe(1);
    });

    it('should not mutate the original member grants array during reconciliation', () => {
      const originalGrants = ['admin.team.members.view'];
      const member = { grants: [...originalGrants], roles: ['member'] };

      reconcileGrantsForRoleChange(member, ['member'], ['member', 'content-manager'], GLOBAL_TEMPLATES);

      expect(member.grants).toEqual(originalGrants);
    });
  });
});
