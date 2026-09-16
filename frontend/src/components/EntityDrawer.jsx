import React, { useState } from 'react';
import { 
  X, 
  User, 
  MapPin, 
  Car, 
  Phone, 
  Building2, 
  Circle, 
  Activity, 
  Link2, 
  FileCheck,
  AlertTriangle,
  Layers,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { getEntityColor, RELATION_LABELS } from '../utils/colors';

export default function EntityDrawer({ 
  entityDetail, 
  loading, 
  onClose, 
  onSelectNeighbor,
  onOpenVehiclesTab
}) {
  const [minimized, setMinimized] = useState(false);

  if (!entityDetail && !loading) return null;

  const entity = entityDetail?.entity;
  const centrality = entityDetail?.centrality;
  const connections = entityDetail?.connections || [];
  const colorTheme = entity ? getEntityColor(entity.type) : null;

  const getIcon = (type) => {
    switch (type) {
      case 'Person': return User;
      case 'Location': return MapPin;
      case 'Vehicle': return Car;
      case 'PhoneNumber': return Phone;
      case 'Organization': return Building2;
      default: return Circle;
    }
  };

  const Icon = entity ? getIcon(entity.type) : Circle;

  // Minimized Floating Bar
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 p-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-xs animate-in slide-in-from-bottom">
        <div className="flex items-center space-x-2">
          <Icon className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-100">{entity?.name}</span>
        </div>
        <button
          onClick={() => setMinimized(false)}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
          title="Expand Profile"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Semi-transparent backdrop on small screens (Click to Dismiss so it never traps the user) */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Non-overlapping Sliding Panel */}
      <aside className="fixed top-16 bottom-0 right-0 w-full sm:w-96 bg-slate-950/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header with Close & Minimize */}
        <div className="p-4 border-b border-slate-800 flex items-start justify-between bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0"
              style={{ backgroundColor: `${colorTheme?.fill}20`, borderColor: `${colorTheme?.fill}40`, borderWidth: 1 }}
            >
              <Icon className="w-5 h-5" style={{ color: colorTheme?.fill }} />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base leading-tight">
                {entity?.name || 'Inspecting Entity...'}
              </h3>
              <div className="flex items-center space-x-1.5 mt-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorTheme?.badge}`}>
                  {entity?.type || 'Entity'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">ID: {entity?.id}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setMinimized(true)}
              className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition"
              title="Minimize to floating widget"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition"
              title="Close Profile"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading intelligence dossier...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300">
            
            {/* Centrality Metrics */}
            <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center">
                <Activity className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                Network Centrality
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">Degree (Hub)</span>
                  <p className="text-base font-mono font-bold text-sky-400">
                    {((centrality?.degree || 0) * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">Betweenness (Broker)</span>
                  <p className={`text-base font-mono font-bold ${
                    (centrality?.betweenness || 0) > 0.4 ? 'text-rose-400' : 'text-amber-400'
                  }`}>
                    {((centrality?.betweenness || 0) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Attributes & Aliases */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center">
                <Layers className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                Attributes & Dossier
              </h4>
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 space-y-2 font-sans">
                {entity?.aliases && entity.aliases.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-500">Aliases:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entity.aliases.map((alias, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-950 rounded text-slate-300 border border-slate-800 font-mono text-[10px]">
                          {alias}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {entity?.attributes && Object.keys(entity.attributes).length > 0 && (
                  <div className="pt-1.5 border-t border-slate-800 space-y-1">
                    {Object.entries(entity.attributes).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-0.5 font-mono text-[10px]">
                        <span className="text-slate-400">{k}:</span>
                        <span className="text-cyan-300 font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Direct Connections */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span className="flex items-center">
                  <Link2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  Direct Connections ({connections.length})
                </span>
              </h4>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {connections.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic bg-slate-900/40 p-3 rounded-lg">
                    No confirmed connections.
                  </p>
                ) : (
                  connections.map((conn, idx) => (
                    <div 
                      key={idx}
                      onClick={() => onSelectNeighbor(conn.entity_id)}
                      className="p-2 rounded-lg bg-slate-900/70 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition flex flex-col space-y-1 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 group-hover:text-cyan-300 transition">
                          {conn.entity_name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          {conn.relation_type}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Verbatim Evidence */}
            {entity?.source_refs && entity.source_refs.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 flex items-center uppercase">
                  <FileCheck className="w-3 h-3 mr-1 text-slate-400" /> Source Intercepts
                </span>
                <div className="flex flex-wrap gap-1">
                  {entity.source_refs.map((ref, idx) => (
                    <span key={idx} className="text-[9px] font-mono px-2 py-0.5 bg-slate-950 text-slate-400 rounded border border-slate-800">
                      {ref}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </aside>
    </>
  );
}
