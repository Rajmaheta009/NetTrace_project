import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  Search,
  RefreshCw,
  Clock,
  User,
  Shield,
  FileSpreadsheet,
  GitMerge,
  ExternalLink,
  Layers,
  ArrowRight
} from 'lucide-react';
import { fetchAuditTrail } from '../services/api';

export default function HistoryRecordsModal({
  isOpen,
  onClose,
  onInspectEntity = null,
  onNavigate = null,
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditTrail(150);
      setRecords(data || []);
    } catch (err) {
      console.error('Failed to load history records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRecords();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getActionCategory = (action = '') => {
    const act = action.toLowerCase();
    if (act.includes('inspect') || act.includes('node')) return 'INSPECTION';
    if (act.includes('import') || act.includes('demo') || act.includes('reset')) return 'IMPORT';
    if (act.includes('merge')) return 'MERGE';
    if (act.includes('case') || act.includes('type') || act.includes('profile')) return 'CASE';
    return 'OTHER';
  };

  const filteredRecords = records.filter((rec) => {
    const actCat = getActionCategory(rec.action);
    if (activeFilter !== 'ALL' && actCat !== activeFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (rec.action && rec.action.toLowerCase().includes(q)) ||
      (rec.user_id && rec.user_id.toLowerCase().includes(q)) ||
      (rec.details && rec.details.toLowerCase().includes(q)) ||
      (rec.timestamp && rec.timestamp.toLowerCase().includes(q))
    );
  });

  const getActionBadgeColor = (action = '') => {
    const act = action.toLowerCase();
    if (act.includes('inspect')) return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    if (act.includes('import') || act.includes('demo')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (act.includes('merge')) return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    if (act.includes('case') || act.includes('profile')) return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    if (act.includes('reset') || act.includes('delete')) return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  // Helper to detect entity id or name in action details
  const extractEntityTarget = (rec) => {
    if (!rec.details) return null;
    // Format 1: "on entity 'Name' (ID) in case"
    const parenMatch = rec.details.match(/entity\s+['"]?([^'"]+)['"]?\s+\(([^)]+)\)/i);
    if (parenMatch && parenMatch[2]) return parenMatch[2];
    // Format 2: "entity 'Name'" or 'entity "Name"'
    const quotedMatch = rec.details.match(/entity\s+['"]([^'"]+)['"]/i);
    if (quotedMatch && quotedMatch[1]) return quotedMatch[1];
    // Format 3: "entity ID"
    const idMatch = rec.details.match(/entity\s+([A-Za-z0-9_-]+)/i);
    if (idMatch && idMatch[1]) return idMatch[1];
    return null;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-100">
                  Investigation History & Previous Records
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-amber-300 border border-amber-500/20">
                  {records.length} Recorded
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographic timeline of officer activity, inspections, multi-source ingestion, and case modifications.
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={loadRecords}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition cursor-pointer"
              title="Refresh Previous Records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition cursor-pointer"
              title="Close History View"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Controls: Search & Category Filters */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search previous records by officer, action, entity, or keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: 'ALL', label: 'All Actions' },
                { id: 'INSPECTION', label: 'Inspections' },
                { id: 'IMPORT', label: 'Data Ingestion' },
                { id: 'MERGE', label: 'Entity Merges' },
                { id: 'CASE', label: 'Case Ops' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    activeFilter === f.id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Records Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto opacity-70" />
              <p className="text-xs text-slate-400 font-mono">Fetching previous investigation records...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <History className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No matching investigation records found</p>
              <p className="text-xs text-slate-500 font-mono">Try adjusting your search query or filter category.</p>
            </div>
          ) : (
            filteredRecords.map((rec, idx) => {
              const entityTarget = extractEntityTarget(rec);
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase border ${getActionBadgeColor(rec.action)}`}>
                        {rec.action?.replace(/_/g, ' ')}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                        <User className="w-3 h-3 text-cyan-400" />
                        <span className="font-semibold text-slate-200">{rec.user_id || 'Officer Vikram'}</span>
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>{rec.timestamp}</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 font-sans leading-relaxed">
                      {rec.details || 'System event recorded in cryptographic log.'}
                    </p>
                  </div>

                  {entityTarget && onInspectEntity && (
                    <button
                      onClick={() => {
                        onInspectEntity(entityTarget);
                        onClose();
                      }}
                      className="shrink-0 flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer self-start sm:self-center"
                      title={`Open Deep Inspection for ${entityTarget}`}
                    >
                      <span>Inspect Target</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Immutable Cryptographic Audit Trail Active</span>
          </div>

          <div className="flex items-center space-x-2">
            {onNavigate && (
              <button
                onClick={() => {
                  onNavigate('audit');
                  onClose();
                }}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                <span>Full Audit Ledger</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
