import React, { useState, useMemo } from 'react';
import { 
  Car, 
  User, 
  MapPin, 
  AlertTriangle, 
  Search, 
  ArrowUpRight, 
  ShieldAlert, 
  Eye, 
  FileText,
  Radio,
  ExternalLink,
  Layers
} from 'lucide-react';

export default function VehiclesView({ 
  graphData, 
  patterns, 
  onInspectEntity, 
  onNavigateToGraph 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'SHARED' | 'HIGH_THREAT'

  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];

  // Extract all vehicle nodes and enrich with drivers, sightings, and shared status
  const vehicles = useMemo(() => {
    const vehicleNodes = nodes.filter(n => n.type === 'Vehicle');

    return vehicleNodes.map(veh => {
      // Find all relationships touching this vehicle
      const relatedLinks = links.filter(l => {
        const sId = typeof l.source === 'object' && l.source !== null ? l.source.id : l.source;
        const tId = typeof l.target === 'object' && l.target !== null ? l.target.id : l.target;
        return sId === veh.id || tId === veh.id;
      });

      // Extract drivers / owners (Person entities)
      const drivers = [];
      const locations = [];
      const evidenceList = [];

      relatedLinks.forEach(link => {
        const sId = typeof link.source === 'object' && link.source !== null ? link.source.id : link.source;
        const tId = typeof link.target === 'object' && link.target !== null ? link.target.id : link.target;
        const otherId = sId === veh.id ? tId : sId;
        const otherNode = nodes.find(n => n.id === otherId);

        if (otherNode) {
          if (otherNode.type === 'Person') {
            drivers.push(otherNode);
          } else if (otherNode.type === 'Location') {
            locations.push(otherNode);
          }
        }

        if (link.evidence && link.evidence.length) {
          evidenceList.push(...link.evidence);
        }
      });

      // Check if this vehicle is flagged in shared_attribute patterns
      const isShared = drivers.length > 1 || patterns?.some(
        p => p.pattern_type === 'shared_attribute' && p.entities_involved.includes(veh.id)
      );

      return {
        ...veh,
        drivers,
        locations,
        evidenceList: [...new Set(evidenceList)],
        isShared,
        degree: veh.centrality?.degree || 0,
        betweenness: veh.centrality?.betweenness || 0,
      };
    });
  }, [nodes, links, patterns]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (v.attributes?.model && v.attributes.model.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            v.drivers.some(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (filterMode === 'SHARED') return matchesSearch && v.isShared;
      if (filterMode === 'HIGH_THREAT') return matchesSearch && (v.isShared || v.betweenness > 0.2);
      return matchesSearch;
    });
  }, [vehicles, searchQuery, filterMode]);

  const sharedCount = vehicles.filter(v => v.isShared).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Top Banner & KPI Telemetry */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Tracked Vehicles</span>
            <span className="text-xl font-mono font-black text-slate-100">{vehicles.length}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Multi-Suspect Shared</span>
            <span className="text-xl font-mono font-black text-rose-300">{sharedCount}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Active Sightings</span>
            <span className="text-xl font-mono font-black text-cyan-300">
              {vehicles.reduce((acc, v) => acc + v.locations.length, 0)}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Fleet Surveillance</span>
            <span className={`text-xs font-bold block mt-1 ${vehicles.length > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>
              {vehicles.length > 0 ? 'Live Tracking Active' : 'No Fleet Monitored'}
            </span>
          </div>
        </div>

      </div>

      {/* Toolbar: Search & Filter Pills */}
      <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
        
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search plate, model, driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 text-xs text-slate-200 pl-9 pr-3 py-1.5 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500 w-52 sm:w-64 font-sans"
            />
          </div>

          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                filterMode === 'ALL' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Fleet ({vehicles.length})
            </button>
            <button
              onClick={() => setFilterMode('SHARED')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                filterMode === 'SHARED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Shared Only ({sharedCount})
            </button>
            <button
              onClick={() => setFilterMode('HIGH_THREAT')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                filterMode === 'HIGH_THREAT' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              High Threat
            </button>
          </div>
        </div>

        <span className="text-xs text-slate-500 font-mono">
          Showing {filteredVehicles.length} of {vehicles.length} transports
        </span>

      </div>

      {/* Vehicle Cards Grid */}
      {filteredVehicles.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
          <Car className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="font-bold text-slate-300 text-sm">No Vehicles Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No vehicle records match your search or filter. Ingest syndicate case files to populate vehicle intelligence.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((veh) => {
            const model = veh.attributes?.model || 'Transport Vehicle';
            const ownership = veh.attributes?.ownership || 'Unregistered / Under Investigation';

            return (
              <div 
                key={veh.id}
                className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 shadow-xl transition space-y-4 flex flex-col justify-between group"
              >
                
                {/* Plate Header & Status */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    
                    {/* Realistic Holographic License Plate */}
                    <div className="px-3.5 py-1.5 rounded-lg bg-slate-950 border-2 border-slate-700 shadow-inner flex items-center space-x-2">
                      <span className="text-[9px] font-black tracking-widest text-amber-500 uppercase">IND</span>
                      <span className="text-sm font-black font-mono tracking-wider text-slate-100">{veh.name}</span>
                    </div>

                    {veh.isShared ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3 mr-0.5" />
                        <span>Shared Pool Car</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                        Assigned Vehicle
                      </span>
                    )}

                  </div>

                  {/* Make & Model */}
                  <div>
                    <h4 className="font-bold text-slate-100 text-sm group-hover:text-cyan-300 transition">
                      {model}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                      Registered Owner: <span className="text-slate-300">{ownership}</span>
                    </p>
                  </div>

                  {/* Drivers / Operatives Linked */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center">
                      <User className="w-3 h-3 mr-1 text-slate-400" /> Known Operatives & Drivers ({veh.drivers.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {veh.drivers.length === 0 ? (
                        <span className="text-[10px] text-slate-500 italic">No direct drivers identified yet.</span>
                      ) : (
                        veh.drivers.map((drv) => (
                          <button
                            key={drv.id}
                            onClick={() => onNavigateToGraph(drv.id)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold flex items-center space-x-1 transition"
                            title={`Inspect ${drv.name} in 3D Graph`}
                          >
                            <span>{drv.name}</span>
                            <ArrowUpRight className="w-3 h-3 text-indigo-400" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Sighting Locations */}
                  {veh.locations.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center">
                        <MapPin className="w-3 h-3 mr-1 text-emerald-400" /> Logged Sightings
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {veh.locations.map((loc) => (
                          <button
                            key={loc.id}
                            onClick={() => onNavigateToGraph(loc.id)}
                            className="px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-medium flex items-center space-x-1 transition"
                          >
                            <span>{loc.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Forensic Evidence Snippet */}
                  {veh.evidenceList.length > 0 && (
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-[10px] text-slate-300 italic font-mono leading-relaxed">
                      "{veh.evidenceList[0]}"
                    </div>
                  )}

                </div>

                {/* Bottom Action: View in 3D Hologram */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500">ID: {veh.id}</span>
                  <button
                    onClick={() => onNavigateToGraph(veh.id)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition shadow-sm"
                  >
                    <span>Locate in 3D Graph</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
