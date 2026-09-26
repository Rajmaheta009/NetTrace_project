import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderLock,
  Plus,
  CheckCircle2,
  Trash2,
  RefreshCw,
  FolderOpen,
  Calendar,
  User,
  ShieldAlert,
  ArrowRight,
  Search,
  Filter,
  SlidersHorizontal,
  FolderPlus,
  AlertCircle,
  Tag,
  Clock,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { fetchCases, createCase, switchCase, deleteCase } from '../services/api';
import { can } from '../utils/permissions';

export const CRIME_PROFILE_OPTIONS = [
  { id: 'organized_crime', label: 'Organized Crime Network' },
  { id: 'financial_fraud', label: 'Financial Fraud & Hawala' },
  { id: 'drug_trafficking', label: 'Drug Trafficking & Narcotics' },
  { id: 'cybercrime', label: 'Cybercrime & Ransomware' },
  { id: 'murder_homicide', label: 'Murder & Violent Crime' },
  { id: 'kidnapping_abduction', label: 'Kidnapping & Abduction' },
  { id: 'robbery_theft', label: 'Armed Robbery & Syndicate Theft' },
  { id: 'human_trafficking', label: 'Human Trafficking' },
  { id: 'extortion_blackmail', label: 'Extortion & Blackmail' },
  { id: 'smuggling', label: 'Contraband & Weapons Smuggling' },
  { id: 'missing_person', label: 'Missing Person & Disappearance' },
];

export const PRIORITY_OPTIONS = [
  { id: 'Critical', label: 'Critical', color: 'text-rose-400 bg-rose-950/40 border-rose-800/50' },
  { id: 'High', label: 'High Priority', color: 'text-amber-400 bg-amber-950/40 border-amber-800/50' },
  { id: 'Medium', label: 'Medium', color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/50' },
  { id: 'Low', label: 'Low', color: 'text-slate-400 bg-slate-800/40 border-slate-700/50' },
];

export const STATUS_OPTIONS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'Open', label: 'Open' },
  { id: 'Under Investigation', label: 'Under Investigation' },
  { id: 'Under Review', label: 'Under Review' },
  { id: 'Closed', label: 'Closed' },
  { id: 'Archived', label: 'Archived' },
];

export default function CasesView({ activeCase, onCaseSwitched, currentUser }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State & Inline Validation
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('organized_crime');
  const [newPriority, setNewPriority] = useState('High');
  const [nameError, setNameError] = useState('');
  const [successNotice, setSuccessNotice] = useState(null);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [sortBy, setSortBy] = useState('updated_at');

  const loadCasesList = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCases();
      setCases(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCasesList();
  }, []);

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      setNameError('Case Name is required.');
      return;
    }
    setNameError('');
    setCreating(true);
    setError(null);

    try {
      const created = await createCase(
        newName.trim(),
        newDesc.trim(),
        newType,
        newPriority
      );

      setSuccessNotice(`✓ Case created successfully! Opening ${created.case_id}...`);
      setIsModalOpen(false);
      setNewName('');
      setNewDesc('');
      setNewType('organized_crime');
      setNewPriority('High');

      await loadCasesList();

      setTimeout(() => {
        setSuccessNotice(null);
        if (onCaseSwitched) {
          // Pass true to open workspace directly
          onCaseSwitched(created.case_id, true);
        }
      }, 700);

    } catch (err) {
      setError(err.message || 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenWorkspace = async (caseId) => {
    setLoading(true);
    try {
      await switchCase(caseId);
      if (onCaseSwitched) {
        onCaseSwitched(caseId, true);
      }
    } catch (err) {
      setError(err.message || 'Failed to switch case');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (caseId) => {
    if (!window.confirm(`Are you sure you want to delete case ${caseId}? This action cannot be undone.`)) return;
    setLoading(true);
    try {
      await deleteCase(caseId);
      await loadCasesList();
    } catch (err) {
      setError(err.message || 'Failed to delete case');
    } finally {
      setLoading(false);
    }
  };

  // Client-Side Search & Filter Pipeline
  const filteredCases = useMemo(() => {
    let result = [...cases];

    // 1. Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c =>
        c.case_name?.toLowerCase().includes(q) ||
        c.case_id?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.investigation_type?.toLowerCase().includes(q) ||
        c.created_by?.toLowerCase().includes(q)
      );
    }

    // 2. Status Filter
    if (selectedStatus !== 'all') {
      result = result.filter(c => String(c.status).toLowerCase() === selectedStatus.toLowerCase());
    }

    // 3. Typology Filter
    if (selectedType !== 'all') {
      result = result.filter(c => c.investigation_type === selectedType);
    }

    // 4. Priority Filter
    if (selectedPriority !== 'all') {
      result = result.filter(c => String(c.priority).toLowerCase() === selectedPriority.toLowerCase());
    }

    // 5. Sorting
    result.sort((a, b) => {
      if (sortBy === 'case_name') {
        return (a.case_name || '').localeCompare(b.case_name || '');
      } else if (sortBy === 'priority') {
        const prioRank = { critical: 4, high: 3, medium: 2, low: 1 };
        const pA = prioRank[String(a.priority).toLowerCase()] || 0;
        const pB = prioRank[String(b.priority).toLowerCase()] || 0;
        return pB - pA;
      } else if (sortBy === 'created_at') {
        return (b.created_at || '').localeCompare(a.created_at || '');
      } else {
        // updated_at
        return (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '');
      }
    });

    return result;
  }, [cases, searchQuery, selectedStatus, selectedType, selectedPriority, sortBy]);

  const getPriorityBadge = (priority) => {
    const p = String(priority || 'High').toLowerCase();
    switch (p) {
      case 'critical':
        return 'text-rose-300 bg-rose-950/60 border-rose-800/80 ring-1 ring-rose-500/30';
      case 'high':
        return 'text-amber-300 bg-amber-950/60 border-amber-800/80 ring-1 ring-amber-500/30';
      case 'medium':
        return 'text-cyan-300 bg-cyan-950/60 border-cyan-800/80';
      case 'low':
        return 'text-slate-400 bg-slate-800/60 border-slate-700';
      default:
        return 'text-slate-300 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner / Toast */}
      {successNotice && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl flex items-center space-x-3 text-xs text-emerald-200 shadow-xl animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-bold">{successNotice}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <FolderLock className="w-6 h-6 text-cyan-400" />
            <span>Case Management Registry</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete data isolation across digital investigations. Each case maintains an independent 3D orbit, evidence ledger, and validation queue.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadCasesList}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Refresh Cases"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          {can(currentUser, 'CASE_CREATE') && (
            <button
              onClick={() => {
                setNameError('');
                setIsModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs transition-all shadow-lg shadow-cyan-500/25 cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
              <span>Create New Case</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 font-mono flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      {cases.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 space-y-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by case title, CASE-YYYY-NNNN ID, crime typology, scope..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 transition-colors placeholder:text-slate-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>

              {/* Priority Filter */}
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
              >
                <option value="all">All Priorities</option>
                {PRIORITY_OPTIONS.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.label}
                  </option>
                ))}
              </select>

              {/* Crime Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-cyan-500 font-medium cursor-pointer max-w-[160px]"
              >
                <option value="all">All Typologies</option>
                {CRIME_PROFILE_OPTIONS.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.label}
                  </option>
                ))}
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 text-xs focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
              >
                <option value="updated_at">Recently Updated</option>
                <option value="created_at">Date Created</option>
                <option value="case_name">Case Title (A-Z)</option>
                <option value="priority">Priority (Highest)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Case Count Metric */}
      {cases.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
          <span>
            Showing <strong className="text-cyan-300">{filteredCases.length}</strong> of {cases.length} investigation cases
          </span>
          {activeCase && (
            <span className="text-slate-400">
              Active Case: <strong className="text-emerald-400">{activeCase.case_id}</strong> ({activeCase.case_name})
            </span>
          )}
        </div>
      )}

      {/* First-Time User Onboarding (0 Cases Found) */}
      {!loading && cases.length === 0 && (
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-3xl p-10 sm:p-14 text-center max-w-2xl mx-auto shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-cyan-500/10 blur-3xl pointer-events-none rounded-full" />
          
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-6 shadow-inner">
            <FolderPlus className="w-8 h-8" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-100 mb-2">
            No Cases Found
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed mb-8">
            You don't have any cases yet. Create your first case to start an investigation and analyze digital evidence in the 3D network orbit.
          </p>

          {can(currentUser, 'CASE_CREATE') ? (
            <button
              onClick={() => {
                setNameError('');
                setIsModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm transition-all shadow-xl shadow-cyan-500/25 cursor-pointer hover:scale-105"
            >
              <Plus className="w-5 h-5 text-slate-950 stroke-[3]" />
              <span>Create Your First Case</span>
            </button>
          ) : (
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 inline-block font-mono">
              Contact an Administrator or Lead Investigator to be assigned to an active case file.
            </div>
          )}
        </div>
      )}

      {/* No Search Matches */}
      {!loading && cases.length > 0 && filteredCases.length === 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
          <p className="font-semibold text-slate-300">No cases match your filter criteria.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedStatus('all');
              setSelectedType('all');
              setSelectedPriority('all');
            }}
            className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 text-cyan-400 hover:text-cyan-300 cursor-pointer font-mono"
          >
            Clear Search & Filters
          </button>
        </div>
      )}

      {/* Case Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCases.map((c) => {
          const isActive = c.case_id === activeCase?.case_id;
          return (
            <div
              key={c.case_id}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all relative ${
                isActive
                  ? 'bg-slate-900/90 border-cyan-500/60 shadow-xl shadow-cyan-950/40 ring-1 ring-cyan-500/40'
                  : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              <div>
                {/* Header: Case ID, Typology, Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-mono font-bold uppercase text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                      {c.case_id}
                    </span>
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${getPriorityBadge(c.priority)}`}>
                      {c.priority || 'High'}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      c.status === 'Open'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {c.status || 'Open'}
                  </span>
                </div>

                {/* Case Title */}
                <h3 className="text-base font-bold text-slate-100 mt-3 truncate" title={c.case_name}>
                  {c.case_name}
                </h3>

                {/* Crime Matrix Label */}
                <div className="text-[10px] font-mono text-cyan-400 mt-0.5 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-cyan-500" />
                  <span>{(c.investigation_type || 'organized_crime').replace(/_/g, ' ').toUpperCase()}</span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {c.description || 'No investigative description entered for this case file.'}
                </p>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-800/80 text-center font-mono">
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                    <div className="text-sm font-bold text-cyan-300">{c.entity_count || 0}</div>
                    <div className="text-[9px] text-slate-500 uppercase">Entities</div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                    <div className="text-sm font-bold text-blue-300">{c.relationship_count || 0}</div>
                    <div className="text-[9px] text-slate-500 uppercase">Links</div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                    <div className="text-sm font-bold text-emerald-300">{c.evidence_count || 0}</div>
                    <div className="text-[9px] text-slate-500 uppercase">Evidence</div>
                  </div>
                </div>

                {/* Officer & Timestamp */}
                <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" /> {c.created_by || 'Investigator'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> {c.created_at?.split(' ')[0] || ''}
                  </span>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                {isActive ? (
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Active Workspace</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleOpenWorkspace(c.case_id)}
                    className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 hover:text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-sm group"
                  >
                    <span>Open Case Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}

                {can(currentUser, 'CASE_DELETE') && c.case_id !== 'case-001' && !isActive && (
                  <button
                    onClick={() => handleDelete(c.case_id)}
                    className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Delete Case File"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Case Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-cyan-400" />
                <span>Create New Investigation Case</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4">
              {/* Case Name with Inline Validation */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Case Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operation Blue Star Hawala"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (e.target.value.trim()) setNameError('');
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border text-slate-200 text-xs focus:outline-none transition-colors ${
                    nameError
                      ? 'border-rose-500 focus:border-rose-400 ring-1 ring-rose-500/30'
                      : 'border-slate-800 focus:border-cyan-500'
                  }`}
                />
                {nameError && (
                  <p className="text-[11px] font-semibold text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {nameError}
                  </p>
                )}
              </div>

              {/* Typology and Priority Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Investigation Profile <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 text-xs focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
                  >
                    {CRIME_PROFILE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
                  >
                    {PRIORITY_OPTIONS.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Investigative Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="Investigative brief, jurisdiction, target syndicates, preliminary intelligence notes..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 resize-none transition-colors"
                />
              </div>

              {/* Note on Automatic Sequential Numbering */}
              <div className="p-3 bg-cyan-950/30 border border-cyan-900/40 rounded-xl text-[11px] text-cyan-300 font-mono flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Case number will be automatically generated as <strong className="text-cyan-200">CASE-{new Date().getFullYear()}-NNNN</strong>. You will be assigned as <strong className="text-cyan-200">CASE_OWNER</strong>.
                </span>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs transition-all shadow-md shadow-cyan-500/25 cursor-pointer disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Case...</span>
                    </>
                  ) : (
                    <>
                      <span>Create & Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
