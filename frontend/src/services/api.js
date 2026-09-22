// NetTrace API Service Client
const API_BASE = '';

// Helper to append session headers if present
function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const token = sessionStorage.getItem('nettrace_token') || localStorage.getItem('nettrace_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const role = sessionStorage.getItem('nettrace_role') || localStorage.getItem('nettrace_role');
  if (role) {
    headers['X-User-Role'] = role;
  }
  return headers;
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function fetchGraph() {
  const res = await fetch(`${API_BASE}/api/graph`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to load graph: ${res.status}`);
  return res.json();
}

export async function fetchCentrality() {
  const res = await fetch(`${API_BASE}/api/graph/centrality`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch centrality: ${res.status}`);
  return res.json();
}

export async function fetchPatterns(caseId = null) {
  const url = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/patterns` : `${API_BASE}/api/graph/patterns`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch pattern flags: ${res.status}`);
  return res.json();
}

export async function reviewPatternFinding(caseId, findingId, action, notes = '') {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/patterns/${encodeURIComponent(findingId)}/review`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ action, notes }),
  });
  if (!res.ok) throw new Error(`Failed to review pattern finding: ${res.status}`);
  return res.json();
}

export async function fetchEntityDetail(entityId) {
  const res = await fetch(`${API_BASE}/api/graph/entity/${encodeURIComponent(entityId)}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to load entity ${entityId}: ${res.status}`);
  return res.json();
}

export async function fetchSummary() {
  const res = await fetch(`${API_BASE}/api/graph/summary`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch summary: ${res.status}`);
  return res.json();
}

export async function resetGraph(loadSample = false) {
  const url = loadSample ? `${API_BASE}/api/graph/reset?load_sample=true` : `${API_BASE}/api/graph/clear`;
  const res = await fetch(url, { method: 'POST', headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Graph reset failed: ${res.status}`);
  return res.json();
}

export async function clearGraph() {
  const res = await fetch(`${API_BASE}/api/graph/clear`, { method: 'POST', headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Graph clear failed: ${res.status}`);
  return res.json();
}

export async function loadDemoGraph() {
  const res = await fetch(`${API_BASE}/api/graph/load-demo`, { method: 'POST', headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Demo load failed: ${res.status}`);
  return res.json();
}

export async function importText(content, type = null, sourceLabel = 'web_user', caseId = null) {
  const payload = { content, source_label: sourceLabel };
  if (type) payload.type = type;
  if (caseId) payload.case_id = caseId;

  const res = await fetch(`${API_BASE}/api/import`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Import failed with HTTP ${res.status}`);
  }
  return data;
}

export async function importFile(file, sourceLabel = '', caseId = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (sourceLabel) formData.append('source_label', sourceLabel);
  if (caseId) formData.append('case_id', caseId);

  const res = await fetch(`${API_BASE}/api/import/file`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `File upload failed with HTTP ${res.status}`);
  }
  return data;
}

// -------------------------------------------------------------
// Security Activity & Audit Logger APIs
// -------------------------------------------------------------
export async function logAuditAction(action, details = '', caseId = null, resourceId = null) {
  try {
    const res = await fetch(`${API_BASE}/api/audit/log`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action, details, case_id: caseId, resource_id: resourceId }),
    });
    return await res.json();
  } catch (err) {
    console.warn('Audit logging failed:', err);
    return null;
  }
}

export async function fetchAuditTrail(limit = 100) {
  const res = await fetch(`${API_BASE}/api/audit/trail?limit=${limit}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Audit fetch failed: ${res.status}`);
  return res.json();
}

export async function verifyAuditIntegrity() {
  const res = await fetch(`${API_BASE}/api/audit/verify`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Audit integrity verification failed: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Case Management APIs
// -------------------------------------------------------------
export async function fetchCases() {
  const res = await fetch(`${API_BASE}/api/cases`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch cases: ${res.status}`);
  return res.json();
}

export async function createCase(caseName, description = '', investigationType = 'organized_crime', priority = 'High') {
  const res = await fetch(`${API_BASE}/api/cases`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      case_name: caseName,
      description,
      investigation_type: investigationType,
      priority,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create case: ${res.status}`);
  }
  return res.json();
}

export async function updateCase(caseId, payload) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update case: ${res.status}`);
  }
  return res.json();
}

export async function fetchActiveCase() {
  const res = await fetch(`${API_BASE}/api/cases/active/current`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch active case: ${res.status}`);
  return res.json();
}

export async function switchCase(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/switch`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to switch case: ${res.status}`);
  return res.json();
}

export async function deleteCase(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete case: ${res.status}`);
  }
  return res.json();
}

export async function clearCaseGraph(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/clear-graph`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to clear graph: ${res.status}`);
  return res.json();
}

export async function resetCaseInvestigation(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/reset-investigation`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to reset investigation: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Evidence Registry APIs
// -------------------------------------------------------------
export async function fetchEvidence(caseId = null) {
  const url = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/evidence` : `${API_BASE}/api/evidence`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch evidence: ${res.status}`);
  return res.json();
}

export async function registerEvidence(caseId, payload) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/evidence`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to register evidence: ${res.status}`);
  return res.json();
}

export async function fetchRelationshipLineage(caseId, relationshipId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/relationships/${encodeURIComponent(relationshipId)}/lineage`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch relationship lineage: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Community Detection APIs
// -------------------------------------------------------------
export async function fetchCommunities(caseId = null) {
  const url = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/communities` : `${API_BASE}/api/graph/communities`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch communities: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Connection Finder APIs
// -------------------------------------------------------------
export async function fetchConnections(sourceId, targetId, caseId = null) {
  const base = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/connections` : `${API_BASE}/api/graph/connections`;
  const url = `${base}?source_id=${encodeURIComponent(sourceId)}&target_id=${encodeURIComponent(targetId)}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to find connections: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Data Quality & Validation APIs
// -------------------------------------------------------------
export async function fetchValidationRecords(caseId = null) {
  const url = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/validation` : `${API_BASE}/api/validation`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch validation queue: ${res.status}`);
  return res.json();
}

export async function reviewValidationRecord(caseId, recordId, action, correctedPayload = null, reviewerNotes = '') {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/validation/${encodeURIComponent(recordId)}/review`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ action, corrected_payload: correctedPayload, reviewer_notes: reviewerNotes }),
  });
  if (!res.ok) throw new Error(`Failed to review validation record: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Investigation Notes APIs
// -------------------------------------------------------------
export async function fetchNotes(caseId = null) {
  const url = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/notes` : `${API_BASE}/api/notes`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch notes: ${res.status}`);
  return res.json();
}

export async function createNote(caseId, noteText, entityId = null, relationshipId = null, evidenceId = null) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/notes`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      note_text: noteText,
      entity_id: entityId,
      relationship_id: relationshipId,
      evidence_id: evidenceId,
    }),
  });
  if (!res.ok) throw new Error(`Failed to save note: ${res.status}`);
  return res.json();
}

export async function deleteNote(caseId, noteId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/notes/${encodeURIComponent(noteId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete note: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Dossier / Report APIs
// -------------------------------------------------------------
export async function fetchCaseReport(caseId = null) {
  const url = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/report` : `${API_BASE}/api/graph/report`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to generate case dossier: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// User Profile & RBAC Role APIs
// -------------------------------------------------------------
export async function fetchCurrentUser() {
  const res = await fetch(`${API_BASE}/api/auth/me`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch user profile: ${res.status}`);
  return res.json();
}

export async function switchUserRole(role) {
  const res = await fetch(`${API_BASE}/api/auth/switch-role`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`Failed to switch role: ${res.status}`);
  const user = await res.json();
  if (user && user.role) {
    sessionStorage.setItem('nettrace_role', typeof user.role === 'string' ? user.role : user.role.value);
  }
  return user;
}

// -------------------------------------------------------------
// Crime Investigation Profiles & Dynamic Investigation Types
// -------------------------------------------------------------
export async function fetchCrimeProfiles() {
  const res = await fetch(`${API_BASE}/api/crime-profiles`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch crime profiles: ${res.status}`);
  return res.json();
}

export async function fetchCrimeProfile(profileId) {
  const res = await fetch(`${API_BASE}/api/crime-profiles/${encodeURIComponent(profileId)}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch crime profile ${profileId}: ${res.status}`);
  return res.json();
}

export async function fetchCaseInvestigationProfile(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/investigation-profile`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch case investigation profile: ${res.status}`);
  return res.json();
}

export async function updateCaseInvestigationType(caseId, investigationType) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/investigation-type`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ investigation_type: investigationType }),
  });
  if (!res.ok) throw new Error(`Failed to switch case investigation type: ${res.status}`);
  return res.json();
}

export async function fetchCaseInvestigationQuestions(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/investigation-questions`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch investigation questions: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Transparent Investigation Leads Prioritization
// -------------------------------------------------------------
export async function fetchCaseLeads(caseId = null) {
  const url = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/leads` : `${API_BASE}/api/graph/leads`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch investigation leads: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Full-Spectrum Deep Entity Inspection
// -------------------------------------------------------------
export async function fetchDeepEntityInspection(caseId, entityId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/entities/${encodeURIComponent(entityId)}/deep-inspection`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to perform deep inspection on ${entityId}: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Entity Resolution & Traceable Merge
// -------------------------------------------------------------
export async function mergeEntities(caseId, sourceEntityId, targetEntityId, reason = 'Investigator verified duplicate identity') {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/entities/merge`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      source_entity_id: sourceEntityId,
      target_entity_id: targetEntityId,
      reason,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to merge entities: ${res.status}`);
  }
  return res.json();
}

export async function fetchEntityMerges(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/merges`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch entity merges: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Relationship Crime Inference API
// -------------------------------------------------------------
export async function inferRelationshipCrime(payload) {
  const res = await fetch(`${API_BASE}/api/graph/relationship/infer-crime`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to infer relationship crime: ${res.status}`);
  return res.json();
}

export async function fetchRelationshipCrimeInference(caseId, relationshipId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/relationships/${encodeURIComponent(relationshipId)}/crime-inference`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch relationship crime inference: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Authentication & Session Management
// -------------------------------------------------------------
export async function loginUser(usernameOrEmail, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username_or_email: usernameOrEmail, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Login failed: HTTP ${res.status}`);
  }
  if (data.access_token) {
    localStorage.setItem('nettrace_token', data.access_token);
    sessionStorage.setItem('nettrace_token', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('nettrace_refresh_token', data.refresh_token);
    }
    const primaryRole = (data.user && data.user.roles && data.user.roles[0]) || 'Viewer';
    localStorage.setItem('nettrace_role', primaryRole);
    sessionStorage.setItem('nettrace_role', primaryRole);
  }
  return data;
}

export async function registerUser(userData) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Registration failed: HTTP ${res.status}`);
  }
  return data;
}

export async function refreshAuthToken() {
  const refreshToken = localStorage.getItem('nettrace_refresh_token');
  if (!refreshToken) return null;
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    localStorage.removeItem('nettrace_token');
    localStorage.removeItem('nettrace_refresh_token');
    sessionStorage.removeItem('nettrace_token');
    return null;
  }
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem('nettrace_token', data.access_token);
    sessionStorage.setItem('nettrace_token', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('nettrace_refresh_token', data.refresh_token);
    }
  }
  return data;
}

export async function logoutUser() {
  const refreshToken = localStorage.getItem('nettrace_refresh_token');
  try {
    if (refreshToken) {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    }
  } catch (e) {
    // Ignore network errors on logout
  }
  localStorage.removeItem('nettrace_token');
  localStorage.removeItem('nettrace_refresh_token');
  localStorage.removeItem('nettrace_role');
  sessionStorage.removeItem('nettrace_token');
  sessionStorage.removeItem('nettrace_role');
  return { status: 'ok' };
}

export async function fetchDatabaseHealth() {
  const res = await fetch(`${API_BASE}/health/db`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { status: 'unhealthy', error: data.detail || `HTTP ${res.status}` };
  }
  return res.json();
}

// -------------------------------------------------------------
// Administration: Users, Roles & Permissions
// -------------------------------------------------------------
export async function fetchAdminUsers() {
  const res = await fetch(`${API_BASE}/api/admin/users`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch users: HTTP ${res.status}`);
  }
  return res.json();
}

export async function createAdminUser(userData) {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(userData),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Failed to create user: HTTP ${res.status}`);
  }
  return data;
}

export async function updateAdminUser(userId, updateData) {
  const res = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updateData),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Failed to update user: HTTP ${res.status}`);
  }
  return data;
}

export async function updateAdminUserStatus(userId, status) {
  const res = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}/status`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Failed to update status: HTTP ${res.status}`);
  }
  return data;
}

export async function assignAdminUserRoles(userId, roles) {
  const res = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}/roles`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ roles }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Failed to assign roles: HTTP ${res.status}`);
  }
  return data;
}

export async function fetchAdminRoles() {
  const res = await fetch(`${API_BASE}/api/admin/roles`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch roles: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchAdminPermissions() {
  const res = await fetch(`${API_BASE}/api/admin/permissions`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch permissions: HTTP ${res.status}`);
  }
  return res.json();
}

// -------------------------------------------------------------
// Case User Assignments
// -------------------------------------------------------------
export async function fetchCaseUsers(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/users`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch case users: HTTP ${res.status}`);
  }
  return res.json();
}

export async function assignCaseUser(caseId, userId, caseRole = 'INVESTIGATOR') {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/users`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user_id: userId, case_role: caseRole }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Failed to assign case user: HTTP ${res.status}`);
  }
  return data;
}

export async function removeCaseUser(caseId, userId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Failed to unassign user: HTTP ${res.status}`);
  }
  return data;
}

