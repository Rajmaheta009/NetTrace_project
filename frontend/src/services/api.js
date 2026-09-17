// NetTrace API Service Client
const API_BASE = '';

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function fetchGraph() {
  const res = await fetch(`${API_BASE}/api/graph`);
  if (!res.ok) throw new Error(`Failed to load graph: ${res.status}`);
  return res.json();
}

export async function fetchCentrality() {
  const res = await fetch(`${API_BASE}/api/graph/centrality`);
  if (!res.ok) throw new Error(`Failed to fetch centrality: ${res.status}`);
  return res.json();
}

export async function fetchPatterns() {
  const res = await fetch(`${API_BASE}/api/graph/patterns`);
  if (!res.ok) throw new Error(`Failed to fetch pattern flags: ${res.status}`);
  return res.json();
}

export async function fetchEntityDetail(entityId) {
  const res = await fetch(`${API_BASE}/api/graph/entity/${encodeURIComponent(entityId)}`);
  if (!res.ok) throw new Error(`Failed to load entity ${entityId}: ${res.status}`);
  return res.json();
}

export async function fetchSummary() {
  const res = await fetch(`${API_BASE}/api/graph/summary`);
  if (!res.ok) throw new Error(`Failed to fetch summary: ${res.status}`);
  return res.json();
}

export async function resetGraph(loadSample = false) {
  const url = loadSample ? `${API_BASE}/api/graph/reset?load_sample=true` : `${API_BASE}/api/graph/clear`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`Graph reset failed: ${res.status}`);
  return res.json();
}

export async function clearGraph() {
  const res = await fetch(`${API_BASE}/api/graph/clear`, { method: 'POST' });
  if (!res.ok) throw new Error(`Graph clear failed: ${res.status}`);
  return res.json();
}

export async function loadDemoGraph() {
  const res = await fetch(`${API_BASE}/api/graph/load-demo`, { method: 'POST' });
  if (!res.ok) throw new Error(`Demo load failed: ${res.status}`);
  return res.json();
}

export async function importText(content, type = null, sourceLabel = 'web_user') {
  const payload = { content, source_label: sourceLabel };
  if (type) payload.type = type;

  const res = await fetch(`${API_BASE}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Import failed with HTTP ${res.status}`);
  }
  return data;
}

export async function importFile(file, sourceLabel = '') {
  const formData = new FormData();
  formData.append('file', file);
  if (sourceLabel) formData.append('source_label', sourceLabel);

  const res = await fetch(`${API_BASE}/api/import/file`, {
    method: 'POST',
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
export async function logAuditAction(action, details = '', userId = 'Analyst_Officer_902') {
  try {
    const res = await fetch(`${API_BASE}/api/audit/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action, details }),
    });
    return await res.json();
  } catch (err) {
    console.warn('Audit logging failed:', err);
    return null;
  }
}

export async function fetchAuditTrail(limit = 100) {
  const res = await fetch(`${API_BASE}/api/audit/trail?limit=${limit}`);
  if (!res.ok) throw new Error(`Audit fetch failed: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Case Management APIs
// -------------------------------------------------------------
export async function fetchCases() {
  const res = await fetch(`${API_BASE}/api/cases`);
  if (!res.ok) throw new Error(`Failed to fetch cases: ${res.status}`);
  return res.json();
}

export async function createCase(caseName, description = '', investigationType = 'organized_crime') {
  const res = await fetch(`${API_BASE}/api/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ case_name: caseName, description, investigation_type: investigationType }),
  });
  if (!res.ok) throw new Error(`Failed to create case: ${res.status}`);
  return res.json();
}

export async function fetchActiveCase() {
  const res = await fetch(`${API_BASE}/api/cases/active/current`);
  if (!res.ok) throw new Error(`Failed to fetch active case: ${res.status}`);
  return res.json();
}

export async function switchCase(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/switch`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to switch case: ${res.status}`);
  return res.json();
}

export async function deleteCase(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete case: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Evidence Registry APIs
// -------------------------------------------------------------
export async function fetchEvidence(caseId = null) {
  const url = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/evidence` : `${API_BASE}/api/evidence`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch evidence: ${res.status}`);
  return res.json();
}

export async function registerEvidence(caseId, payload) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/evidence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to register evidence: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Community Detection APIs
// -------------------------------------------------------------
export async function fetchCommunities(caseId = null) {
  const url = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/communities` : `${API_BASE}/api/graph/communities`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch communities: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Connection Finder APIs
// -------------------------------------------------------------
export async function fetchConnections(sourceId, targetId, caseId = null) {
  const base = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/connections` : `${API_BASE}/api/graph/connections`;
  const url = `${base}?source_id=${encodeURIComponent(sourceId)}&target_id=${encodeURIComponent(targetId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to find connections: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Data Quality & Validation APIs
// -------------------------------------------------------------
export async function fetchValidationRecords(caseId = null) {
  const url = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/validation` : `${API_BASE}/api/validation`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch validation queue: ${res.status}`);
  return res.json();
}

export async function reviewValidationRecord(caseId, recordId, action, correctedPayload = null, reviewerNotes = '') {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/validation/${encodeURIComponent(recordId)}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch notes: ${res.status}`);
  return res.json();
}

export async function createNote(caseId, noteText, entityId = null, relationshipId = null, evidenceId = null) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  });
  if (!res.ok) throw new Error(`Failed to delete note: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Dossier / Report APIs
// -------------------------------------------------------------
export async function fetchCaseReport(caseId = null) {
  const url = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/report` : `${API_BASE}/api/graph/report`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to generate case dossier: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// User Profile & RBAC Role APIs
// -------------------------------------------------------------
export async function fetchCurrentUser() {
  const res = await fetch(`${API_BASE}/api/auth/me`);
  if (!res.ok) throw new Error(`Failed to fetch user profile: ${res.status}`);
  return res.json();
}

export async function switchUserRole(role) {
  const res = await fetch(`${API_BASE}/api/auth/switch-role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`Failed to switch role: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Crime Investigation Profiles & Dynamic Investigation Types
// -------------------------------------------------------------
export async function fetchCrimeProfiles() {
  const res = await fetch(`${API_BASE}/api/crime-profiles`);
  if (!res.ok) throw new Error(`Failed to fetch crime profiles: ${res.status}`);
  return res.json();
}

export async function fetchCrimeProfile(profileId) {
  const res = await fetch(`${API_BASE}/api/crime-profiles/${encodeURIComponent(profileId)}`);
  if (!res.ok) throw new Error(`Failed to fetch crime profile ${profileId}: ${res.status}`);
  return res.json();
}

export async function fetchCaseInvestigationProfile(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/investigation-profile`);
  if (!res.ok) throw new Error(`Failed to fetch case investigation profile: ${res.status}`);
  return res.json();
}

export async function updateCaseInvestigationType(caseId, investigationType) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/investigation-type`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ investigation_type: investigationType }),
  });
  if (!res.ok) throw new Error(`Failed to switch case investigation type: ${res.status}`);
  return res.json();
}

export async function fetchCaseInvestigationQuestions(caseId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/investigation-questions`);
  if (!res.ok) throw new Error(`Failed to fetch investigation questions: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Transparent Investigation Leads Prioritization
// -------------------------------------------------------------
export async function fetchCaseLeads(caseId = null) {
  const url = caseId ? `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/leads` : `${API_BASE}/api/graph/leads`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch investigation leads: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Full-Spectrum Deep Entity Inspection
// -------------------------------------------------------------
export async function fetchDeepEntityInspection(caseId, entityId) {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/entities/${encodeURIComponent(entityId)}/deep-inspection`);
  if (!res.ok) throw new Error(`Failed to perform deep inspection on ${entityId}: ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------
// Entity Resolution & Deduplication Merge
// -------------------------------------------------------------
export async function mergeEntities(caseId, sourceEntityId, targetEntityId, reason = 'Investigator verified duplicate identity') {
  const res = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseId)}/entities/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_entity_id: sourceEntityId,
      target_entity_id: targetEntityId,
      reason,
    }),
  });
  if (!res.ok) throw new Error(`Failed to merge entities: ${res.status}`);
  return res.json();
}
