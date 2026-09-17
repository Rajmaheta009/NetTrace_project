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
  Lock
} from 'lucide-react';
import { fetchCases, createCase, switchCase, switchUserRole } from '../services/api';

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

export function CaseSwitcherModal({ isOpen, onClose, activeCase, onCaseSwitched }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('organized_crime');

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchCases();
      setCases(list);
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
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSwitch = async (caseId) => {
    setLoading(true);
    try {
      await switchCase(caseId);
      if (onCaseSwitched) onCaseSwitched(caseId);
      onClose();
    } catch (err) {
      alert('Failed to switch case: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const created = await createCase(newName.trim(), newDesc.trim(), newType);
      if (onCaseSwitched) onCaseSwitched(created.case_id);
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
            <h2 className="text-base font-bold text-slate-100">Switch Investigation Case</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isCreating ? (
          <div className="space-y-3">
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {cases.map((c) => {
                const isActive = c.case_id === activeCase?.case_id;
                return (
                  <div
                    key={c.case_id}
                    onClick={() => !isActive && handleSwitch(c.case_id)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isActive
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold uppercase text-cyan-400">
                          {c.case_id}
                        </span>
                        <span className="text-xs font-bold">{c.case_name}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-cyan-300 font-mono border border-cyan-900/40">
                          {(c.investigation_type || 'organized_crime').replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {c.entity_count} Entities • {c.relationship_count} Links • {c.evidence_count} Evidence
                      </div>
                    </div>

                    {isActive ? (
                      <span className="flex items-center space-x-1 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-slate-400 hover:text-cyan-300 font-semibold"
                      >
                        Select →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center space-x-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Case File</span>
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Case Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Operation Blue Star Hawala"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Description / Scope</label>
              <textarea
                rows={3}
                placeholder="Brief summary of target syndicate, syndicate type..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Investigation Profile / Typology</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
              >
                {CRIME_PROFILE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
                disabled={loading || !newName.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 cursor-pointer"
              >
                Create & Switch
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function RoleSwitcherModal({ isOpen, onClose, currentUser, onRoleSwitched }) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const roles = [
    {
      role: 'Investigator',
      title: 'Forensic Investigator',
      desc: 'Full operational intelligence access: 3D graph exploration, connection pathfinder, evidence registration, data validation, and report dossiers.',
      color: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300',
    },
    {
      role: 'Admin',
      title: 'Agency Administrator',
      desc: 'Supervisory privileges: manage cases, configure surveillance sources, audit full officer logs, and execute global memory resets.',
      color: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
    },
    {
      role: 'Viewer',
      title: 'Executive Viewer / Auditor',
      desc: 'Read-only judicial oversight: inspect network visualizer, review AI intelligence briefings, and print forensic case summaries.',
      color: 'border-slate-700 bg-slate-950/40 text-slate-300',
    },
  ];

  const handleSelectRole = async (roleName) => {
    setLoading(true);
    try {
      const updated = await switchUserRole(roleName);
      if (onRoleSwitched) onRoleSwitched(updated);
      onClose();
    } catch (err) {
      alert('Failed to switch role: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100">Role-Based Access Control (RBAC)</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Select an active operational role to simulate security permissions and user access tiers:
        </p>

        <div className="space-y-3">
          {roles.map((r) => {
            const isSelected = currentUser?.role === r.role;
            return (
              <div
                key={r.role}
                onClick={() => handleSelectRole(r.role)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
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

        <div className="flex justify-end pt-2">
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
