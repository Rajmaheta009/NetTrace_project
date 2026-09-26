/**
 * NetTrace Server-Enforced & Role-Based Access Control (RBAC)
 * Centralized Permission Definitions & Authorizer Utilities
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  INVESTIGATOR: 'INVESTIGATOR',
  ANALYST: 'ANALYST',
  REVIEWER: 'REVIEWER',
  VIEWER: 'VIEWER',
};

export const PERMISSIONS = {
  // Case Operations
  CASE_VIEW: 'CASE_VIEW',
  CASE_CREATE: 'CASE_CREATE',
  CASE_UPDATE: 'CASE_UPDATE',
  CASE_DELETE: 'CASE_DELETE',
  CASE_VIEW_ALL: 'CASE_VIEW_ALL',

  // Evidence Management
  EVIDENCE_VIEW: 'EVIDENCE_VIEW',
  EVIDENCE_UPLOAD: 'EVIDENCE_UPLOAD',
  EVIDENCE_DELETE: 'EVIDENCE_DELETE',

  // Entity Resolution
  ENTITY_VIEW: 'ENTITY_VIEW',
  ENTITY_CREATE: 'ENTITY_CREATE',
  ENTITY_UPDATE: 'ENTITY_UPDATE',
  ENTITY_MERGE: 'ENTITY_MERGE',

  // Relationship Intelligence
  RELATIONSHIP_VIEW: 'RELATIONSHIP_VIEW',
  RELATIONSHIP_CREATE: 'RELATIONSHIP_CREATE',
  RELATIONSHIP_UPDATE: 'RELATIONSHIP_UPDATE',
  RELATIONSHIP_DELETE: 'RELATIONSHIP_DELETE',

  // Graph & Analytics
  GRAPH_VIEW: 'GRAPH_VIEW',
  GRAPH_ANALYZE: 'GRAPH_ANALYZE',
  GRAPH_CLEAR: 'GRAPH_CLEAR',
  GRAPH_RESET: 'GRAPH_RESET',

  // Human Validation Queue
  VALIDATION_VIEW: 'VALIDATION_VIEW',
  VALIDATION_CREATE: 'VALIDATION_CREATE',
  VALIDATION_ACCEPT: 'VALIDATION_ACCEPT',
  VALIDATION_REJECT: 'VALIDATION_REJECT',
  VALIDATION_CORRECT: 'VALIDATION_CORRECT',

  // Investigation Leads
  LEAD_VIEW: 'LEAD_VIEW',
  LEAD_CREATE: 'LEAD_CREATE',
  LEAD_UPDATE: 'LEAD_UPDATE',

  // Field Notes
  NOTE_VIEW: 'NOTE_VIEW',
  NOTE_CREATE: 'NOTE_CREATE',
  NOTE_UPDATE: 'NOTE_UPDATE',
  NOTE_DELETE: 'NOTE_DELETE',

  // Audit & Security Lineage
  AUDIT_VIEW: 'AUDIT_VIEW',
  AUDIT_VERIFY: 'AUDIT_VERIFY',

  // User & Administrative Management
  USER_VIEW: 'USER_VIEW',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DEACTIVATE: 'USER_DEACTIVATE',
  USER_DELETE: 'USER_DELETE',
  ROLE_VIEW: 'ROLE_VIEW',
  ROLE_CREATE: 'ROLE_CREATE',
  ROLE_UPDATE: 'ROLE_UPDATE',
  ROLE_ASSIGN: 'ROLE_ASSIGN',
  SYSTEM_SETTINGS: 'SYSTEM_SETTINGS',

  // Dashboard & Reports
  DASHBOARD_VIEW: 'DASHBOARD_VIEW',
  REPORT_VIEW: 'REPORT_VIEW',
  REPORT_EXPORT: 'REPORT_EXPORT',
};

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    ...Object.values(PERMISSIONS),
  ],
  ADMIN: Object.values(PERMISSIONS).filter(
    (p) => p !== PERMISSIONS.SYSTEM_SETTINGS && p !== PERMISSIONS.ROLE_CREATE
  ),
  INVESTIGATOR: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CASE_VIEW,
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_UPDATE,
    PERMISSIONS.EVIDENCE_VIEW,
    PERMISSIONS.EVIDENCE_UPLOAD,
    PERMISSIONS.ENTITY_VIEW,
    PERMISSIONS.ENTITY_CREATE,
    PERMISSIONS.ENTITY_UPDATE,
    PERMISSIONS.ENTITY_MERGE,
    PERMISSIONS.RELATIONSHIP_VIEW,
    PERMISSIONS.RELATIONSHIP_CREATE,
    PERMISSIONS.RELATIONSHIP_UPDATE,
    PERMISSIONS.GRAPH_VIEW,
    PERMISSIONS.GRAPH_ANALYZE,
    PERMISSIONS.GRAPH_CLEAR,
    PERMISSIONS.VALIDATION_VIEW,
    PERMISSIONS.VALIDATION_CREATE,
    PERMISSIONS.VALIDATION_ACCEPT,
    PERMISSIONS.VALIDATION_REJECT,
    PERMISSIONS.VALIDATION_CORRECT,
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.NOTE_VIEW,
    PERMISSIONS.NOTE_CREATE,
    PERMISSIONS.NOTE_UPDATE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
  ],
  ANALYST: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CASE_VIEW,
    PERMISSIONS.EVIDENCE_VIEW,
    PERMISSIONS.ENTITY_VIEW,
    PERMISSIONS.RELATIONSHIP_VIEW,
    PERMISSIONS.GRAPH_VIEW,
    PERMISSIONS.GRAPH_ANALYZE,
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.NOTE_VIEW,
    PERMISSIONS.NOTE_CREATE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
  ],
  REVIEWER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CASE_VIEW,
    PERMISSIONS.EVIDENCE_VIEW,
    PERMISSIONS.ENTITY_VIEW,
    PERMISSIONS.RELATIONSHIP_VIEW,
    PERMISSIONS.GRAPH_VIEW,
    PERMISSIONS.VALIDATION_VIEW,
    PERMISSIONS.VALIDATION_ACCEPT,
    PERMISSIONS.VALIDATION_REJECT,
    PERMISSIONS.VALIDATION_CORRECT,
    PERMISSIONS.NOTE_VIEW,
    PERMISSIONS.NOTE_CREATE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.REPORT_VIEW,
  ],
  VIEWER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CASE_VIEW,
    PERMISSIONS.EVIDENCE_VIEW,
    PERMISSIONS.ENTITY_VIEW,
    PERMISSIONS.RELATIONSHIP_VIEW,
    PERMISSIONS.GRAPH_VIEW,
    PERMISSIONS.REPORT_VIEW,
  ],
};

/**
 * Normalizes user role string to canonical enum key.
 */
export function normalizeRole(roleInput) {
  if (!roleInput) return ROLES.VIEWER;
  const str = typeof roleInput === 'object' ? (roleInput.value || roleInput.name || '') : String(roleInput);
  const normalized = str.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return ROLES[normalized] || normalized;
}

/**
 * Extracts all assigned normalized roles for a user.
 */
export function getUserRoles(user) {
  if (!user) return [ROLES.VIEWER];
  const roles = new Set();

  if (user.role) {
    roles.add(normalizeRole(user.role));
  }

  if (Array.isArray(user.roles)) {
    user.roles.forEach((r) => {
      roles.add(normalizeRole(r));
    });
  }

  if (roles.size === 0) {
    roles.add(ROLES.VIEWER);
  }

  return Array.from(roles);
}

/**
 * Resolves all effective permissions for a user.
 */
export function getUserPermissions(user) {
  if (!user) return new Set(ROLE_PERMISSIONS[ROLES.VIEWER]);

  const userRoles = getUserRoles(user);
  if (userRoles.includes(ROLES.SUPER_ADMIN)) {
    return new Set(Object.values(PERMISSIONS));
  }

  const effective = new Set();

  // Combine permissions from roles catalog
  userRoles.forEach((role) => {
    const defaultPerms = ROLE_PERMISSIONS[role] || [];
    defaultPerms.forEach((p) => effective.add(p));
  });

  // Combine direct permissions if granted by backend
  if (Array.isArray(user.permissions)) {
    user.permissions.forEach((p) => {
      if (typeof p === 'string') {
        effective.add(p.trim().toUpperCase());
      } else if (p && p.code) {
        effective.add(p.code.trim().toUpperCase());
      }
    });
  }

  return effective;
}

/**
 * Checks if a user has a specific granular permission.
 */
export function hasPermission(user, permission) {
  if (!user) return false;
  const userRoles = getUserRoles(user);
  if (userRoles.includes(ROLES.SUPER_ADMIN)) return true;

  const perms = getUserPermissions(user);
  const target = String(permission).trim().toUpperCase();
  return perms.has(target);
}

/**
 * Friendly action helper mapping common application actions to permissions.
 */
const ACTION_PERMISSION_MAP = {
  // Navigation / Tabs
  dashboard: PERMISSIONS.DASHBOARD_VIEW,
  graph: PERMISSIONS.GRAPH_VIEW,
  evidence: PERMISSIONS.EVIDENCE_VIEW,
  validation: PERMISSIONS.VALIDATION_VIEW,
  communities: PERMISSIONS.GRAPH_ANALYZE,
  connections: PERMISSIONS.GRAPH_ANALYZE,
  timeline: PERMISSIONS.GRAPH_VIEW,
  patterns: PERMISSIONS.GRAPH_ANALYZE,
  centrality: PERMISSIONS.GRAPH_ANALYZE,
  telecom: PERMISSIONS.GRAPH_VIEW,
  financial: PERMISSIONS.GRAPH_VIEW,
  vehicles: PERMISSIONS.GRAPH_VIEW,
  locations: PERMISSIONS.GRAPH_VIEW,
  reports: PERMISSIONS.REPORT_VIEW,
  notes: PERMISSIONS.NOTE_VIEW,
  audit: PERMISSIONS.AUDIT_VIEW,
  ingest: PERMISSIONS.EVIDENCE_UPLOAD,
  cases: PERMISSIONS.CASE_VIEW,
  admin: PERMISSIONS.USER_VIEW,

  // Action Buttons
  create_case: PERMISSIONS.CASE_CREATE,
  delete_case: PERMISSIONS.CASE_DELETE,
  upload_evidence: PERMISSIONS.EVIDENCE_UPLOAD,
  delete_evidence: PERMISSIONS.EVIDENCE_DELETE,
  merge_entity: PERMISSIONS.ENTITY_MERGE,
  create_entity: PERMISSIONS.ENTITY_CREATE,
  clear_graph: PERMISSIONS.GRAPH_CLEAR,
  reset_graph: PERMISSIONS.GRAPH_RESET,
  accept_validation: PERMISSIONS.VALIDATION_ACCEPT,
  reject_validation: PERMISSIONS.VALIDATION_REJECT,
  correct_validation: PERMISSIONS.VALIDATION_CORRECT,
  create_note: PERMISSIONS.NOTE_CREATE,
  delete_note: PERMISSIONS.NOTE_DELETE,
  export_report: PERMISSIONS.REPORT_EXPORT,
  create_user: PERMISSIONS.USER_CREATE,
  update_user: PERMISSIONS.USER_UPDATE,
  delete_user: PERMISSIONS.USER_DELETE,
  deactivate_user: PERMISSIONS.USER_DEACTIVATE,
  assign_role: PERMISSIONS.ROLE_ASSIGN,
};

/**
 * Checks if a user can perform an action or possesses a permission.
 */
export function can(user, actionOrPermission) {
  if (!user || !actionOrPermission) return false;
  const mapped = ACTION_PERMISSION_MAP[actionOrPermission.toLowerCase()] || actionOrPermission;
  return hasPermission(user, mapped);
}

/**
 * Checks if user has admin privileges (ADMIN or SUPER_ADMIN).
 */
export function isAdmin(user) {
  const roles = getUserRoles(user);
  return roles.includes(ROLES.ADMIN) || roles.includes(ROLES.SUPER_ADMIN);
}

/**
 * Checks if user is Super Admin.
 */
export function isSuperAdmin(user) {
  const roles = getUserRoles(user);
  return roles.includes(ROLES.SUPER_ADMIN);
}

/**
 * Tab Permission Mapping for Views
 */
export const TAB_PERMISSIONS = {
  dashboard: PERMISSIONS.DASHBOARD_VIEW,
  graph: PERMISSIONS.GRAPH_VIEW,
  evidence: PERMISSIONS.EVIDENCE_VIEW,
  validation: PERMISSIONS.VALIDATION_VIEW,
  communities: PERMISSIONS.GRAPH_ANALYZE,
  connections: PERMISSIONS.GRAPH_ANALYZE,
  timeline: PERMISSIONS.GRAPH_VIEW,
  patterns: PERMISSIONS.GRAPH_ANALYZE,
  centrality: PERMISSIONS.GRAPH_ANALYZE,
  telecom: PERMISSIONS.GRAPH_VIEW,
  financial: PERMISSIONS.GRAPH_VIEW,
  vehicles: PERMISSIONS.GRAPH_VIEW,
  locations: PERMISSIONS.GRAPH_VIEW,
  reports: PERMISSIONS.REPORT_VIEW,
  notes: PERMISSIONS.NOTE_VIEW,
  audit: PERMISSIONS.AUDIT_VIEW,
  ingest: PERMISSIONS.EVIDENCE_UPLOAD,
  cases: PERMISSIONS.CASE_VIEW,
  admin: PERMISSIONS.USER_VIEW,
};

/**
 * Case-Dependent Tabs:
 * Hidden completely when no investigation case is active or selected.
 */
export const CASE_DEPENDENT_TABS = new Set([
  'graph',
  'evidence',
  'validation',
  'communities',
  'connections',
  'timeline',
  'patterns',
  'centrality',
  'telecom',
  'financial',
  'vehicles',
  'locations',
  'reports',
  'notes',
  'ingest',
]);

/**
 * Checks whether the current user is authorized to open a specific tab.
 * When hasActiveCase is false, all case-dependent tabs are hidden completely.
 * Defaults to safe VIEWER role if user session is still loading to prevent permission flash.
 */
export function isTabAuthorized(user, tabId, hasActiveCase = true) {
  if (!tabId) return false;
  // If no case is active, case-dependent workspace tabs are strictly unauthorized/hidden
  if (!hasActiveCase && CASE_DEPENDENT_TABS.has(tabId)) {
    return false;
  }
  const perm = TAB_PERMISSIONS[tabId];
  if (!perm) return true; // Unprotected tabs
  const effectiveUser = user || { role: ROLES.VIEWER, roles: [ROLES.VIEWER], permissions: [] };
  return hasPermission(effectiveUser, perm);
}

/**
 * Filters navigation sections and items, returning only authorized options.
 * Empty sections are completely stripped so no orphaned headers remain.
 */
export function getAuthorizedNavItems(user, navSections, hasActiveCase = true) {
  if (!Array.isArray(navSections)) return [];

  return navSections
    .map((section) => {
      const filteredItems = (section.items || []).filter((item) => {
        return isTabAuthorized(user, item.id, hasActiveCase);
      });
      return {
        ...section,
        items: filteredItems,
      };
    })
    .filter((section) => section.items.length > 0);
}

/**
 * Finds the default authorized landing tab for a user.
 */
export function getDefaultAuthorizedTab(user, hasActiveCase = true) {
  const preferred = hasActiveCase
    ? ['graph', 'dashboard', 'cases', 'evidence', 'reports']
    : ['dashboard', 'cases', 'admin'];
  for (const tab of preferred) {
    if (isTabAuthorized(user, tab, hasActiveCase)) {
      return tab;
    }
  }
  return hasActiveCase ? 'graph' : 'cases';
}

