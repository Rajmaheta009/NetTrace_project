import React, { useState, useEffect } from 'react';
import {
  FolderLock,
  Plus,
  CheckCircle2,
  Shield,
  User,
  X,
  ArrowRight,
  RefreshCw,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { fetchCases, createCase, switchCase, switchUserRole, loginUser } from '../services/api';
import { can } from '../utils/permissions';

const CRIME_PROFILE_OPTIONS = [
  { id: 'murder_homicide', label: 'Murder / Homicide' },
  { id: 'kidnapping_abduction', label: 'Kidnapping / Abduction' },
  { id: 'robbery_theft', label: 'Robbery / Theft' },
  { id: 'cybercrime', label: 'Cybercrime' },
  { id: 'financial_fraud', label: 'Financial Fraud' },
  { id: 'drug_trafficking', label: 'Drug Trafficking' },
  { id: 'human_trafficking', label: 'Human Trafficking' },
  { id: 'extortion_blackmail', label: 'Extortion / Blackmail' },
  { id: 'smuggling', label: 'Smuggling' },
  { id: 'organized_crime', label: 'Organized Crime Network' },
  { id: 'missing_person', label: 'Missing Person / Unexplained Disappearance' },
];

const PRIORITY_OPTIONS = [
  { id: 'Critical', label: 'Critical', color: 'text-rose-400 bg-rose-950/40 border-rose-800/50' },
  { id: 'High', label: 'High Priority', color: 'text-amber-400 bg-amber-950/40 border-amber-800/50' },
  { id: 'Medium', label: 'Medium', color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/50' },
  { id: 'Low', label: 'Low', color: 'text-slate-400 bg-slate-800/40 border-slate-700/50' },
];

export function CaseSwitcherModal({ isOpen, onClose, activeCase, onCaseSwitched, currentUser }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('organized_crime');
  const [newPriority, setNewPriority] = useState('High');
  const [nameError, setNameError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchCases();
      setCases(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      load();
      setIsCreating(false);
      setNameError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSwitch = async (caseId) => {
    setLoading(true);
    try {
      await switchCase(caseId);
      if (onCaseSwitched) onCaseSwitched(caseId, true);
      onClose();
    } catch (err) {
      alert('Failed to switch case: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      setNameError('Case Name is required.');
      return;
    }
    setNameError('');
    setLoading(true);
    try {
      const created = await createCase(newName.trim(), newDesc.trim(), newType, newPriority);
      if (onCaseSwitched) onCaseSwitched(created.case_id, true);
      onClose();
    } catch (err) {
      alert('Failed to create case: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <FolderLock className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100">Case Investigation Files</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isCreating ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Select active workspace:</span>
              {can(currentUser, 'CASE_CREATE') && (
                <button
                  onClick={() => {
                    setNameError('');
                    setIsCreating(true);
                  }}
                  className="flex items-center space-x-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Case File</span>
                </button>
              )}
            </div>

            {cases.length === 0 && !loading ? (
              <div className="p-6 text-center bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                <FolderLock className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-xs font-bold text-slate-200">No Cases Found</p>
                <p className="text-[11px] text-slate-400">
                  You don't have any cases yet. Create your first case to start an investigation.
                </p>
                {can(currentUser, 'CASE_CREATE') && (
                  <button
                    onClick={() => {
                      setNameError('');
                      setIsCreating(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 cursor-pointer"
                  >
                    + Create First Case
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {cases.map((c) => {
                  const isActive = activeCase?.case_id === c.case_id;
                  return (
                    <div
                      key={c.case_id}
                      onClick={() => handleSwitch(c.case_id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isActive
                          ? 'bg-cyan-950/40 border-cyan-500/50 ring-1 ring-cyan-500/50 shadow-md'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold text-cyan-300">{c.case_id}</span>
                          <span className="text-xs font-bold text-slate-200">{c.case_name}</span>
                          {c.is_protected && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300">
                              Protected Default
                            </span>
                          )}
                        </div>
                        {isActive && (
                          <span className="flex items-center space-x-1 text-[10px] font-mono font-bold text-cyan-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        )}
                      </div>
                      {c.description && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {c.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-500 mt-2">
                        <span>Type: {c.investigation_type}</span>
                        <span>•</span>
                        <span>Priority: {c.priority}</span>
                        <span>•</span>
                        <span>Entities: {c.entity_count || 0}</span>
                        <span>•</span>
                        <span>Evidence: {c.evidence_count || 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">
                Case Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Operation Deep Shadow"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (e.target.value.trim()) setNameError('');
                }}
                className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-slate-200 focus:outline-none transition-colors ${
                  nameError ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-800 focus:border-cyan-500'
                }`}
              />
              {nameError && (
                <p className="text-[11px] font-semibold text-rose-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {nameError}
                </p>
              )}
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Description</label>
              <textarea
                rows={2}
                placeholder="Investigative scope, target syndicates, or briefing notes..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Crime Matrix</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
                >
                  {CRIME_PROFILE_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-2.5 bg-cyan-950/30 border border-cyan-900/40 rounded-xl text-[10px] text-cyan-300 font-mono">
              Auto-assigned sequence ID: <strong>CASE-{new Date().getFullYear()}-NNNN</strong>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ← Back to Case List
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create & Open Workspace'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function RoleSwitcherModal({ isOpen, onClose, currentUser, onRoleSwitched }) {
  const [activeTab, setActiveTab] = useState('switch'); // 'switch' | 'login'
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [authSuccess, setAuthSuccess] = useState(null);

  if (!isOpen) return null;

  const DEMO_ACCOUNTS = [
    { username: 'superadmin', role: 'SUPER_ADMIN', pass: 'SuperAdmin123!', label: 'Super Admin' },
    { username: 'admin', role: 'ADMIN', pass: 'Admin123!', label: 'Admin' },
    { username: 'investigator', role: 'INVESTIGATOR', pass: 'Investigator123!', label: 'Investigator' },
    { username: 'analyst', role: 'ANALYST', pass: 'Analyst123!', label: 'Analyst' },
    { username: 'reviewer', role: 'REVIEWER', pass: 'Reviewer123!', label: 'Reviewer' },
    { username: 'viewer', role: 'VIEWER', pass: 'Viewer123!', label: 'Viewer' },
  ];

  const roles = [
    {
      role: 'Super Admin',
      apiRole: 'SUPER_ADMIN',
      title: 'Super Admin (Director General)',
      desc: 'Supreme operational & administrative oversight: unrestricted case access, user accounts, system configuration, database management, and full audit authority.',
      color: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
    },
    {
      role: 'Admin',
      apiRole: 'ADMIN',
      title: 'Agency Administrator',
      desc: 'Supervisory privileges: case management, user administration, status assignment, cryptographic audit verification, and administrative wipe.',
      color: 'border-sky-500/40 bg-sky-950/20 text-sky-300',
    },
    {
      role: 'Investigator',
      apiRole: 'INVESTIGATOR',
      title: 'Forensic Investigator',
      desc: 'Full operational intelligence access: 3D graph exploration, evidence ingestion/registration, validation review, entity merging, and case dossiers.',
      color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
    },
    {
      role: 'Analyst',
      apiRole: 'ANALYST',
      title: 'Intelligence Analyst',
      desc: 'Analytical queries & evaluation: explore graph, investigate leads, create field notes, review & dismiss pattern findings, and export dossiers.',
      color: 'border-purple-500/40 bg-purple-950/20 text-purple-300',
    },
    {
      role: 'Reviewer',
      apiRole: 'REVIEWER',
      title: 'Data Quality Reviewer',
      desc: 'Formal validation review: accept, reject, or correct extraction items, verify graph relationships, and dismiss false-positive pattern findings.',
      color: 'border-indigo-500/40 bg-indigo-950/20 text-indigo-300',
    },
    {
      role: 'Viewer',
      apiRole: 'VIEWER',
      title: 'Executive Viewer / Auditor',
      desc: 'Strictly read-only oversight: inspect network visualizer, review AI intelligence briefings, view audit logs, and print forensic summaries.',
      color: 'border-slate-700 bg-slate-950/40 text-slate-300',
    },
  ];

  const handleSelectRole = async (roleName) => {
    setLoading(true);
    setAuthError(null);
    try {
      const updated = await switchUserRole(roleName);
      if (onRoleSwitched) onRoleSwitched(updated);
      onClose();
    } catch (err) {
      setAuthError('Failed to switch role: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setAuthError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    setAuthError(null);
    try {
      const res = await loginUser(username.trim(), password.trim());
      setAuthSuccess(`Authenticated successfully as ${res.user?.username || username}!`);
      if (onRoleSwitched && res.user) {
        onRoleSwitched({
          name: res.user.full_name || res.user.username,
          role: res.user.roles?.[0] || 'Admin',
          roles: res.user.roles || [],
          user_id: res.user.id,
          username: res.user.username,
        });
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setAuthError(err.message || 'Login failed. Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demo) => {
    setUsername(demo.username);
    setPassword(demo.pass);
    setAuthError(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100">Identity & Role Management</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Toggle: Quick Switch vs Real Login */}
        <div className="flex items-center p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => { setActiveTab('switch'); setAuthError(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'switch'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Quick Role Switch
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setAuthError(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'login'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Account Login (JWT)
          </button>
        </div>

        {authError && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{authError}</span>
          </div>
        )}

        {authSuccess && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{authSuccess}</span>
          </div>
        )}

        {activeTab === 'switch' ? (
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            <p className="text-xs text-slate-400 mb-1">
              Select an operational role tier to switch permissions in the active session:
            </p>
            {roles.map((r) => {
              const currentRoleVal = typeof currentUser?.role === 'string' ? currentUser.role : currentUser?.role?.value;
              const isSelected = currentRoleVal === r.role || currentRoleVal === r.apiRole;
              return (
                <div
                  key={r.role}
                  onClick={() => handleSelectRole(r.role)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? `${r.color} ring-1 ring-cyan-500/50 shadow-md`
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{r.title}</span>
                    {isSelected && (
                      <span className="flex items-center space-x-1 text-[10px] font-mono font-bold text-cyan-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active Role</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{r.desc}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Log in with an account to obtain cryptographically signed JWT access tokens and database permissions:
            </p>

            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Username or Email</label>
                <input
                  type="text"
                  placeholder="e.g. admin or superadmin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-lg transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{loading ? 'Authenticating...' : 'Sign In to Account'}</span>
              </button>
            </form>

            {/* Quick Demo Credentials */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-mono text-slate-400 block mb-2">
                Click to Auto-Fill Demo Credentials:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {DEMO_ACCOUNTS.map((demo) => (
                  <button
                    key={demo.username}
                    type="button"
                    onClick={() => fillDemoAccount(demo)}
                    className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/50 text-left transition-all group cursor-pointer"
                  >
                    <div className="text-[10px] font-bold text-slate-200 group-hover:text-cyan-300 truncate">
                      {demo.label}
                    </div>
                    <div className="text-[9px] font-mono text-slate-500 truncate">
                      {demo.username}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-800/70">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
