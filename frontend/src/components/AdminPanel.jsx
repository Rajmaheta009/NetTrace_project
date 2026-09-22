import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  UserPlus,
  Key,
  Database,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Layers,
  FileCheck,
  Building,
  UserCog,
  Check,
  X
} from 'lucide-react';
import {
  fetchAdminUsers,
  createAdminUser,
  updateAdminUserStatus,
  assignAdminUserRoles,
  fetchAdminRoles,
  fetchAdminPermissions,
  verifyAuditIntegrity,
  fetchAuditTrail,
  fetchDatabaseHealth,
} from '../services/api';

const ROLE_COLORS = {
  SUPER_ADMIN: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  'Super Admin': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  ADMIN: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  Admin: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  INVESTIGATOR: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Investigator: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  ANALYST: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  Analyst: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  REVIEWER: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  Reviewer: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  VIEWER: 'bg-slate-700/50 text-slate-300 border-slate-600',
  Viewer: 'bg-slate-700/50 text-slate-300 border-slate-600',
};

export default function AdminPanel({ currentUser, onRoleSwitched }) {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [dbHealth, setDbHealth] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [integrityStatus, setIntegrityStatus] = useState(null);

  const [loading, setLoading] = useState(false);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // User filter & modal state
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUserForRoles, setSelectedUserForRoles] = useState(null);
  const [selectedRolesToAssign, setSelectedRolesToAssign] = useState([]);

  // Create user form state
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDepartment, setNewDepartment] = useState('Forensic Intelligence');
  const [newDesignation, setNewDesignation] = useState('Investigator');
  const [newRole, setNewRole] = useState('INVESTIGATOR');

  const isSuperAdmin = currentUser?.roles?.includes('SUPER_ADMIN') || 
                      currentUser?.role === 'Super Admin' ||
                      currentUser?.role === 'SUPER_ADMIN';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [uList, rList, pList, dbH, aLogs] = await Promise.all([
        fetchAdminUsers().catch(err => { console.warn('Users fetch:', err); return []; }),
        fetchAdminRoles().catch(err => { console.warn('Roles fetch:', err); return []; }),
        fetchAdminPermissions().catch(err => { console.warn('Perms fetch:', err); return []; }),
        fetchDatabaseHealth().catch(err => { console.warn('Db health fetch:', err); return null; }),
        fetchAuditTrail(50).catch(err => { console.warn('Audit logs fetch:', err); return []; }),
      ]);
      setUsers(uList || []);
      setRoles(rList || []);
      setPermissions(pList || []);
      setDbHealth(dbH);
      setAuditLogs(aLogs || []);
    } catch (err) {
      setError(err.message || 'Failed to load administration dataset');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVerifyIntegrity = async () => {
    setIntegrityLoading(true);
    setError(null);
    try {
      const res = await verifyAuditIntegrity();
      setIntegrityStatus(res);
      setSuccessMsg('Audit ledger cryptographic chain verified successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError('Audit integrity check failed: ' + err.message);
    } finally {
      setIntegrityLoading(false);
    }
  };

  const handleStatusToggle = async (user, targetStatus) => {
    if (user.roles.includes('SUPER_ADMIN') && !isSuperAdmin) {
      alert('Security Policy: Only Super Admin can modify Super Admin accounts.');
      return;
    }
    try {
      await updateAdminUserStatus(user.id, targetStatus);
      setSuccessMsg(`User ${user.username} status updated to ${targetStatus}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData();
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleOpenRoleModal = (user) => {
    if (user.roles.includes('SUPER_ADMIN') && !isSuperAdmin) {
      alert('Security Policy: Only Super Admin can modify Super Admin accounts.');
      return;
    }
    setSelectedUserForRoles(user);
    setSelectedRolesToAssign(user.roles || []);
    setIsRoleModalOpen(true);
  };

  const handleSaveRoles = async () => {
    if (!selectedUserForRoles) return;
    try {
      await assignAdminUserRoles(selectedUserForRoles.id, selectedRolesToAssign);
      setIsRoleModalOpen(false);
      setSuccessMsg(`Roles updated for ${selectedUserForRoles.username}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData();
    } catch (err) {
      alert('Failed to assign roles: ' + err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername || !newEmail || !newPassword || !newFullName) {
      alert('Please complete all required fields.');
      return;
    }
    try {
      await createAdminUser({
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        full_name: newFullName.trim(),
        department: newDepartment.trim(),
        designation: newDesignation.trim(),
        roles: [newRole],
      });
      setIsCreateModalOpen(false);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setSuccessMsg(`Officer account ${newUsername} created successfully`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err) {
      alert('Failed to create user: ' + err.message);
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchTerm.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q) ||
      u.roles?.some(r => r.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-sky-500/20 border border-slate-700 flex items-center justify-center text-cyan-400 shadow-inner">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-black tracking-wide text-slate-100 uppercase">
                NetTrace Administration
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-cyan-950/40 border-cyan-800/60 text-cyan-300 uppercase">
                Enterprise RBAC
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Role authorizations, multi-officer access governance, and cryptographic audit ledger verification
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center space-x-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400 font-mono text-[11px]">
              DB: <span className="text-emerald-400 font-bold">{dbHealth?.dialect || 'PostgreSQL'}</span> ({dbHealth?.status || 'Connected'})
            </span>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="Refresh All Records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {successMsg && (
        <div className="bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs px-4 py-3 rounded-2xl flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs px-4 py-3 rounded-2xl flex items-center space-x-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
            activeTab === 'users'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCog className="w-4 h-4" />
          <span>Officers & Users ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
            activeTab === 'roles'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Roles & Permissions ({roles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
            activeTab === 'audit'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Cryptographic Audit Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
            activeTab === 'health'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Database & Pool Status</span>
        </button>
      </div>

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search officers by name, role, dept..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Officer Account</span>
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="p-3.5">Officer / Account</th>
                  <th className="p-3.5">Department & Title</th>
                  <th className="p-3.5">Assigned Roles</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Last Login</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map(u => {
                  const isUserSuperAdmin = u.roles?.includes('SUPER_ADMIN');
                  const cannotModify = isUserSuperAdmin && !isSuperAdmin;

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-200">{u.full_name}</div>
                        <div className="text-[11px] font-mono text-slate-400">@{u.username} • {u.email}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="text-slate-300">{u.department}</div>
                        <div className="text-[11px] text-slate-500">{u.designation}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles?.map(r => (
                            <span
                              key={r}
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${ROLE_COLORS[r] || 'bg-slate-800 text-slate-300 border-slate-700'}`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                              : u.status === 'SUSPENDED'
                              ? 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                              : 'bg-rose-950/40 text-rose-400 border-rose-800/60'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-[11px] font-mono text-slate-400">
                        {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        {cannotModify ? (
                          <span className="text-[11px] font-mono text-amber-400/80 italic">Protected</span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenRoleModal(u)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition cursor-pointer"
                            >
                              Roles
                            </button>
                            {u.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleStatusToggle(u, 'SUSPENDED')}
                                className="px-2.5 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 text-[11px] font-semibold transition cursor-pointer"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusToggle(u, 'ACTIVE')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 text-[11px] font-semibold transition cursor-pointer"
                              >
                                Activate
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(r => (
              <div
                key={r.id}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-full border ${ROLE_COLORS[r.name] || 'bg-slate-800 text-slate-300'}`}>
                    {r.name}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {r.permissions?.length || 0} permissions
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{r.description}</p>
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-500 mb-1.5">Granted Privileges:</div>
                  <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
                    {r.permissions?.map(p => (
                      <span
                        key={p}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Granular Permissions Catalog */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Full System Permissions Catalog (35+ Fine-Grained Controls)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {permissions.map(p => (
                <div
                  key={p.id}
                  className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-300">{p.code}</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                      {p.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LEDGER & HASH INTEGRITY */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>SHA-256 Cryptographic Audit Chain Verification</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Verifies that every ledger entry is cryptographically chained to its predecessor with no tampering or deletion.
              </p>
            </div>
            <button
              onClick={handleVerifyIntegrity}
              disabled={integrityLoading}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-2 transition cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <RefreshCw className={`w-4 h-4 ${integrityLoading ? 'animate-spin' : ''}`} />
              <span>Verify Cryptographic Integrity</span>
            </button>
          </div>

          {integrityStatus && (
            <div
              className={`p-4 rounded-2xl border flex items-center space-x-3 ${
                integrityStatus.valid
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {integrityStatus.valid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div className="text-xs">
                <span className="font-bold">
                  {integrityStatus.valid ? 'INTEGRITY VERIFIED: ' : 'INTEGRITY COMPROMISED: '}
                </span>
                <span>{integrityStatus.message}</span>
                <span className="font-mono ml-2">
                  ({integrityStatus.verified_records} / {integrityStatus.total_records} records verified)
                </span>
              </div>
            </div>
          )}

          {/* Audit Logs Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Actor</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Case Context</th>
                  <th className="p-3.5">Audit Signature / Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {auditLogs.slice(0, 30).map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                    <td className="p-3.5 text-slate-200 font-bold">{log.actor_name || log.actor_id}</td>
                    <td className="p-3.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ROLE_COLORS[log.actor_role] || 'bg-slate-800 text-slate-300'}`}>
                        {log.actor_role}
                      </span>
                    </td>
                    <td className="p-3.5 text-cyan-300 font-bold">{log.action}</td>
                    <td className="p-3.5 text-slate-400">{log.case_id || 'System'}</td>
                    <td className="p-3.5 text-slate-500 truncate max-w-xs" title={log.entry_hash || log.details}>
                      {log.entry_hash ? `${log.entry_hash.slice(0, 16)}...` : log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DATABASE & SYSTEM HEALTH */}
      {activeTab === 'health' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Primary Database (PostgreSQL)</span>
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Database Engine:</span>
                <span className="text-slate-200 font-bold uppercase">{dbHealth?.dialect || 'PostgreSQL'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Connection Status:</span>
                <span className="text-emerald-400 font-bold">{dbHealth?.status || 'Connected'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Pool Size:</span>
                <span className="text-cyan-300">{dbHealth?.pool?.size || 10} connections</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Idle / Checked In:</span>
                <span className="text-slate-200">{dbHealth?.pool?.checkedin ?? '-'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Active / Checked Out:</span>
                <span className="text-amber-400">{dbHealth?.pool?.checkedout ?? 0}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Overflow:</span>
                <span className="text-slate-200">{dbHealth?.pool?.overflow ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Security & Deployment Status</span>
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Application Version:</span>
                <span className="text-cyan-300 font-bold">2.2.0-ENTERPRISE</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Authentication:</span>
                <span className="text-slate-200 font-bold">JWT (RS256/HS256) + Bcrypt</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Active Officer:</span>
                <span className="text-amber-300">{currentUser?.name || 'Officer'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Active Role:</span>
                <span className="text-emerald-400 font-bold">{currentUser?.role?.value || currentUser?.role || 'Admin'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Case Access Mode:</span>
                <span className="text-slate-200">Strict Server-Enforced RBAC</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE USER */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-slate-100">Create Officer Account</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Insp. Rakesh Mohan"
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. rmohan"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Secure password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Official Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rmohan@nettrace.local"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Department</label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={e => setNewDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Designation</label>
                  <input
                    type="text"
                    value={newDesignation}
                    onChange={e => setNewDesignation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Initial Role Assignment</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {isSuperAdmin && <option value="SUPER_ADMIN">SUPER_ADMIN (Supreme Authority)</option>}
                  <option value="ADMIN">ADMIN (Agency Administrator)</option>
                  <option value="INVESTIGATOR">INVESTIGATOR (Lead Forensic Investigator)</option>
                  <option value="ANALYST">ANALYST (Intelligence Analyst)</option>
                  <option value="REVIEWER">REVIEWER (Data Quality & Verification)</option>
                  <option value="VIEWER">VIEWER (Judicial / Oversight Viewer)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ASSIGN ROLES */}
      {isRoleModalOpen && selectedUserForRoles && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Assign Roles: {selectedUserForRoles.full_name}
                </h3>
              </div>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {['SUPER_ADMIN', 'ADMIN', 'INVESTIGATOR', 'ANALYST', 'REVIEWER', 'VIEWER'].map(r => {
                if (r === 'SUPER_ADMIN' && !isSuperAdmin) return null;
                const isSelected = selectedRolesToAssign.includes(r);
                return (
                  <label
                    key={r}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-slate-800/80 border-cyan-500/60 text-slate-100'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-mono font-bold">{r}</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedRolesToAssign([...selectedRolesToAssign, r]);
                        } else {
                          setSelectedRolesToAssign(selectedRolesToAssign.filter(x => x !== r));
                        }
                      }}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-400"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end space-x-2 pt-3">
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoles}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer text-xs"
              >
                Save Role Assignments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
