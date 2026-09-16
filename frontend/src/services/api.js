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
