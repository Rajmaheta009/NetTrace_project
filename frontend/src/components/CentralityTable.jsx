import React from 'react';
import { 
  Trophy, 
  HelpCircle, 
  ArrowUpRight, 
  ShieldCheck, 
  AlertCircle,
  Network
} from 'lucide-react';
import { getEntityColor } from '../utils/colors';

export default function CentralityTable({ 
  centralityData, 
  onInspectEntity 
}) {
  const list = centralityData || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Plain-English Educational Guide */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-start space-x-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm sm:text-base">
              Understanding Network Influence (Centrality)
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              In criminal network intelligence, not all participants are equally important. We compute two non-AI mathematical metrics to surface hidden leaders and key conduits:
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-sky-400 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-sky-400 mr-2" /> Degree Centrality (Direct Hubs)
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Measures how many direct connections a person or object possesses. High degree indicates active communicators or primary meeting spots.
                </p>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-rose-400 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-rose-400 mr-2" /> Betweenness Centrality (Key Brokers)
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Measures how often someone sits on the shortest path between other suspects. High betweenness reveals **critical brokers, kingpins, or smugglers** who bridge separate cells.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-100 text-sm">Ranked Entity Leaderboard</h4>
            <p className="text-xs text-slate-500">Sorted by Brokerage (Betweenness) and Connectivity (Degree)</p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
            {list.length} Entities Ranked
          </span>
        </div>

        {list.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No entities available. Run Reset & Demo or ingest case files to calculate rankings.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3 w-16">Rank</th>
                  <th className="px-6 py-3">Entity Details</th>
                  <th className="px-6 py-3">Degree (Direct Links)</th>
                  <th className="px-6 py-3">Betweenness (Broker Role)</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {list.map((item, idx) => {
                  const degreePct = Math.round((item.degree || 0) * 100);
                  const betweennessPct = Math.round((item.betweenness || 0) * 100);
                  const isTopBroker = betweennessPct >= 80;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      
                      {/* Rank Badge */}
                      <td className="px-6 py-4">
                        {idx === 0 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-bold text-xs">
                            1
                          </span>
                        ) : idx === 1 ? (
                          <span className="w-6 h-6 rounded-full bg-slate-400/20 border border-slate-400/40 text-slate-300 flex items-center justify-center font-bold text-xs">
                            2
                          </span>
                        ) : idx === 2 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-700/20 border border-amber-700/40 text-amber-500 flex items-center justify-center font-bold text-xs">
                            3
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono pl-2">#{idx + 1}</span>
                        )}
                      </td>

                      {/* Name & ID */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-100 flex items-center space-x-2">
                          <span>{item.name}</span>
                          {isTopBroker && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold uppercase tracking-wider">
                              Key Broker
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">ID: {item.id}</span>
                      </td>

                      {/* Degree Bar */}
                      <td className="px-6 py-4">
                        <div className="w-36 space-y-1">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-slate-400">{degreePct}%</span>
                            <span className="text-slate-500">{item.degree?.toFixed(3)}</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-sky-400 h-full rounded-full transition-all"
                              style={{ width: `${degreePct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Betweenness Bar */}
                      <td className="px-6 py-4">
                        <div className="w-36 space-y-1">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className={betweennessPct > 50 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                              {betweennessPct}%
                            </span>
                            <span className="text-slate-500">{item.betweenness?.toFixed(3)}</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                betweennessPct > 50 ? 'bg-rose-500' : 'bg-amber-400'
                              }`}
                              style={{ width: `${betweennessPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => onInspectEntity(item.id)}
                          className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-[11px] transition"
                        >
                          <span>Inspect</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
}
