import React, { useState, useMemo } from 'react';
import {
  GitFork,
  Search,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Network
} from 'lucide-react';
import { fetchConnections } from '../services/api';

export default function ConnectionFinderView({ activeCase, graphData, onHighlightPathInGraph }) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [pathResult, setPathResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const entities = useMemo(() => graphData.nodes || [], [graphData]);

  const handleSearchPath = async (e) => {
    e.preventDefault();
    if (!sourceId || !targetId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConnections(sourceId, targetId, activeCase?.case_id);
      setPathResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
          <GitFork className="w-6 h-6 text-cyan-400" />
          <span>Connection Finder & Link Step Breakdown</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Trace shortest operational path between any two targets with step-by-step evidence citations and confidence scoring.
        </p>
      </div>

      {/* Selector Form */}
      <form onSubmit={handleSearchPath} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Source Entity (Origin Target)</label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="">-- Select Source Suspect / Entity --</option>
              {entities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.name} ({ent.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Entity (Destination Target)</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="">-- Select Target Suspect / Entity --</option>
              {entities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.name} ({ent.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-[11px] text-slate-500 font-mono">
            {entities.length} selectable entities in active case
          </div>
          <button
            type="submit"
            disabled={loading || !sourceId || !targetId}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            <span>Trace Shortest Path</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300 font-mono">
          {error}
        </div>
      )}

      {/* Path Results */}
      {pathResult && (
        <div className="space-y-4">
          {pathResult.found ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold text-slate-100">
                    Connection Path Discovered: {pathResult.hops} Hop{pathResult.hops === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-700/60 px-2.5 py-0.5 rounded-full">
                    Avg Confidence: {(pathResult.average_confidence * 100).toFixed(0)}%
                  </span>
                  <button
                    onClick={() => onHighlightPathInGraph(pathResult.path_nodes.map(n => n.id))}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold cursor-pointer hover:bg-cyan-400 transition-colors"
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span>Highlight in 3D</span>
                  </button>
                </div>
              </div>

              {/* Step by Step Breakdown */}
              <div className="space-y-3">
                {pathResult.path_edges.map((step, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 font-bold">
                        <span className="text-cyan-400">Hop {sIdx + 1}:</span>
                        <span className="text-slate-200">{step.source_name}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-amber-300 font-mono">[{step.relation_type}]</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-200">{step.target_name}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-700 text-cyan-300 font-semibold">
                        {(step.confidence * 100).toFixed(0)}% • {step.confidence_label}
                      </span>
                    </div>

                    {step.evidence && step.evidence.length > 0 && (
                      <div className="text-[11px] text-slate-400 pl-4 border-l-2 border-slate-800 space-y-1">
                        <div className="font-semibold text-slate-500 text-[10px] uppercase font-mono">Evidence Citations:</div>
                        {step.evidence.map((ev, eIdx) => (
                          <div key={eIdx}>• {ev}</div>
                        ))}
                      </div>
                    )}

                    {step.source_file && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        Source Artifact: {step.source_file} {step.evidence_id ? `(${step.evidence_id})` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl text-center space-y-2">
              <AlertCircle className="w-6 h-6 text-slate-500 mx-auto" />
              <div className="text-sm font-bold text-slate-300">No Connection Path Exists</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {pathResult.message || 'These two entities belong to disconnected subgraphs in the current case.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
