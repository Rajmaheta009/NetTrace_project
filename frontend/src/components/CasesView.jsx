import React, { useState, useEffect } from 'react';
import {
  FolderLock,
  Plus,
  CheckCircle2,
  Trash2,
  Archive,
  RefreshCw,
  FolderOpen,
  Calendar,
  User,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { fetchCases, createCase, switchCase, deleteCase } from '../services/api';

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

export default function CasesView({ activeCase, onCaseSwitched }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('organized_crime');
  const [error, setError] = useState(null);

  const loadCasesList = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCases();
      setCases(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCasesList();
  }, []);

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const created = await createCase(newName.trim(), newDesc.trim(), newType);
      setIsModalOpen(false);
      setNewName('');
      setNewDesc('');
      setNewType('organized_crime');
      await loadCasesList();
      if (onCaseSwitched) {
        onCaseSwitched(created.case_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (caseId) => {
    setLoading(true);
    try {
      await switchCase(caseId);
      await loadCasesList();
      if (onCaseSwitched) {
        onCaseSwitched(caseId);
      }
    } catch (err) {
      setError(err.message);
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <FolderLock className="w-6 h-6 text-cyan-400" />
            <span>Case Management Registry</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete data isolation between investigations. Each case maintains its own graph, evidence index, and validation queue.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadCasesList}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Refresh Cases"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Investigation Case</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300 font-mono">
          {error}
        </div>
      )}

      {/* Case Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cases.map((c) => {
          const isActive = c.case_id === activeCase?.case_id;
          return (
            <div
              key={c.case_id}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                isActive
                  ? 'bg-slate-900/90 border-cyan-500/50 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500/30'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      {c.case_id}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-semibold border border-cyan-900/50">
                      {(c.investigation_type || 'organized_crime').replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      c.status === 'Open'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-100 mt-3 truncate">{c.case_name}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {c.description || 'No description entered for this case file.'}
                </p>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-800/80 text-center font-mono">
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <div className="text-sm font-bold text-cyan-300">{c.entity_count}</div>
                    <div className="text-[9px] text-slate-500 uppercase">Entities</div>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <div className="text-sm font-bold text-blue-300">{c.relationship_count}</div>
                    <div className="text-[9px] text-slate-500 uppercase">Links</div>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <div className="text-sm font-bold text-emerald-300">{c.evidence_count}</div>
                    <div className="text-[9px] text-slate-500 uppercase">Evidence</div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" /> {c.created_by}
                  </span>
                  <span>{c.created_at?.split(' ')[0] || ''}</span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                {isActive ? (
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Currently Active</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSwitch(c.case_id)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <span>Switch to Case</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}

                {c.case_id !== 'case-001' && !isActive && (
                  <button
                    onClick={() => handleDelete(c.case_id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-900 transition-colors cursor-pointer"
                    title="Delete Case"
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              <span>Create New Investigation Case</span>
            </h2>
            <form onSubmit={handleCreateCase} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Case Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operation Blue Star Hawala"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Investigative Scope</label>
                <textarea
                  rows={3}
                  placeholder="Investigative brief, jurisdiction, target syndicate details..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Investigation Profile / Typology</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 text-xs focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
                >
                  {CRIME_PROFILE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newName.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all cursor-pointer"
                >
                  Create & Activate Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
