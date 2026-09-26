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
  X,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Activity,
  FileText,
  ListFilter,
  Edit3,
  Trash2,
  UserMinus
} from 'lucide-react';
import {
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  updateAdminUserStatus,
  assignAdminUserRoles,
  fetchAdminRoles,
  fetchAdminPermissions,
  verifyAuditIntegrity,
  fetchAuditTrail,
  fetchDatabaseHealth,
  fetchAuditActivity,
  fetchInspectorIndicators,
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
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [newDepartment, setNewDepartment] = useState('Forensic Intelligence');
  const [newDesignation, setNewDesignation] = useState('Investigator');
  const [newRole, setNewRole] = useState('INVESTIGATOR');
  const [createValidationError, setCreateValidationError] = useState('');

  // Edit user form state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editPassword, setEditPassword] = useState('');
  const [editValidationError, setEditValidationError] = useState('');

  // Delete / Deactivate modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');

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

  // Inspector Activity & Factual Indicators State
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLimit, setActivityLimit] = useState(25);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);

  // Multi-Filter State
  const [filterInspector, setFilterInspector] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterCaseId, setFilterCaseId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  // Factual Indicators State
  const [selectedInspectorForIndicators, setSelectedInspectorForIndicators] = useState('');
  const [indicatorsData, setIndicatorsData] = useState(null);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);

  const loadActivityLogs = useCallback(async () => {
    setActivityLoading(true);
    try {
      const params = {
        page: activityPage,
        limit: activityLimit,
        sort_order: sortOrder,
      };
      if (filterInspector) params.user_id = filterInspector;
      if (filterRole) params.role = filterRole;
      if (filterAction) params.action = filterAction;
      if (filterCaseId) params.case_id = filterCaseId.trim();
      if (filterStatus) params.status = filterStatus;
      if (filterQuery) params.q = filterQuery.trim();

      const res = await fetchAuditActivity(params);
      setActivityLogs(res?.logs || []);
      setActivityTotal(res?.total || 0);
      setActivityTotalPages(res?.total_pages || 1);
    } catch (err) {
      console.warn('Failed to load inspector activity:', err);
    } finally {
      setActivityLoading(false);
    }
  }, [activityPage, activityLimit, sortOrder, filterInspector, filterRole, filterAction, filterCaseId, filterStatus, filterQuery]);

  const loadIndicators = useCallback(async (userId = null) => {
    setIndicatorsLoading(true);
    try {
      const res = await fetchInspectorIndicators(userId || null);
      setIndicatorsData(res);
    } catch (err) {
      console.warn('Failed to load factual indicators:', err);
    } finally {
      setIndicatorsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'activity') {
      loadActivityLogs();
      loadIndicators(selectedInspectorForIndicators || null);
    }
  }, [activeTab, loadActivityLogs, loadIndicators, selectedInspectorForIndicators]);

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
    if (user.roles?.includes('SUPER_ADMIN') && !isSuperAdmin) {
      alert('Security Policy: Only Super Admin can modify Super Admin accounts.');
      return;
    }
    if ((user.id === currentUser?.user_id || user.id === currentUser?.id) && targetStatus !== 'ACTIVE') {
      alert('Security Violation: You cannot deactivate or suspend your own account.');
      return;
    }
    if (user.roles?.includes('SUPER_ADMIN') && targetStatus !== 'ACTIVE') {
      const activeSuperAdmins = users.filter(u => u.roles?.includes('SUPER_ADMIN') && u.status === 'ACTIVE');
      if (activeSuperAdmins.length <= 1) {
        alert('Security Violation: Cannot deactivate or suspend the last remaining Super Admin account (Administrative Lockout Prevention).');
        return;
      }
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
    if (user.roles?.includes('SUPER_ADMIN') && !isSuperAdmin) {
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

  const handleOpenEditModal = (user) => {
    const isTargetSuperAdmin = user.roles?.includes('SUPER_ADMIN');
    if (isTargetSuperAdmin && !isSuperAdmin) {
      alert('Security Policy: Only Super Admin can modify Super Admin accounts.');
      return;
    }
    setSelectedUserForEdit(user);
    setEditFullName(user.full_name || '');
    setEditEmail(user.email || '');
    setEditDepartment(user.department || 'Forensic Intelligence');
    setEditDesignation(user.designation || 'Investigator');
    setEditStatus(user.status || 'ACTIVE');
    setEditPassword('');
    setEditValidationError('');
    setIsEditModalOpen(true);
  };

  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;
    setEditValidationError('');

    if (!editFullName.trim() || !editEmail.trim()) {
      setEditValidationError('Full Name and Official Email are required fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail.trim())) {
      setEditValidationError('Please enter a valid official email address format.');
      return;
    }

    if (editPassword && (editPassword.length < 8 || !/[a-zA-Z]/.test(editPassword) || !/[0-9]/.test(editPassword))) {
      setEditValidationError('New password must be at least 8 characters long and contain both letters and digits.');
      return;
    }

    const payload = {
      full_name: editFullName.trim(),
      email: editEmail.trim(),
      department: editDepartment.trim(),
      designation: editDesignation.trim(),
      status: editStatus,
    };
    if (editPassword) {
      payload.password = editPassword;
    }

    try {
      await updateAdminUser(selectedUserForEdit.id, payload);
      setIsEditModalOpen(false);
      setSuccessMsg(`Officer profile for ${selectedUserForEdit.username} updated successfully.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData();
    } catch (err) {
      setEditValidationError(err.message || 'Failed to update officer profile');
    }
  };

  const handleOpenDeleteModal = (user) => {
    if (user.id === currentUser?.user_id || user.id === currentUser?.id) {
      alert('Security Violation: You cannot delete or deactivate your own account.');
      return;
    }
    const isTargetSuperAdmin = user.roles?.includes('SUPER_ADMIN');
    if (isTargetSuperAdmin && !isSuperAdmin) {
      alert('Security Policy: Only Super Admin can delete or deactivate Super Admin accounts.');
      return;
    }
    const activeSuperAdmins = users.filter(u => u.roles?.includes('SUPER_ADMIN') && u.status === 'ACTIVE');
    if (isTargetSuperAdmin && activeSuperAdmins.length <= 1) {
      alert('Security Violation: Cannot deactivate or delete the last remaining Super Admin account (Administrative Lockout Prevention).');
      return;
    }
    setSelectedUserForDelete(user);
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUserForDelete) return;
    try {
      await deleteAdminUser(selectedUserForDelete.id);
      setIsDeleteModalOpen(false);
      setSuccessMsg(`Officer account ${selectedUserForDelete.username} deactivated successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err) {
      setDeleteError(err.message || 'Failed to deactivate user account');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateValidationError('');

    if (!newUsername.trim() || !newEmail.trim() || !newPassword || !newFullName.trim()) {
      setCreateValidationError('Please complete all required fields (*).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setCreateValidationError('Please provide a valid official email address format.');
      return;
    }

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setCreateValidationError('Password must be at least 8 characters long and contain both letters and digits.');
      return;
    }

    if (newConfirmPassword && newPassword !== newConfirmPassword) {
      setCreateValidationError('Passwords do not match. Please verify your confirmation password.');
      return;
    }

    try {
      await createAdminUser({
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        confirm_password: newConfirmPassword,
        full_name: newFullName.trim(),
        department: newDepartment.trim(),
        designation: newDesignation.trim(),
        roles: [newRole],
      });
      setIsCreateModalOpen(false);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewConfirmPassword('');
      setNewFullName('');
      setSuccessMsg(`Officer account ${newUsername} created successfully`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err) {
      setCreateValidationError(err.message || 'Failed to create officer account');
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
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
            activeTab === 'activity'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4 text-amber-400" />
          <span>Inspector Activity & Indicators</span>
          {isSuperAdmin && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-[10px] font-mono text-amber-300 border border-amber-500/30">
              Super Admin
            </span>
          )}
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
                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {cannotModify ? (
                          <span className="text-[11px] font-mono text-amber-400/80 italic">Protected</span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition cursor-pointer inline-flex items-center space-x-1"
                              title="Edit Officer Profile"
                            >
                              <Edit3 className="w-3 h-3 text-cyan-400" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleOpenRoleModal(u)}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition cursor-pointer inline-flex items-center space-x-1"
                              title="Assign Roles"
                            >
                              <Key className="w-3 h-3 text-amber-400" />
                              <span>Roles</span>
                            </button>
                            {u.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleStatusToggle(u, 'SUSPENDED')}
                                className="px-2 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 text-[11px] font-semibold transition cursor-pointer"
                                title="Suspend Account"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusToggle(u, 'ACTIVE')}
                                className="px-2 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 text-[11px] font-semibold transition cursor-pointer"
                                title="Activate Account"
                              >
                                Activate
                              </button>
                            )}
                            {u.id !== currentUser?.user_id && u.id !== currentUser?.id && (
                              <button
                                onClick={() => handleOpenDeleteModal(u)}
                                className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-[11px] font-semibold transition cursor-pointer inline-flex items-center space-x-1"
                                title="Deactivate / Soft Delete Account"
                              >
                                <Trash2 className="w-3 h-3 text-rose-400" />
                                <span>Deactivate</span>
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

      {/* TAB: INSPECTOR ACTIVITY & FACTUAL INDICATORS */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          
          {/* SECTION 1: FACTUAL INDICATOR ANALYSIS & BEHAVIOR PROFILE */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-black text-white uppercase tracking-wider font-mono">
                    Inspector Activity & Behavioral Profile (Factual Indicators)
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                  {indicatorsData?.note || 'Objective system metric counters for administrative oversight. NetTrace tracks exact security events without subjective behavioral classifications.'}
                </p>
              </div>

              {/* Inspector Selector for Behavioral Profile */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-400 whitespace-nowrap">Inspector Profile:</span>
                <select
                  value={selectedInspectorForIndicators}
                  onChange={(e) => setSelectedInspectorForIndicators(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-400/60 font-mono font-bold"
                >
                  <option value="">All Inspectors Combined (Aggregate)</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.full_name} - {u.roles?.[0] || 'Investigator'})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => loadIndicators(selectedInspectorForIndicators || null)}
                  disabled={indicatorsLoading}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  title="Refresh Indicators"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${indicatorsLoading ? 'animate-spin text-amber-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Factual Metric Cards Grid */}
            {(() => {
              const currentIndicators = indicatorsData?.indicators || indicatorsData?.summary || {};
              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                    
                    {/* Card 1: Failed Logins */}
                    <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-2 hover:border-slate-700 transition shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">Failed Logins</span>
                        <div className={`p-2 rounded-xl ${Number(currentIndicators.failed_login_attempts || 0) > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-900 text-slate-500'}`}>
                          <Lock className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-black font-mono text-white">
                        {currentIndicators.failed_login_attempts ?? 0}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {Number(currentIndicators.failed_login_attempts || 0) > 0 ? 'Recorded authentication failures' : 'No recorded login failures'}
                      </p>
                    </div>

                    {/* Card 2: Deleted Records */}
                    <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-2 hover:border-slate-700 transition shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">Deleted Records</span>
                        <div className={`p-2 rounded-xl ${Number(currentIndicators.deleted_records || 0) > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-900 text-slate-500'}`}>
                          <UserX className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-black font-mono text-white">
                        {currentIndicators.deleted_records ?? 0}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {Number(currentIndicators.deleted_records || 0) > 0 ? 'Entities or links removed' : 'Zero deletions logged'}
                      </p>
                    </div>

                    {/* Card 3: Large Data Exports */}
                    <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-2 hover:border-slate-700 transition shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">Data Exports</span>
                        <div className={`p-2 rounded-xl ${Number(currentIndicators.large_data_exports || 0) > 0 ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-900 text-slate-500'}`}>
                          <Download className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-black font-mono text-white">
                        {currentIndicators.large_data_exports ?? 0}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {Number(currentIndicators.large_data_exports || 0) > 0 ? 'Dossier & report extractions' : 'No mass exports recorded'}
                      </p>
                    </div>

                    {/* Card 4: Permission Denials (403) */}
                    <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-2 hover:border-slate-700 transition shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">Access Denials</span>
                        <div className={`p-2 rounded-xl ${Number(currentIndicators.permission_errors || 0) > 0 ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-900 text-slate-500'}`}>
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-black font-mono text-white">
                        {currentIndicators.permission_errors ?? 0}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {Number(currentIndicators.permission_errors || 0) > 0 ? 'RBAC 403 access rejections' : 'Zero unauthorized attempts'}
                      </p>
                    </div>

                    {/* Card 5: Successful Operations */}
                    <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-2 hover:border-slate-700 transition shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">Successful Actions</span>
                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-black font-mono text-emerald-400">
                        {currentIndicators.successful_operations ?? 0}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Total completed operations
                      </p>
                    </div>

                  </div>

                  {/* Factual Bullet Points if present */}
                  {Array.isArray(indicatorsData?.factual_indicators) && indicatorsData.factual_indicators.length > 0 && (
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5 text-xs font-mono text-slate-300">
                      <div className="text-[11px] font-bold text-amber-400 flex items-center space-x-1.5">
                        <ListFilter className="w-3.5 h-3.5" />
                        <span>Factual Event Highlights:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-slate-400">
                        {indicatorsData.factual_indicators.map((stmt, sIdx) => (
                          <li key={sIdx} className="text-slate-300">{stmt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* SECTION 2: INSPECTOR ACTIVITY LOG (MULTI-FILTER & PAGINATED) */}
          <div className="space-y-4">
            
            {/* Filter Bar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                
                {/* Search Query */}
                <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search action or details..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                {/* Filter Inspector */}
                <select
                  value={filterInspector}
                  onChange={(e) => setFilterInspector(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="">All Inspectors</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                  ))}
                </select>

                {/* Filter Role */}
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="">All Roles</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="INVESTIGATOR">INVESTIGATOR</option>
                  <option value="ANALYST">ANALYST</option>
                  <option value="REVIEWER">REVIEWER</option>
                  <option value="VIEWER">VIEWER</option>
                </select>

                {/* Filter Action */}
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="">All Actions</option>
                  <option value="login">Login</option>
                  <option value="failed_login">Failed Login</option>
                  <option value="delete">Delete Records</option>
                  <option value="export">Data Export</option>
                  <option value="permission_denied">Permission Denied (403)</option>
                  <option value="update">Update</option>
                  <option value="read">Read / Inspect</option>
                  <option value="insert">Ingest / Insert</option>
                </select>

                {/* Filter Status */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure / Denied</option>
                </select>

                {/* Filter Case ID */}
                <input
                  type="text"
                  placeholder="Case ID (e.g. case-001)"
                  value={filterCaseId}
                  onChange={(e) => setFilterCaseId(e.target.value)}
                  className="w-32 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />

                {/* Sort Order */}
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-mono font-bold"
                >
                  <option value="desc">Newest First (DESC)</option>
                  <option value="asc">Oldest First (ASC)</option>
                </select>
              </div>

              {/* Clear Filters & Refresh */}
              <div className="flex items-center space-x-2">
                {(filterInspector || filterRole || filterAction || filterCaseId || filterStatus || filterQuery) && (
                  <button
                    onClick={() => {
                      setFilterInspector('');
                      setFilterRole('');
                      setFilterAction('');
                      setFilterCaseId('');
                      setFilterStatus('');
                      setFilterQuery('');
                      setActivityPage(1);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-mono transition cursor-pointer"
                  >
                    Clear Filters ✕
                  </button>
                )}
                <button
                  onClick={loadActivityLogs}
                  disabled={activityLoading}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${activityLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Table of Activity Logs */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Inspector / Officer</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Action Executed</th>
                    <th className="p-3.5">Target / Details</th>
                    <th className="p-3.5">Case ID</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Client IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {activityLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-mono">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-400 mb-2" />
                        <span>Querying audit activity ledger...</span>
                      </td>
                    </tr>
                  ) : activityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                        No activity records matched the selected filters.
                      </td>
                    </tr>
                  ) : (
                    activityLogs.map((log, idx) => {
                      const isFail = log.status?.toLowerCase() === 'failure';
                      const isDangerAction = log.action?.includes('delete') || log.action?.includes('failed') || log.action?.includes('denied');
                      const isExportAction = log.action?.includes('export');

                      return (
                        <tr key={log.id || idx} className="hover:bg-slate-800/30 transition">
                          <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Just now'}
                          </td>
                          <td className="p-3.5 font-semibold text-slate-200">
                            <div>{log.user_name || log.user_id || 'System'}</div>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${ROLE_COLORS[log.role] || 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                              {log.role || 'Officer'}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                              isDangerAction
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : isExportAction
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                : 'bg-slate-800 text-slate-200'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-300 max-w-xs truncate" title={log.details}>
                            {log.details || log.entity_id || '-'}
                          </td>
                          <td className="p-3.5 font-mono text-[11px]">
                            {log.case_id ? (
                              <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 font-bold">
                                {log.case_id}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                              isFail
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}>
                              {log.status || 'success'}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                            {log.ip_address || '127.0.0.1'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Pagination Controls */}
              <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <div>
                  Showing page <strong className="text-white">{activityPage}</strong> of <strong className="text-white">{activityTotalPages}</strong> ({activityTotal} total actions)
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                    disabled={activityPage <= 1 || activityLoading}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <button
                    onClick={() => setActivityPage(prev => Math.min(activityTotalPages, prev + 1))}
                    disabled={activityPage >= activityTotalPages || activityLoading}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
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

            {createValidationError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{createValidationError}</span>
              </div>
            )}

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
                  <label className="block text-slate-400 mb-1 font-semibold">Official Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="rmohan@nettrace.local"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Password * (min 8 chars)</label>
                  <input
                    type="password"
                    required
                    placeholder="Letters & digits"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Re-type password"
                    value={newConfirmPassword}
                    onChange={e => setNewConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
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

      {/* MODAL 3: EDIT OFFICER PROFILE */}
      {isEditModalOpen && selectedUserForEdit && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Edit Officer Profile: {selectedUserForEdit.username}
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editValidationError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editValidationError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={e => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Official Email *</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Department</label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={e => setEditDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Designation</label>
                  <input
                    type="text"
                    value={editDesignation}
                    onChange={e => setEditDesignation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Account Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="ACTIVE">ACTIVE (Full access)</option>
                  <option value="SUSPENDED">SUSPENDED (Temporary lock)</option>
                  <option value="INACTIVE">INACTIVE (Deactivated)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Reset Password (leave empty to keep current)</label>
                <input
                  type="password"
                  placeholder="Min 8 characters with letters & digits"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DEACTIVATE / DELETE OFFICER */}
      {isDeleteModalOpen && selectedUserForDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400 border-b border-slate-800 pb-3">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-slate-100">Deactivate Officer Account</h3>
                <p className="text-[11px] text-slate-400 font-mono">@{selectedUserForDelete.username}</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                Are you sure you want to deactivate officer account for <strong className="text-white">{selectedUserForDelete.full_name}</strong>?
              </p>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-slate-400 text-[11px]">
                <p>• Active authentication sessions will be immediately terminated.</p>
                <p>• Investigation history and evidence lineage will be preserved.</p>
                <p>• Cryptographic audit chain entries will remain intact.</p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer text-xs flex items-center space-x-1.5 shadow-lg shadow-rose-600/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Deactivate Officer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
