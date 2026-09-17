import React, { useState, useEffect } from 'react';
import {
  X,
  Crosshair,
  ShieldAlert,
  FileText,
  Clock,
  Users,
  GitMerge,
  Network,
  Award,
  Link,
  Search,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Plus,
  Trash2,
  Copy,
  Printer,
  Sparkles,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { 
  fetchDeepEntityInspection, 
  fetchConnections, 
  createNote, 
  deleteNote,
  logAuditAction 
} from '../services/api';
import { getEntityColor } from '../utils/colors';

export default function DeepEntityInspection({
  caseId,
  entityId,
  onClose,
  allEntities = [],
  onHighlightCommunity = null,
  onHighlightPath = null,
  onSelectEntity = null
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'relationships' | 'evidence' | 'timeline' | 'community' | 'patterns' | 'paths' | 'notes'

  // In-modal connection finder state
  const [targetEntityId, setTargetEntityId] = useState('');
  const [findingPath, setFindingPath] = useState(false);
  const [pathResult, setPathResult] = useState(null);
  const [pathError, setPathError] = useState(null);

  // New Note State
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Copied state
  const [copiedText, setCopiedText] = useState('');

  const loadData = async () => {
    if (!entityId || !caseId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchDeepEntityInspection(caseId, entityId);
      setData(res);
    } catch (err) {
      console.error('Deep inspection load error:', err);
      setError(err.message || 'Failed to load deep inspection');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [caseId, entityId]);

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const handleFindPath = async () => {
    if (!targetEntityId || !caseId) return;
    try {
      setFindingPath(true);
      setPathError(null);
      const res = await fetchConnections(entityId, targetEntityId, caseId);
      setPathResult(res);
      logAuditAction('deep_inspect_find_path', `Found connection path from ${entityId} to ${targetEntityId} in case ${caseId}`);
    } catch (err) {
      setPathError(err.message || 'No direct or indirect connection path found between these entities.');
      setPathResult(null);
    } finally {
      setFindingPath(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !caseId) return;
    try {
      setSavingNote(true);
      await createNote(caseId, newNoteText.trim(), entityId);
      setNewNoteText('');
      await loadData();
    } catch (err) {
      alert('Failed to save field note: ' + err.message);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Are you sure you want to delete this field note?')) return;
    try {
      await deleteNote(caseId, noteId);
      await loadData();
    } catch (err) {
      alert('Failed to delete note: ' + err.message);
    }
  };

  if (!entityId) return null;

  const entity = data?.entity;
  const netPos = data?.network_position;
  const lead = data?.investigation_lead;
  const relationships = data?.relationships || [];
  const evidenceList = data?.evidence || [];
  const timelineEvents = data?.timeline || [];
  const communityInfo = data?.communities;
  const patternsList = data?.patterns || [];
  const notesList = data?.investigator_notes || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in font-sans">
      <div className="relative w-full max-w-6xl h-[94vh] max-h-[950px] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* ===================================================================== */}
        {/* HEADER BAR                                                            */}
        {/* ===================================================================== */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
              <Crosshair className="w-5 h-5 text-cyan-400 animate-spin-slow" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  DEEP FORENSIC INSPECTION
                </span>
                {entity && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {entity.type}
                  </span>
                )}
                {data?.investigation_profile && (
                  <span className="text-[10px] font-mono text-rose-400 hidden md:inline">
                    • Profile: {data.investigation_profile.name}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-white truncate tracking-wide mt-0.5">
                {entity ? entity.name : entityId}
              </h2>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Print Dossier"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition cursor-pointer"
              title="Close Inspection Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* TAB NAVIGATION STRIP                                                  */}
        {/* ===================================================================== */}
        <div className="px-5 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center space-x-1 overflow-x-auto scrollbar-none shrink-0 text-xs font-bold">
          {[
            { id: 'overview', label: 'Overview & Lead Score', count: lead ? `${lead.score}/100` : null, icon: Award },
            { id: 'relationships', label: 'Relationships', count: relationships.length, icon: Link },
            { id: 'evidence', label: 'Evidence Ledger', count: evidenceList.length, icon: FileText },
            { id: 'timeline', label: 'Timeline', count: timelineEvents.length, icon: Clock },
            { id: 'community', label: 'Community', count: communityInfo?.name || null, icon: Users },
            { id: 'patterns', label: 'Patterns', count: patternsList.length, icon: ShieldAlert },
            { id: 'paths', label: 'Connection Finder', count: null, icon: Network },
            { id: 'notes', label: 'Notes', count: notesList.length, icon: Plus },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    isActive ? 'bg-cyan-500/30 text-cyan-200' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ===================================================================== */}
        {/* CONTENT BODY AREA                                                     */}
        {/* ===================================================================== */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
          
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono text-cyan-300">Assembling forensic intelligence across all vectors...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/40 rounded-2xl text-rose-300 text-xs font-mono flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* TAB 1: OVERVIEW & INVESTIGATION LEAD SCORE */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  
                  {/* Top Split: Attributes + Network Position */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    
                    {/* Entity Profile Card */}
                    <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-[11px] font-mono uppercase font-bold text-cyan-400">
                          Entity Identification
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">ID: {entity.id}</span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-mono">Full Name / Label</span>
                          <span className="text-white font-bold text-sm">{entity.name}</span>
                        </div>

                        {entity.aliases && entity.aliases.length > 0 && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Aliases & Monikers</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {entity.aliases.map((a, i) => (
                                <span key={i} className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-slate-200 rounded-md text-[10px] font-mono">
                                  {a}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Dynamic Attributes */}
                        {entity.attributes && Object.keys(entity.attributes).length > 0 && (
                          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Forensic Attributes</span>
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                              {Object.entries(entity.attributes).map(([k, v]) => (
                                <div key={k} className="p-1.5 bg-slate-900/90 rounded-lg border border-slate-800">
                                  <span className="text-slate-500 block text-[9px] uppercase">{k}</span>
                                  <span className="text-slate-200 truncate block font-medium">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>Validation: <strong className="text-emerald-400">{entity.validation_status || 'Valid'}</strong></span>
                          <span>Source Ref: <strong className="text-slate-300">{entity.source_file || 'Case Ledger'}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Network Position Telemetry Card */}
                    <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-[11px] font-mono uppercase font-bold text-cyan-400">
                          Network Position Telemetry
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">Deterministic NetworkX</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase block">Betweenness</span>
                          <span className="text-lg font-black text-cyan-300 font-mono block">
                            {netPos?.betweenness_centrality?.toFixed(4) || '0.0000'}
                          </span>
                          <span className="text-[9px] text-slate-500 block">Bridge broker capacity</span>
                        </div>

                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase block">Degree Centrality</span>
                          <span className="text-lg font-black text-sky-300 font-mono block">
                            {netPos?.degree_centrality?.toFixed(4) || '0.0000'}
                          </span>
                          <span className="text-[9px] text-slate-500 block">Direct connectivity index</span>
                        </div>

                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase block">Direct Connections</span>
                          <span className="text-lg font-black text-white font-mono block">
                            {netPos?.direct_connections_count || 0}
                          </span>
                          <span className="text-[9px] text-slate-500 block">1-hop neighbor count</span>
                        </div>

                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Relations</span>
                          <span className="text-lg font-black text-white font-mono block">
                            {netPos?.relationships_count || 0}
                          </span>
                          <span className="text-[9px] text-slate-500 block">MultiDiGraph edges</span>
                        </div>

                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase block">Community</span>
                          <span className="text-sm font-black text-indigo-300 font-mono block truncate">
                            {netPos?.community_name || 'Cluster 1'}
                          </span>
                          <span className="text-[9px] text-slate-500 block">Modularity partition</span>
                        </div>

                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase block">Clusters Reached</span>
                          <span className="text-lg font-black text-purple-300 font-mono block">
                            {netPos?.communities_connected_count || 1}
                          </span>
                          <span className="text-[9px] text-slate-500 block">Cross-boundary links</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* TRANSPARENT INVESTIGATION LEAD SCORE CARD */}
                  {lead && (
                    <div className="bg-slate-950/90 border border-amber-500/40 rounded-3xl p-5 shadow-xl space-y-4 font-sans">
                      
                      {/* Lead Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                            <Award className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="text-base font-black text-white uppercase tracking-wider font-mono">
                                Investigation Lead Analysis
                              </h3>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black font-mono tracking-wider border ${
                                lead.score >= 60 
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                                  : lead.score >= 35 
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}>
                                {lead.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Deterministic prioritization indicator based on verified evidence, timeline density, and graph topology.
                            </p>
                          </div>
                        </div>

                        {/* Big Priority Score */}
                        <div className="text-right flex items-center space-x-3">
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 uppercase block">Priority Indicator</span>
                            <div className="text-2xl font-black font-mono text-amber-300">
                              {lead.score} <span className="text-sm font-normal text-slate-500">/ 100</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Factor Breakdown Bars */}
                      {lead.factor_breakdown && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>Score Composition Factors</span>
                            <span>Points Allocated</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                            {Object.entries(lead.factor_breakdown).map(([factor, pts]) => (
                              <div key={factor} className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-center">
                                <span className="text-[9px] font-mono text-slate-400 uppercase block truncate">
                                  {factor.replace('_', ' ')}
                                </span>
                                <span className="text-sm font-bold text-amber-300 font-mono block">
                                  +{pts}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contributing Observations (Checklist) */}
                      {lead.contributing_observations && lead.contributing_observations.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider block">
                            Contributing Graph & Evidence Observations:
                          </span>
                          <div className="space-y-1.5">
                            {lead.contributing_observations.map((obs, i) => (
                              <div key={i} className="flex items-start space-x-2 text-xs text-slate-200 bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">{obs}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Data-Linked Explanations */}
                      {lead.explanation && lead.explanation.length > 0 && (
                        <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2 text-xs">
                          <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase block">
                            Transparent Investigative Explanation
                          </span>
                          <ol className="space-y-1 list-decimal list-inside text-slate-300">
                            {lead.explanation.map((exp, i) => (
                              <li key={i} className="leading-relaxed">{exp}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Supporting Evidence Chips */}
                      {lead.supporting_evidence && lead.supporting_evidence.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-mono text-slate-400">Verifiable Evidence Citations:</span>
                          {lead.supporting_evidence.map((evId, i) => (
                            <span
                              key={i}
                              onClick={() => setActiveTab('evidence')}
                              className="px-2 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-mono text-indigo-300 cursor-pointer hover:bg-indigo-500/30 transition"
                              title="Click to view evidence details in Evidence Ledger"
                            >
                              {evId}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Mandatory Legal Disclaimer */}
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-[11px] font-mono text-amber-300/90 leading-relaxed flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{lead.disclaimer}</span>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* TAB 2: RELATIONSHIPS MATRIX */}
              {activeTab === 'relationships' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                        Documented Relationships Matrix ({relationships.length})
                      </h3>
                      <p className="text-xs text-slate-400">
                        MultiDiGraph edge connections involving {entity.name}.
                      </p>
                    </div>
                  </div>

                  {relationships.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 italic bg-slate-950/50 rounded-2xl border border-slate-800">
                      No direct relationships recorded for this entity.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {relationships.map((rel, idx) => (
                        <div 
                          key={rel.id || idx}
                          className="p-3.5 bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 rounded-2xl transition space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center space-x-2 font-mono text-xs">
                              <span className="font-bold text-white">{rel.source_name}</span>
                              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black">
                                → {rel.relation_type} →
                              </span>
                              <span className="font-bold text-white">{rel.target_name}</span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-bold">
                                {((rel.confidence || 0.5) * 100).toFixed(0)}% • {rel.confidence_label || 'Moderate'}
                              </span>
                              {rel.occurrences > 1 && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  {rel.occurrences}x Observed
                                </span>
                              )}
                              {rel.evidence_id && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  {rel.evidence_id}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Confidence Reasons */}
                          {rel.confidence_reasons && rel.confidence_reasons.length > 0 && (
                            <div className="text-[11px] text-slate-400 font-mono space-y-0.5 pt-1 border-t border-slate-900">
                              <span className="text-slate-500 text-[10px] uppercase block">Confidence Scoring Basis:</span>
                              {rel.confidence_reasons.map((r, ri) => (
                                <div key={ri} className="text-slate-300">• {r}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: EVIDENCE LEDGER */}
              {activeTab === 'evidence' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                        Verifiable Evidence Ledger ({evidenceList.length})
                      </h3>
                      <p className="text-xs text-slate-400">
                        Cryptographic artifacts citing {entity.name} or incident relationships.
                      </p>
                    </div>
                  </div>

                  {evidenceList.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 italic bg-slate-950/50 rounded-2xl border border-slate-800">
                      No supporting evidence reference available.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {evidenceList.map((ev, idx) => (
                        <div 
                          key={ev.evidence_id || idx}
                          className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-2.5 font-mono text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30 text-[11px]">
                              {ev.evidence_id}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-bold">
                              ✓ {ev.processing_status || 'Verified'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-slate-500 text-[10px] uppercase block">Artifact Filename</span>
                            <span className="text-white font-bold block truncate">{ev.filename}</span>
                          </div>

                          {ev.sha256_hash && (
                            <div className="space-y-1">
                              <span className="text-slate-500 text-[10px] uppercase block">SHA-256 Hash</span>
                              <div className="flex items-center justify-between bg-slate-900 p-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-300">
                                <span className="truncate">{ev.sha256_hash}</span>
                                <button
                                  onClick={() => handleCopy(ev.sha256_hash, ev.evidence_id)}
                                  className="ml-2 text-cyan-400 hover:text-white shrink-0 cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pt-1">
                            <div>Source Type: <strong className="text-slate-200">{ev.source_type}</strong></div>
                            <div>Records: <strong className="text-slate-200">{ev.record_count}</strong></div>
                            <div>Uploaded: <strong className="text-slate-200">{ev.uploaded_at || 'Case Ingestion'}</strong></div>
                            <div>Method: <strong className="text-slate-200">Structured Parsing</strong></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: CHRONOLOGICAL TIMELINE */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                      Chronological Surveillance Timeline ({timelineEvents.length})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Chronological sequence of documented events involving {entity.name}. No invented timestamps.
                    </p>
                  </div>

                  {timelineEvents.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 italic bg-slate-950/50 rounded-2xl border border-slate-800">
                      No timestamped events recorded for this entity.
                    </div>
                  ) : (
                    <div className="relative pl-6 border-l border-cyan-500/30 space-y-4 font-mono text-xs">
                      {timelineEvents.map((evt, idx) => (
                        <div key={idx} className="relative space-y-1 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                          <div className="absolute -left-[31px] top-3.5 w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-900" />
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-cyan-400 font-bold">{evt.timestamp}</span>
                            {evt.evidence_id && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-400">
                                {evt.evidence_id}
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-white text-sm font-sans">
                            {evt.description}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center space-x-2 pt-1">
                            <span>Link: <strong className="text-cyan-300">{evt.relation_type}</strong></span>
                            <span>•</span>
                            <span>Confidence: <strong className="text-slate-200">{((evt.confidence || 0.5)*100).toFixed(0)}%</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: COMMUNITY MEMBERSHIP */}
              {activeTab === 'community' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                        Modularity Community Partition
                      </h3>
                      <p className="text-xs text-slate-400">
                        NetworkX Greedy Modularity Cluster assignment.
                      </p>
                    </div>

                    {onHighlightCommunity && communityInfo?.name && (
                      <button
                        onClick={() => {
                          onHighlightCommunity(communityInfo.name);
                          onClose();
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Highlight in 3D Graph</span>
                      </button>
                    )}
                  </div>

                  {communityInfo ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                          <span className="text-slate-400 text-[10px] uppercase block">Community Label</span>
                          <span className="text-base font-black text-indigo-300 block">{communityInfo.name}</span>
                        </div>
                        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                          <span className="text-slate-400 text-[10px] uppercase block">Cluster Size</span>
                          <span className="text-base font-black text-white block">{communityInfo.size} Members</span>
                        </div>
                        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                          <span className="text-slate-400 text-[10px] uppercase block">Internal Density</span>
                          <span className="text-base font-black text-cyan-300 block">
                            {Number(communityInfo.density || 0).toFixed(3)}
                          </span>
                        </div>
                        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                          <span className="text-slate-400 text-[10px] uppercase block">Internal Edges</span>
                          <span className="text-base font-black text-white block">{communityInfo.internal_edges} Links</span>
                        </div>
                      </div>

                      {communityInfo.members && (
                        <div className="space-y-2">
                          <span className="text-xs font-mono font-bold text-slate-300 uppercase block">
                            Community Members ({communityInfo.members.length}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {communityInfo.members.map((m, idx) => (
                              <div 
                                key={m.id || idx}
                                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                                  m.id === entity.id 
                                    ? 'bg-indigo-500/20 border-indigo-500/50 font-bold text-white' 
                                    : 'bg-slate-950 border-slate-800 text-slate-300'
                                }`}
                              >
                                <span className="truncate">{m.name}</span>
                                <span className="text-[10px] font-mono text-slate-500">{m.type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No community data calculated.</p>
                  )}
                </div>
              )}

              {/* TAB 6: HEURISTIC PATTERNS */}
              {activeTab === 'patterns' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                      Heuristic Behavioral Patterns ({patternsList.length})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Explainable pattern signatures involving {entity.name}.
                    </p>
                  </div>

                  {patternsList.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 italic bg-slate-950/50 rounded-2xl border border-slate-800">
                      No suspicious heuristic patterns flagged for this entity.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {patternsList.map((pat, idx) => (
                        <div 
                          key={idx} 
                          className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold uppercase text-amber-400 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                              {pat.type.replace('_', ' ')}
                            </span>
                            <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                              pat.severity === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              Severity: {pat.severity}
                            </span>
                          </div>

                          <div className="text-xs text-slate-200 leading-relaxed font-sans">
                            {pat.evidence}
                          </div>

                          {pat.why && (
                            <div className="p-2.5 bg-slate-900 rounded-xl text-[11px] text-slate-400 font-mono">
                              <span className="text-slate-500 block text-[9px] uppercase font-bold">Investigative Rationale:</span>
                              <span>{pat.why}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: IN-MODAL CONNECTION FINDER */}
              {activeTab === 'paths' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                      Target Connection Traversal
                    </h3>
                    <p className="text-xs text-slate-400">
                      Compute shortest investigative path from <strong className="text-cyan-300">{entity.name}</strong> to any counterpart entity.
                    </p>
                  </div>

                  {/* Finder Controls */}
                  <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-950/90 rounded-2xl border border-slate-800">
                    <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
                      <span>From:</span>
                      <span className="font-bold text-cyan-400 px-2 py-1 rounded bg-slate-900 border border-slate-800">
                        {entity.name}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-500 hidden sm:block" />

                    <div className="flex-1 min-w-[200px]">
                      <select
                        value={targetEntityId}
                        onChange={(e) => setTargetEntityId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="">Select Destination Entity...</option>
                        {allEntities
                          .filter(e => e.id !== entity.id)
                          .map(e => (
                            <option key={e.id} value={e.id}>
                              {e.name} ({e.type})
                            </option>
                          ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={!targetEntityId || findingPath}
                      onClick={handleFindPath}
                      className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      {findingPath ? 'Traversing...' : 'Find Connection'}
                    </button>
                  </div>

                  {pathError && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-mono">
                      {pathError}
                    </div>
                  )}

                  {pathResult && (
                    <div className="p-4 bg-slate-950/90 rounded-2xl border border-cyan-500/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-cyan-300">
                          Connection Path Found ({pathResult.hop_count} Hops • Avg Conf: {((pathResult.average_confidence || 0.5)*100).toFixed(0)}%)
                        </span>

                        {onHighlightPath && pathResult.path_nodes && (
                          <button
                            onClick={() => {
                              onHighlightPath(pathResult.path_nodes);
                              onClose();
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition hover:bg-cyan-500/30 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Highlight Path in 3D</span>
                          </button>
                        )}
                      </div>

                      {/* Hop Steps */}
                      {pathResult.steps && (
                        <div className="space-y-2 font-mono text-xs">
                          {pathResult.steps.map((st, i) => (
                            <div key={i} className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-cyan-400 font-bold">Step {st.hop_number}: {st.relation_type}</span>
                                <span className="text-slate-400">{((st.confidence || 0.5)*100).toFixed(0)}% Confidence</span>
                              </div>
                              <div className="text-white font-sans font-bold">
                                {st.source_name} → {st.target_name}
                              </div>
                              {st.evidence_quotes && st.evidence_quotes.length > 0 && (
                                <div className="text-[10px] text-slate-400 italic pt-1">
                                  "{st.evidence_quotes[0]}"
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 8: INVESTIGATOR FIELD NOTES */}
              {activeTab === 'notes' && (
                <div className="space-y-4 font-sans">
                  <div>
                    <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                      Investigative Field Notes ({notesList.length})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Confidential observations and qualitative hypotheses regarding {entity.name}.
                    </p>
                  </div>

                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={2}
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder={`Record field note or hypothesis regarding ${entity.name}...`}
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingNote || !newNoteText.trim()}
                        className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                      >
                        {savingNote ? 'Saving...' : '+ Add Field Note'}
                      </button>
                    </div>
                  </form>

                  {/* Existing Notes */}
                  {notesList.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-4 bg-slate-950/50 rounded-xl text-center">
                      No field notes attached to this entity yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {notesList.map((n) => (
                        <div 
                          key={n.note_id}
                          className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-2xl flex items-start justify-between space-x-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                              <span className="text-cyan-400 font-bold">{n.author}</span>
                              <span>•</span>
                              <span>{n.created_at}</span>
                            </div>
                            <p className="text-slate-200 leading-relaxed font-sans">{n.note_text}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteNote(n.note_id)}
                            className="text-slate-500 hover:text-rose-400 transition p-1 cursor-pointer"
                            title="Delete Note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </>
          )}

        </div>

        {/* ===================================================================== */}
        {/* FOOTER BAR                                                            */}
        {/* ===================================================================== */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-500 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Cryptographically Verified Intelligence Pipeline</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition cursor-pointer"
          >
            Close Dossier
          </button>
        </div>

      </div>
    </div>
  );
}
