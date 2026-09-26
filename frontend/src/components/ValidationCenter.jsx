import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  Edit3,
  RefreshCw,
  AlertTriangle,
  FileText,
  UserCheck,
  Search,
  Filter,
  GitMerge,
  Users,
  Crosshair,
  ArrowRight
} from 'lucide-react';
import { fetchValidationRecords, reviewValidationRecord, mergeEntities } from '../services/api';
import { can } from '../utils/permissions';

export default function ValidationCenter({ 
  activeCase, 
  graphData = { nodes: [], links: [] },
  onReviewCompleted,
  onDeepInspect = null,
  currentUser = null
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('Needs Review'); // 'All' | 'Needs Review' | 'Valid' | 'Rejected' | 'Duplicates'
  const [editingRecord, setEditingRecord] = useState(null);
  const [editPayloadJson, setEditPayloadJson] = useState('');
  const [dismissedDuplicates, setDismissedDuplicates] = useState(new Set());

  const nodes = graphData.nodes || [];

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await fetchValidationRecords(activeCase?.case_id);
      setRecords(data);
    } catch (err) {
      console.error('Failed to load validation queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [activeCase?.case_id]);

  // Find candidate duplicates based on shared identifiers or normalized name similarity
  const candidateDuplicates = useMemo(() => {
    const pairs = [];
    const seen = new Set();

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (a.id === b.id) continue;

        const pairKey = [a.id, b.id].sort().join('::');
        if (seen.has(pairKey) || dismissedDuplicates.has(pairKey)) continue;

        let matchReason = null;
        let confidence = 0.0;

        // Same type check
        if (a.type === b.type) {
          // 1. Shared phone
          const phoneA = a.attributes?.phone || (a.type === 'PhoneNumber' ? a.name : null);
          const phoneB = b.attributes?.phone || (b.type === 'PhoneNumber' ? b.name : null);
          if (phoneA && phoneB && phoneA.replace(/\D/g, '') === phoneB.replace(/\D/g, '')) {
            matchReason = `Identical Phone Number: ${phoneA}`;
            confidence = 0.95;
          }

          // 2. Shared plate
          const plateA = a.attributes?.plate || (a.type === 'Vehicle' ? a.name : null);
          const plateB = b.attributes?.plate || (b.type === 'Vehicle' ? b.name : null);
          if (!matchReason && plateA && plateB && plateA.replace(/\s/g, '').toUpperCase() === plateB.replace(/\s/g, '').toUpperCase()) {
            matchReason = `Identical Vehicle Plate: ${plateA}`;
            confidence = 0.95;
          }

          // 3. Similar name or alias match
          const cleanNameA = (a.name || a.id || '').toLowerCase().trim();
          const cleanNameB = (b.name || b.id || '').toLowerCase().trim();
          if (!matchReason && cleanNameA && cleanNameA === cleanNameB) {
            matchReason = `Exact Name Match: ${a.name || a.id}`;
            confidence = 0.90;
          } else if (!matchReason && ((a.aliases && a.aliases.includes(b.name)) || (b.aliases && b.aliases.includes(a.name)))) {
            matchReason = `Cross-Alias Correlation: ${a.name || a.id} ↔ ${b.name || b.id}`;
            confidence = 0.85;
          }
        }

        if (matchReason) {
          seen.add(pairKey);
          pairs.push({
            pairKey,
            entityA: a,
            entityB: b,
            reason: matchReason,
            confidence,
          });
        }
      }
    }
    return pairs;
  }, [nodes, dismissedDuplicates]);

  const handleAction = async (recordId, action, payload = null) => {
    setLoading(true);
    try {
      await reviewValidationRecord(activeCase?.case_id, recordId, action, payload);
      await loadRecords();
      if (onReviewCompleted) {
        onReviewCompleted();
      }
    } catch (err) {
      alert('Review action failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (sourceId, targetId, reason) => {
    if (!activeCase?.case_id) return;
    setLoading(true);
    try {
      await mergeEntities(activeCase.case_id, sourceId, targetId, reason);
      if (onReviewCompleted) onReviewCompleted();
      await loadRecords();
    } catch (err) {
      alert('Merge failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissDuplicate = (pairKey) => {
    setDismissedDuplicates(prev => new Set(prev).add(pairKey));
  };

  const handleOpenCorrect = (rec) => {
    setEditingRecord(rec);
    setEditPayloadJson(JSON.stringify(rec.payload, null, 2));
  };

  const handleSaveCorrection = async () => {
    try {
      const parsed = JSON.parse(editPayloadJson);
      await handleAction(editingRecord.record_id, 'correct', parsed);
      setEditingRecord(null);
    } catch (err) {
      alert('Invalid JSON in correction payload: ' + err.message);
    }
  };

  const filtered = records.filter((r) => {
    if (filter === 'All') return true;
    return r.status === filter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-amber-400" />
            <span>Data Quality & Human Validation Center</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Human-in-the-loop review queue for ambiguous text extractions, duplicate entity resolution, and candidate links.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadRecords}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 cursor-pointer"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold">
        {['Needs Review', 'Duplicates', 'Valid', 'Rejected', 'All'].map((tab) => {
          const isSelected = filter === tab;
          const count = tab === 'Duplicates' 
            ? candidateDuplicates.length 
            : tab === 'All' 
            ? records.length 
            : records.filter(r => r.status === tab).length;

          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-xl border transition cursor-pointer flex items-center space-x-1.5 ${
                isSelected
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{tab}</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-950 text-[10px]">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* DUPLICATE ENTITY RESOLUTION TAB */}
      {filter === 'Duplicates' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-1">
            <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider flex items-center space-x-2">
              <GitMerge className="w-4 h-4 text-amber-400" />
              <span>Candidate Entity Duplicates ({candidateDuplicates.length})</span>
            </h3>
            <p className="text-xs text-slate-400">
              Correlated entities sharing identifiers or aliases. The investigator decides whether to merge or keep separate.
            </p>
          </div>

          {candidateDuplicates.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800 space-y-2">
              <UserCheck className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-white text-sm">No Unresolved Duplicates Detected</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All entities in the active case graph possess distinct phone numbers, plates, and identity attributes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {candidateDuplicates.map((dup) => (
                <div 
                  key={dup.pairKey}
                  className="p-4 bg-slate-950/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl space-y-3 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <span className="text-xs font-mono font-bold text-amber-300">
                      Match Basis: {dup.reason}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                      {(dup.confidence * 100).toFixed(0)}% Similarity
                    </span>
                  </div>

                  {/* Candidate Pair Display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-500 text-[10px] uppercase block">Entity A</span>
                      <span className="text-white font-bold block">{dup.entityA.name}</span>
                      <span className="text-slate-400 text-[10px] block">Type: {dup.entityA.type} • ID: {dup.entityA.id}</span>
                    </div>

                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-500 text-[10px] uppercase block">Entity B</span>
                      <span className="text-white font-bold block">{dup.entityB.name}</span>
                      <span className="text-slate-400 text-[10px] block">Type: {dup.entityB.type} • ID: {dup.entityB.id}</span>
                    </div>
                  </div>

                  {/* Resolution Actions: [ MERGE ], [ KEEP SEPARATE ], [ REVIEW ] */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {can(currentUser, 'ENTITY_MERGE') && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleMerge(dup.entityB.id, dup.entityA.id, dup.reason)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer"
                        >
                          Merge B into A ({dup.entityA.name})
                        </button>
                        <button
                          onClick={() => handleMerge(dup.entityA.id, dup.entityB.id, dup.reason)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer"
                        >
                          Merge A into B ({dup.entityB.name})
                        </button>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      {onDeepInspect && (
                        <button
                          onClick={() => onDeepInspect(dup.entityA.id)}
                          className="px-2.5 py-1 text-xs text-cyan-400 hover:text-white font-mono transition cursor-pointer"
                        >
                          Deep Inspect A ↗
                        </button>
                      )}
                      <button
                        onClick={() => handleDismissDuplicate(dup.pairKey)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        Keep Separate
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STANDARD VALIDATION RECORDS LIST */}
      {filter !== 'Duplicates' && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800 space-y-2">
              <UserCheck className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="font-bold text-white text-sm">No Validation Records in Queue</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All extracted intelligence records have been processed or promoted to the active case graph.
              </p>
            </div>
          ) : (
            filtered.map((r) => (
              <div
                key={r.record_id}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 font-mono text-xs">
                    <span className="font-bold text-slate-200">{r.record_id}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-cyan-400 font-bold">{r.target_type}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">{r.source_file}</span>
                  </div>

                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    r.status === 'Valid' 
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : r.status === 'Needs Review'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}>
                    {r.status}
                  </span>
                </div>

                <div className="text-xs text-slate-300 bg-slate-900/90 p-3 rounded-xl border border-slate-800 font-mono">
                  <pre className="whitespace-pre-wrap overflow-x-auto text-[11px] leading-relaxed">
                    {JSON.stringify(r.payload, null, 2)}
                  </pre>
                </div>

                {r.status === 'Needs Review' && (
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    {can(currentUser, 'VALIDATION_ACCEPT') && (
                      <button
                        onClick={() => handleAction(r.record_id, 'accept')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition cursor-pointer"
                      >
                        Accept
                      </button>
                    )}
                    {can(currentUser, 'VALIDATION_CORRECT') && (
                      <button
                        onClick={() => handleOpenCorrect(r)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition cursor-pointer"
                      >
                        Correct & Accept
                      </button>
                    )}
                    {can(currentUser, 'VALIDATION_REJECT') && (
                      <button
                        onClick={() => handleAction(r.record_id, 'reject')}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition cursor-pointer"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* JSON Correction Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-5 space-y-4 shadow-2xl font-sans">
            <h3 className="text-base font-bold text-white">Correct Extraction Payload</h3>
            <textarea
              rows={10}
              value={editPayloadJson}
              onChange={(e) => setEditPayloadJson(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500/50"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingRecord(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCorrection}
                className="px-4 py-1.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black"
              >
                Promote to Graph
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
