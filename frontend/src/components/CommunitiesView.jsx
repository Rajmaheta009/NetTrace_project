import React, { useState, useEffect } from 'react';
import {
  Users2,
  RefreshCw,
  Sparkles,
  Network,
  Share2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { fetchCommunities } from '../services/api';

export default function CommunitiesView({ activeCase, onHighlightInGraph }) {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadCommunities = async () => {
    setLoading(true);
    try {
      const data = await fetchCommunities(activeCase?.case_id);
      setCommunities(data);
    } catch (err) {
      console.error('Failed to load communities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommunities();
  }, [activeCase?.case_id]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <Users2 className="w-6 h-6 text-indigo-400" />
            <span>Community & Cluster Detection</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            NetworkX modularity-driven sub-network partitioning with non-accusatory neutral labels. Identifies tightly operating clusters.
          </p>
        </div>
        <button
          onClick={loadCommunities}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 cursor-pointer self-start"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* Communities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {communities.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 font-mono text-xs">
            No communities detected in the active case graph. Ingest data to analyze network clusters.
          </div>
        ) : (
          communities.map((comm) => (
            <div
              key={comm.community_id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500/50 transition-all shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-100">{comm.name}</span>
                  <span className="text-[10px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                    Density: {comm.density}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-center font-mono">
                  <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-base font-bold text-slate-200">{comm.size}</div>
                    <div className="text-[9px] text-slate-500 uppercase">Entities</div>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-base font-bold text-slate-200">{comm.internal_edges}</div>
                    <div className="text-[9px] text-slate-500 uppercase">Internal Links</div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400">Key Members in Cluster:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {comm.members.slice(0, 6).map((m) => (
                      <span
                        key={m.id}
                        className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                      >
                        {m.name}
                      </span>
                    ))}
                    {comm.members.length > 6 && (
                      <span className="text-[10px] text-slate-500 font-mono self-center">
                        +{comm.members.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800">
                <button
                  onClick={() => onHighlightInGraph(comm.name)}
                  className="w-full py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>Highlight in 3D Network Orbit</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
