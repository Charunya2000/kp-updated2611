# Permissions System

This document describes how the GenAI Portal Notebook permission system works — from how permissions are defined in code, how they flow through roles and grants to individual team members, and how they protect routes and UI.

---

## 1. Permission Declaration

All valid permission keys are defined in a single source-of-truth file:

```
app/config/permissions.js
```

This file exports a `PERMISSIONS` constant containing every permission key as a dot-delimited string prefixed with `admin.` (e.g. `admin.team.members.view`, `admin.assistants.settings.manage`). It also exports `PERMISSION_METADATA`, an array that pairs each key with a human-readable label, description, and category.

**Permissions can only be added or removed through a code change and application deployment.** The admin UI at `/admin/permissions-management` allows application admins to view the permission registry and manage role templates, but it cannot create new permission keys. This is an intentional constraint — the permission registry is code, not configuration.

### Categories

Permissions are organized into categories for UI grouping:

| Category | Examples |
|---|---|
| Team | `admin.team.members.view`, `admin.team.members.manage`, `admin.team.role_templates.manage` |
| Assistants | `admin.assistants.manage`, `admin.assistants.settings.manage` |
| Statistics | `admin.statistics.view`, `admin.llm_statistics.view` |
| Content | `admin.sharepoint.sites.manage`, `admin.workflows.manage` |
| Team-Specific | `admin.ets.index.manage`, `admin.insight360.queries.manage`, etc. |

### Scoped Permissions

Some permissions support scoping to individual resources. The convention is:

```
base.permission:scopeValue
```

For example, `admin.assistants.settings.manage:my-bot` grants settings management for only the `my-bot` assistant. The unscoped form (`admin.assistants.settings.manage`) acts as a wildcard — it grants access to **all** assistants.

Scoped permissions are declared in `PERMISSIONS` with a trailing colon:
```js
ASSISTANT_SETTINGS_MANAGE_SCOPED: 'admin.assistants.settings.manage:',
ASSISTANTS_ASSIGN_USERS_SCOPED: 'admin.assistants.assign_users:',
```

---

## 2. Roles Are Collections of Permissions

Historically, authorization was handled by checking role names directly (e.g. "is this user an admin?"). The new system treats **roles as named collections of permissions**. A role template defines:

- **name** — Identifier (e.g. `admin`, `member`, `auditor`)
- **label** — Human-readable display name
- **description** — What the role is for
- **permissions** — Array of permission keys this role grants
- **isSystem** — Whether this is a system role (owner, admin, member) that cannot be deleted
- **color** — MUI chip color for UI rendering

When a user is assigned a role, they receive all permissions defined in that role's template.

### The Wildcard Permission

The special `*` permission grants all current and future permissions. The `owner` role template typically carries this permission.

---

## 3. Global Role Templates (Application Admin)

Application admins manage **global role templates** at `/admin/permissions-management`. These templates are stored in the central application database and are available to all teams by default.

### What Application Admins Can Do

1. **View the Permission Registry** — See every permission key, its label, description, and category. This is read-only; keys come from code.

2. **Create and Edit Role Templates** — Define named roles and assign permission keys to them. For example, the system `admin` role might include `admin.team.members.view`, `admin.team.members.manage`, `admin.assistants.manage`, etc.

3. **Delete Non-System Role Templates** — System roles (`owner`, `admin`, `member`) cannot be deleted but their permissions can be updated.

4. **Reconcile Permissions** — The "Reconcile Permissions" tool scans every team database and ensures each member's `grants` array includes all permissions from their assigned roles. This is useful after changing what permissions a role template includes. It supports a **dry run** (preview only) and an **apply** mode. This tool only adds grants, it never removes existing ones.

### How Permissions Are Assigned to Teams

When an application admin edits a team in Team Management, there is an **Enabled Permissions** section. This controls which permissions from the global registry are relevant for the team. Only enabled permissions appear in the team's role template editor and member permission panels. This prevents teams from seeing permissions that don't apply to them (e.g. BCS-specific permissions appearing for the ETS team).

---

## 4. Team-Level Role Templates (Team Admin)

Team members with the `admin.team.role_templates.manage` permission can access the **Role Templates** page at `/{teamName}/admin/role-templates`. Here they can:

1. **View Global Templates** — See the global role templates and their permissions.
2. **Override a Global Template** — Create a team-specific version of a global role that replaces it for this team only.
3. **Create Team-Only Templates** — Define entirely new roles specific to the team.

### Override Example: ETS Index Management

Suppose the global `admin` role template includes standard team and assistant management permissions but not `admin.ets.index.manage`. The ETS team admin can override the `admin` role template for their team:

- Go to `Role Templates` in the ETS team admin panel
- Click on the global `admin` template to override it
- Add `admin.ets.index.manage` to the permission list
- Save

Now, any user with the `admin` role in the ETS team will automatically also receive the `admin.ets.index.manage` permission, without affecting `admin` users in other teams.

### How Overrides Work at Runtime

When `getTeamAccess(teamName, nuid)` resolves permissions, it builds a template map starting from global templates, then overlays team-specific templates by name. This means a team template with the same name as a global template completely replaces it. The user's roles are then expanded through this merged template set.

```
effectivePermissions = union(
  rolesExpandedThroughMergedTemplates,
  directGrants
)
```

---

## 5. Individual Member Permissions (Grants)

Each team member document stores two permission-related fields:

- **roles** — Array of role names (e.g. `['admin', 'member']`)
- **grants** — Array of individual permission keys directly assigned to the user

At runtime, the effective permissions are the union of role-expanded permissions and direct grants. The `grants` array is the source of truth for individual overrides.

### Managing Permissions on the Members Page

The Members page (`/{teamName}/admin/members`) provides two ways to manage a member's permissions:

#### 1. Role Assignment (Role Selector Dropdown)

Each member row has a multi-select role dropdown. When a team admin changes a user's roles:

- Permissions from added roles are **added** to the member's `grants` array
- Permissions from removed roles are **removed** from `grants`, but only if no remaining role still provides that permission
- The member's `grants` and `roles` are saved together

This reconciliation ensures that `grants` stays in sync with role assignments.

#### 2. Direct Permission Editing (Permission Panel)

Clicking a member opens the permission panel on the right side. This shows every enabled permission as a checkbox. A team admin with the `admin.team.members.permissions.manage` permission can toggle individual permissions on or off.

When direct permissions are saved, the system **automatically recalculates role assignments** by comparing the member's grants against each role template. If a member's grants contain all the permissions defined in a role template, that role is automatically assigned. If they don't, the role is removed. This keeps role labels accurate reflections of what permissions a user actually has.

> **Owner role exception:** The `owner` role is structural and is never auto-added or auto-removed through permission reconciliation. It can only be changed via the role selector.

#### 3. Scoped Permissions (Assistant-Scoped Dialog)

Each member row has a "tune" icon button that opens the **Assistant-Scoped Permissions** dialog. This shows every assistant in the team grouped into cards. Within each card, scoped permission types are listed as checkboxes:

- **Manage Assistant Settings** — `admin.assistants.settings.manage:{assistantName}`
- **Assign Users to Assistant** — `admin.assistants.assign_users:{assistantName}`

For example, granting "Manage Assistant Settings" for only the `my-bot` assistant creates the grant `admin.assistants.settings.manage:my-bot`. This user will then see only `my-bot` in the assistant settings page dropdown — they cannot access or even see other assistants they don't have permission for.

### How Scoped Permissions Affect the UI

When a user has only scoped permissions (not the unscoped/wildcard version), the UI filters data to show only what they have access to:

- **Assistant Settings Page**: The server component resolves `getScopedValues('admin.assistants.settings.manage')`. If the user has the unscoped permission, it returns `null` (unrestricted). If they only have scoped grants, it returns an array of assistant names (e.g. `['my-bot', 'other-bot']`). This array is passed to `AdminTabs` as `allowedAssistants`, which filters the assistant dropdown to only show those assistants.

- **Team Admin Navigation Drawer**: The nav checks permissions using a `hasPermission` helper that supports `{ scoped: 'admin.assistants.settings.manage' }`. This matches if the user has the unscoped permission OR any scoped variant, so the "Assistant Settings" link still appears in the nav even for scoped-only users.

---

## 6. Route and Page Protection

Protection is applied at two layers: **API routes** and **server page components**.

### API Route Guards

API routes use guard wrappers defined in `app/api/guards.js`:

- **`withAppAdminGuard`** — Checks that the user is an application admin (AD group check). Used for global admin routes like `/api/admin/*`.

- **`withTeamPermissionGuard(permissions, options)`** — The permission-based guard. Checks the user's resolved permissions against the specified keys. Supports:
  - Single or multiple permissions
  - `{ any: true }` for OR logic (default is AND)
  - `{ scope: 'paramName' }` for scoped permission checks using route parameters
  - Logs every check in `kpmsg` format including the user's NUID, team, permissions, and whether access was allowed

Example usage in a route:
```js
export const GET = withTeamPermissionGuard(
  PERMISSIONS.TEAM_ROLE_TEMPLATES_MANAGE
)(async (req, { params }, access) => {
  // handler has access to the resolved access object
});
```

### Server Page Guards

Page-level components use `requireTeamPermission` or `requireAnyTeamPermission` from `app/utils/requireTeamPermission.js`. These call `getTeamAccess` and calls `forbidden()` if the check fails.

For more complex checks (like the assistant settings page that supports scoped permissions), pages resolve access directly:

```js
const access = await getTeamAccess(teamName, nuid);
const hasGlobal = access?.has(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE);
const scopedAssistants = access?.getScopedValues(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE);
```

### Client-Side UI Filtering

The Team Admin Navigation Drawer fetches the current user's resolved permissions from the member API endpoint (which now includes `permissions` in its response). Each nav link declares its required permission, and a `hasPermission()` helper evaluates whether the link should be shown. Links for features the user doesn't have permission for are hidden entirely.

The LeftNav sidebar uses a similar approach: it checks if a member has any `admin.*` permission to determine whether to show the "Admin" section for each team.

---

## 7. Resolution Flow Summary

Here is the complete flow from permission declaration to access check:

```
1. DECLARATION
   app/config/permissions.js defines all valid keys

2. ROLE TEMPLATES
   Application admins create global role templates mapping roles → permissions
   Team admins optionally override templates for their team

3. TEAM CONFIGURATION
   Application admins enable relevant permissions per team

4. MEMBER ASSIGNMENT
   Team admins assign roles to members (which expand to permissions)
   Team admins optionally grant direct or scoped permissions

5. ACCESS RESOLUTION
   getTeamAccess(teamName, nuid) merges:
     - Global templates (overridden by team templates)
     - Member's roles → expanded through merged templates
     - Member's direct grants
     → Returns access object with has(), hasAny(), hasAll(), hasScoped(), getScopedValues()

6. ENFORCEMENT
   API routes: withTeamPermissionGuard checks access object
   Pages: requireTeamPermission / direct access checks
   UI: Client-side filtering hides unauthorized nav links and data
```
