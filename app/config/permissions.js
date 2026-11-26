/**
 * Permission Registry
 *
 * All valid permission keys are defined here in code.
 * The UI at /admin/permissions-management allows app admins to manage
 * labels/descriptions and assign permissions to default role templates,
 * but cannot create new keys — that requires a code change.
 */

export const PERMISSIONS = {
  // Team
  TEAM_MEMBERS_VIEW: 'admin.team.members.view',
  TEAM_MEMBERS_MANAGE: 'admin.team.members.manage',
  TEAM_MEMBERS_PERMISSIONS_MANAGE: 'admin.team.members.permissions.manage',
  TEAM_ROLE_TEMPLATES_MANAGE: 'admin.team.role_templates.manage',

  // Assistants
  ASSISTANTS_MANAGE: 'admin.assistants.manage',
  ASSISTANTS_ASSIGN_USERS: 'admin.assistants.assign_users',
  ASSISTANTS_ASSIGN_USERS_SCOPED: 'admin.assistants.assign_users:', // append assistantName
  ASSISTANT_SETTINGS_MANAGE: 'admin.assistants.settings.manage',
  ASSISTANT_SETTINGS_MANAGE_SCOPED: 'admin.assistants.settings.manage:', // append assistantName
  ASSISTANT_NEWS_MANAGE: 'admin.assistants.news.manage',
  ASSISTANT_NEWS_MANAGE_SCOPED: 'admin.assistants.news.manage:', // append assistantName

  // Statistics
  STATISTICS_VIEW: 'admin.statistics.view',
  LLM_STATISTICS_VIEW: 'admin.llm_statistics.view',
  APPROVAL_STATISTICS_VIEW: 'admin.approval_statistics.view',

  // Content
  SHAREPOINT_SITES_MANAGE: 'admin.sharepoint.sites.manage',
  WORKFLOWS_MANAGE: 'admin.workflows.manage',
  // CONTEXT_TEMPLATES_MANAGE: 'admin.context_templates.manage',

  // Team-specific
  ETS_INDEX_MANAGE: 'admin.ets.index.manage',
  INSIGHT360_QUERIES_MANAGE: 'admin.insight360.queries.manage',
  INSIGHT360_AUDIT_VIEW: 'admin.insight360.audit.view',
  BCS_INCIDENT_INDEX_MANAGE: 'admin.bcs.incident_index.manage',
  NPS_ADMIN_MANAGE: 'admin.nps.admin.manage',
  BCS_ADMIN_MANAGE: 'admin.bcs.admin.manage',
  CMAT_ADMIN_MANAGE: 'admin.cmat.admin.manage',
  REGULATORY_CONFIG_MANAGE: 'admin.regulatory.config.manage',
  REGULATORY_PREPARATION_MANAGE: 'admin.regulatory.preparation.manage',
  RCNOA_PROCESSING_MANAGE: 'admin.rcnoa.processing.manage',
  CAC_REPORTS_ACCESS: 'admin.customer_and_contracts.access',
  MEDICARE_COMPANION_AUDIT_VIEW: 'admin.medicare_companion.audit.view',
  KPIF_AUDIT_TEMPLATE_MANAGE: 'admin.kpif.compare_config.manage',
  KPIF_QUERY_CONFIG_MANAGE: 'admin.kpif.query_config.manage',
  KPIF_RUN_HISTORY_DELETE: 'admin.kpif.run_history.delete',
  MEDICARE_AUDIT_TEMPLATE_MANAGE: 'admin.medicare.compare_config.manage',
  MEDICARE_QUERY_CONFIG_MANAGE: 'admin.medicare.query_config.manage',
  MEDICARE_RUN_HISTORY_DELETE: 'admin.medicare.run_history.delete',
};

export const PERMISSION_METADATA = [
  // Team
  { key: PERMISSIONS.TEAM_MEMBERS_VIEW, label: 'View Members', description: 'Can view the list of team members, but not make changes', category: 'Team' },
  { key: PERMISSIONS.TEAM_MEMBERS_MANAGE, label: 'Manage Members', description: 'Can view, add, and remove team members', category: 'Team' },
  { key: PERMISSIONS.TEAM_MEMBERS_PERMISSIONS_MANAGE, label: 'Manage Member Permissions', description: 'Can view team members, modify their permissions, and change their roles', category: 'Team' },
  { key: PERMISSIONS.TEAM_ROLE_TEMPLATES_MANAGE, label: 'Manage Role Templates', description: 'Can create and edit team-specific role templates', category: 'Team' },

  // Assistants
  { key: PERMISSIONS.ASSISTANTS_MANAGE, label: 'Manage Assistants', description: 'Can create, update, and delete assistants', category: 'Assistants' },
  { key: PERMISSIONS.ASSISTANTS_ASSIGN_USERS, label: 'Assign Users to Assistants', description: 'Can assign and remove users from assistants', category: 'Assistants' },
  { key: PERMISSIONS.ASSISTANTS_ASSIGN_USERS_SCOPED, label: 'Assign Users to Specific Assistants', description: 'Grants user assignment management for individual assistants.', category: 'Assistants', isScoped: true },
  { key: PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, label: 'Manage All Assistant Settings', description: 'Can manage settings (prompts, personas, indexes, etc.) for all assistants in the team', category: 'Assistants' },
  { key: PERMISSIONS.ASSISTANT_SETTINGS_MANAGE_SCOPED, label: 'Manage Specific Assistant Settings', description: 'Grants settings management for individual assistants. Scoped: append assistant name (e.g. admin.assistants.settings.manage:my-bot)', category: 'Assistants', isScoped: true },
  { key: PERMISSIONS.ASSISTANT_NEWS_MANAGE, label: 'Manage All Assistant News', description: 'Can create and update the News & Updates message for all assistants in the team', category: 'Assistants' },
  { key: PERMISSIONS.ASSISTANT_NEWS_MANAGE_SCOPED, label: 'Manage Specific Assistant News', description: 'Grants News & Updates management for individual assistants. Scoped: append assistant name (e.g. admin.assistants.news.manage:my-bot)', category: 'Assistants', isScoped: true },

  // Statistics
  { key: PERMISSIONS.STATISTICS_VIEW, label: 'View Statistics', description: 'Can view application usage statistics', category: 'Statistics' },
  { key: PERMISSIONS.LLM_STATISTICS_VIEW, label: 'View LLM Statistics', description: 'Can view LLM usage and cost statistics', category: 'Statistics' },
  { key: PERMISSIONS.APPROVAL_STATISTICS_VIEW, label: 'View Approval Statistics', description: 'Can view and export chat interaction approval statistics', category: 'Statistics' },

  // Content
  { key: PERMISSIONS.SHAREPOINT_SITES_MANAGE, label: 'Manage SharePoint Sites', description: 'Can add and remove SharePoint site sources', category: 'Content' },
  { key: PERMISSIONS.WORKFLOWS_MANAGE, label: 'Manage Workflows', description: 'Can create and configure workflows', category: 'Content' },
  // { key: PERMISSIONS.CONTEXT_TEMPLATES_MANAGE, label: 'Manage Context Templates', description: 'Can create and edit context template collections', category: 'Content' },

  // Team-specific
  { key: PERMISSIONS.ETS_INDEX_MANAGE, label: 'Manage ETS Index', description: 'Can manage the ETS index including documents and tags', category: 'Team-Specific' },
  { key: PERMISSIONS.INSIGHT360_QUERIES_MANAGE, label: 'Manage Insight 360 Queries', description: 'Can create and modify Insight 360 comparison queries', category: 'Team-Specific' },
  { key: PERMISSIONS.INSIGHT360_AUDIT_VIEW, label: 'View Insight 360 Audit', description: 'Can access the Insight 360 audit dashboard', category: 'Team-Specific' },
  { key: PERMISSIONS.BCS_INCIDENT_INDEX_MANAGE, label: 'Manage BCS Incident Index', description: 'Can upload and manage incident data for BCS', category: 'Team-Specific' },
  { key: PERMISSIONS.NPS_ADMIN_MANAGE, label: 'Manage NPS Config', description: 'Can manage NPS admin configuration', category: 'Team-Specific' },
  { key: PERMISSIONS.BCS_ADMIN_MANAGE, label: 'Manage BCS Config', description: 'Can manage BCS admin configuration', category: 'Team-Specific' },
  { key: PERMISSIONS.CMAT_ADMIN_MANAGE, label: 'Manage CMAT Config', description: 'Can manage CMAT admin configuration', category: 'Team-Specific' },
  { key: PERMISSIONS.REGULATORY_CONFIG_MANAGE, label: 'Manage Regulatory Config', description: 'Can manage regulatory configuration', category: 'Team-Specific' },
  { key: PERMISSIONS.REGULATORY_PREPARATION_MANAGE, label: 'Manage Regulatory Preparation', description: 'Can manage regulatory preparation tasks', category: 'Team-Specific' },
  { key: PERMISSIONS.RCNOA_PROCESSING_MANAGE, label: 'Manage RCNOA Processing', description: 'Can configure, run, and audit RCNO-to-RCNA-to-834 processing', category: 'Team-Specific' },
  { key: PERMISSIONS.CAC_REPORTS_ACCESS, label: 'Access CAC Reports', description: 'Can run and access CAC reports', category: 'Team-Specific' },
  { key: PERMISSIONS.MEDICARE_COMPANION_AUDIT_VIEW, label: 'View Medicare Companion Audit', description: 'Can access the Medicare Companion audit dashboard', category: 'Team-Specific' },
  { key: PERMISSIONS.KPIF_AUDIT_TEMPLATE_MANAGE, label: 'Manage KPIF Audit Template', description: 'Can manage KPIF audit templates', category: 'Team-Specific' },
  { key: PERMISSIONS.KPIF_QUERY_CONFIG_MANAGE, label: 'Manage KPIF Query Config', description: 'Can manage KPIF queries', category: 'Team-Specific' },
  { key: PERMISSIONS.KPIF_RUN_HISTORY_DELETE, label: 'Delete KPIF Run History', description: 'Can delete KPIF run history', category: 'Team-Specific' },
  { key: PERMISSIONS.MEDICARE_RUN_HISTORY_DELETE, label: 'Delete Medicare Run History', description: 'Can delete Medicare run history', category: 'Team-Specific' },
  { key: PERMISSIONS.MEDICARE_AUDIT_TEMPLATE_MANAGE, label: 'Manage Medicare Audit Template', description: 'Can manage Medicare audit templates', category: 'Team-Specific' },
  { key: PERMISSIONS.MEDICARE_QUERY_CONFIG_MANAGE, label: 'Manage Medicare Query Config', description: 'Can manage Medicare queries', category: 'Team-Specific' },
];

/**
 * Returns the list of unique categories from the permission metadata.
 * Excludes scoped permissions since those are a special case in the UI and may not need to be displayed in the same way as regular permissions.
 */
export function getPermissionCategories() {
  return [...new Set(PERMISSION_METADATA.filter(p => !p.isScoped).map(p => p.category))];
}

/**
 * Returns permission metadata entries for a given category.
 * Excludes scoped permissions (isScoped: true) since those require special handling in the UI.
 */
export function getPermissionsByCategory(category) {
  return PERMISSION_METADATA.filter(p => p.category === category && !p.isScoped);
}

/**
 * Returns the metadata object for a single permission key, or undefined.
 */
export function getPermissionMeta(key) {
  return PERMISSION_METADATA.find(p => p.key === key);
}

/**
 * Extracts scoped values from a permissions array for a given prefix.
 * e.g. getScopedValues(['admin.assistants.settings.manage:bot-a','other'], 'admin.assistants.settings.manage:')
 *   => ['bot-a']
 */
export function getScopedValues(permissions, prefix) {
  return permissions
    .filter(p => p.startsWith(prefix))
    .map(p => p.slice(prefix.length));
}
