import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Network,
  ShieldCheck,
  CheckSquare,
  Users2,
  GitFork,
  AlertOctagon,
  BarChart3,
  FileText,
  UploadCloud,
  ArrowRight,
  TrendingUp,
  FolderLock,
  ExternalLink,
  Lock,
  Shield,
  Award,
  Crosshair,
  Sparkles,
  HelpCircle,
  Clock,
  ShieldAlert,
  Target
} from 'lucide-react';
import CrimeTypeSelector from './CrimeTypeSelector';
import InvestigationQuestions from './InvestigationQuestions';
import { fetchCaseLeads, fetchCaseInvestigationQuestions } from '../services/api';

export default function DashboardOverview({
  activeCase,
  graphData = { nodes: [], links: [] },
  centralityList = [],
  patternFlags = [],
  evidenceList = [],
  validationQueue = [],
  communities = [],
  crimeProfiles = [],
  activeProfileId = 'organized_crime',
  onSelectProfile,
  onNavigate,
  onInspectEntity,
  onDeepInspect
}) {
  const [leads, setLeads] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const nodeCount = graphData?.nodes?.length || 0;
  const linkCount = graphData?.links?.length || 0;
  const strongLinks = (graphData?.links || []).filter(l => (l?.confidence || 0) >= 0.7).length;

  const currentProfile = (crimeProfiles || []).find(p => p?.id === (activeCase?.investigation_type || activeProfileId)) || crimeProfiles?.[0] || {
    id: 'organized_crime',
    name: 'Organized Crime Network'
  };

  useEffect(() => {
    if (!activeCase?.case_id) return;
    const loadLeadsAndQuestions = async () => {
      setLoadingLeads(true);
      try {
        const [lList, qList] = await Promise.all([
          fetchCaseLeads(activeCase.case_id).catch(() => []),
          fetchCaseInvestigationQuestions(activeCase.case_id).catch(() => [])
        ]);
        setLeads(lList || []);
        setQuestions(qList || []);
      } catch (err) {
        console.error('Error loading dashboard leads:', err);
      } finally {
        setLoadingLeads(false);
      }
    };
    loadLeadsAndQuestions();
  }, [activeCase?.case_id, activeCase?.investigation_type]);

  const topLeads = leads.slice(0, 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      
      {/* Top Banner / Case Dossier Summary */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/30 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative z-30">
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute right-0 top-0 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl" />
        </div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                ACTIVE CASE INTELLIGENCE
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-950/80 px-2.5 py-0.5 rounded-full border border-slate-800">
                CASE ID: <span className="text-slate-200">{activeCase?.case_id || 'case-001'}</span>
              </span>
              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                {activeCase?.status || 'Open'}
              </span>
              
              {/* Mandatory Fictional Data Disclaimer Badge */}
              <span className="text-[10px] font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                DEMO / FICTIONAL DATA
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3 mt-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {activeCase?.case_name || 'Operation Falcon Shadow'}
              </h1>
              
              {/* Crime Profile Selector Pill */}
              <CrimeTypeSelector
                profiles={crimeProfiles}
                activeProfileId={activeCase?.investigation_type || activeProfileId}
                onSelectProfile={onSelectProfile}
              />
            </div>

            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {activeCase?.description || 'AI-assisted digital forensics, telecommunications cross-matching, and deterministic NetworkX relationship analysis.'}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('graph')}
              className="flex items-center space-x-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs transition shadow-lg shadow-cyan-500/20 hover:scale-105 cursor-pointer"
            >
              <Network className="w-4 h-4 text-slate-950" />
              <span>Launch 3D Orbit</span>
            </button>
            <button
              onClick={() => onNavigate('reports')}
              className="flex items-center space-x-2 px-4 py-2 rounded-2xl bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs hover:bg-slate-700 transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Export Dossier</span>
            </button>
          </div>
        </div>
      </div>

      {/* Investigation Overview Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div
          onClick={() => onNavigate('graph')}
          className="bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-4 cursor-pointer transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Verified Entities</span>
            <Network className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">{nodeCount}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Isolated Node Graph</div>
        </div>

        <div
          onClick={() => onNavigate('graph')}
          className="bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 cursor-pointer transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Relationships</span>
            <GitFork className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">{linkCount}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Directional Links</div>
        </div>

        <div
          onClick={() => onNavigate('evidence')}
          className="bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 cursor-pointer transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Evidence Files</span>
            <FileText className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">{evidenceList.length}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">SHA-256 Verified</div>
        </div>

        <div
          onClick={() => onNavigate('timeline')}
          className="bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-4 cursor-pointer transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Timeline Events</span>
            <Clock className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">
            {(graphData?.links || []).filter(l => l?.event_id).length || linkCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Temporal Logs</div>
        </div>

        <div
          onClick={() => onNavigate('communities')}
          className="bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-4 cursor-pointer transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Communities</span>
            <Users2 className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">{communities.length}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Modularity Clusters</div>
        </div>

        <div
          onClick={() => onNavigate('validation')}
          className="bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 cursor-pointer transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Validation Queue</span>
            <CheckSquare className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-amber-300 mt-2">{validationQueue.length}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Pending Review</div>
        </div>
      </div>

      {/* Main Grid: Key Investigative Leads + Investigation Questions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN (7 Cols): KEY INVESTIGATIVE LEADS */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                    Key Investigative Leads
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Prioritization indicator based on evidence, timeline, and topology
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono text-slate-500">
                Sorted by Lead Score (0–100)
              </span>
            </div>

            {loadingLeads ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500">
                Calculating multi-factor investigation lead scores...
              </div>
            ) : topLeads.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 italic bg-slate-950/50 rounded-2xl">
                No investigative leads prioritized yet. Ingest evidence data to populate lead scores.
              </div>
            ) : (
              <div className="space-y-2.5">
                {topLeads.map((lead, idx) => (
                  <div
                    key={lead?.entity_id || idx}
                    className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 transition space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-amber-400">
                            #{idx + 1}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            {lead?.entity_type || 'Entity'}
                          </span>
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.2 rounded uppercase border ${
                            (lead?.score || 0) >= 60 
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}>
                            {lead?.status || 'Active'}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-white truncate">
                          {lead?.entity_name || lead?.entity_id || 'Unknown Entity'}
                        </h4>
                      </div>

                      {/* Score & Deep Inspect Button */}
                      <div className="text-right shrink-0 flex flex-col items-end space-y-1">
                        <div className="text-lg font-black font-mono text-amber-300">
                          {lead?.score ?? 0} <span className="text-[10px] font-normal text-slate-500">/ 100</span>
                        </div>
                        {onDeepInspect && (
                          <button
                            type="button"
                            onClick={() => onDeepInspect(lead?.entity_id)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-[10px] transition shadow cursor-pointer"
                          >
                            <Crosshair className="w-3 h-3" />
                            <span>DEEP INSPECT</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Contributing observations preview */}
                    {lead?.contributing_observations && lead.contributing_observations.length > 0 && (
                      <div className="text-[11px] text-slate-400 line-clamp-1 font-mono pt-1 border-t border-slate-900">
                        • {typeof lead.contributing_observations[0] === 'string' ? lead.contributing_observations[0] : JSON.stringify(lead.contributing_observations[0])}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Transparent Disclaimer */}
            <div className="text-[10px] text-slate-500 font-mono pt-1 leading-relaxed border-t border-slate-800/80">
              * This indicator supports investigative prioritization only. It is not a determination of guilt, criminality, or legal responsibility.
            </div>
          </div>

          {/* Important Behavioral Patterns */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                  Important Heuristic Patterns ({(patternFlags || []).length})
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Explainable Detections</span>
            </div>

            {(patternFlags || []).length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 italic bg-slate-950/50 rounded-2xl">
                No abnormal heuristic patterns flagged.
              </div>
            ) : (
              <div className="space-y-2">
                {(patternFlags || []).slice(0, 3).map((pat, idx) => {
                  const patType = (pat?.pattern_type || pat?.type || 'PATTERN').toString().replace(/_/g, ' ');
                  const patSeverity = pat?.severity || 'medium';
                  const patEvidence = Array.isArray(pat?.evidence)
                    ? pat.evidence.join('; ')
                    : (pat?.evidence || pat?.why || 'Pattern identified in network.');
                  return (
                    <div key={idx} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-400 text-[11px] uppercase">
                          {patType}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">{patSeverity} severity</span>
                      </div>
                      <p className="text-slate-300 leading-snug">{patEvidence}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (5 Cols): CRIME-SPECIFIC INVESTIGATION QUESTIONS */}
        <div className="lg:col-span-5 space-y-4">
          <InvestigationQuestions
            questions={questions}
            profileName={currentProfile.name}
            onExploreQuestion={(q) => {
              onNavigate('graph');
            }}
          />

          {/* Key Community Clusters Shortcut */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <Users2 className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                  Community Clusters ({(communities || []).length})
                </h3>
              </div>
              <button
                onClick={() => onNavigate('communities')}
                className="text-[11px] text-cyan-400 hover:text-white font-mono flex items-center space-x-1 cursor-pointer"
              >
                <span>View All →</span>
              </button>
            </div>

            <div className="space-y-2">
              {(communities || []).slice(0, 3).map((comm, idx) => (
                <div key={comm?.community_id || idx} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">{comm?.name || `Community ${idx + 1}`}</span>
                    <span className="text-[10px] font-mono text-slate-400">{comm?.size || 0} member entities • Density: {Number(comm?.density || 0).toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => onNavigate('communities')}
                    className="text-[10px] font-mono px-2 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition cursor-pointer"
                  >
                    Examine
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
