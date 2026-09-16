import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Building, 
  Search, 
  ArrowUpRight, 
  ShieldAlert, 
  User, 
  Car, 
  Camera, 
  Fingerprint, 
  Radio, 
  AlertOctagon,
  Layers,
  ExternalLink
} from 'lucide-react';

export default function LocationsView({ 
  graphData, 
  onInspectEntity, 
  onNavigateToGraph 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'SAFEDOCKS' | 'MEETING'

  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];

  const locations = useMemo(() => {
    return nodes.filter(n => n.type === 'Location').map(loc => {
      const locLinks = links.filter(l => l.source === loc.id || l.target === loc.id);
      
      const visitors = [];
      const vehicles = [];
      const evidence = [];

      locLinks.forEach(link => {
        const otherId = link.source === loc.id ? link.target : link.source;
        const otherNode = nodes.find(n => n.id === otherId);
        if (otherNode) {
          if (otherNode.type === 'Person') visitors.push(otherNode);
          if (otherNode.type === 'Vehicle') vehicles.push(otherNode);
          if (otherNode.type === 'Organization') visitors.push(otherNode);
        }
        if (link.evidence) evidence.push(...link.evidence);
      });

      const facilityType = loc.attributes?.type || 'Tactical Site';
      const security = loc.attributes?.security || loc.attributes?.surveillance || 'Field Surveillance';

      return {
        ...loc,
        facilityType,
        security,
        visitors,
        vehicles,
        evidence: [...new Set(evidence)],
        degree: loc.centrality?.degree || 0,
        betweenness: loc.centrality?.betweenness || 0,
      };
    });
  }, [nodes, links]);

  const filteredLocations = useMemo(() => {
    return locations.filter(l => {
      const q = searchQuery.toLowerCase();
      const match = l.name.toLowerCase().includes(q) ||
                    l.facilityType.toLowerCase().includes(q) ||
                    l.visitors.some(v => v.name.toLowerCase().includes(q));
      
      if (filterType === 'SAFEDOCKS') return match && (l.facilityType.toLowerCase().includes('port') || l.facilityType.toLowerCase().includes('safehouse'));
      if (filterType === 'MEETING') return match && l.facilityType.toLowerCase().includes('meeting');
      return match;
    });
  }, [locations, searchQuery, filterType]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Top Banner & Telemetry */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{locations.length}</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Monitored Facilities</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertOctagon className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-400">
              {locations.filter(l => l.facilityType.toLowerCase().includes('safehouse')).length || 1}
            </div>
            <div className="text-[11px] text-rose-300/80 font-medium uppercase tracking-wider">Active Safehouses</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-cyan-300">CCTV / Drone</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Optical Coverage</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Fingerprint className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-purple-300">Biometric</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Access Intercepted</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search facility, port dock, safehouse, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterType === 'ALL'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
            }`}
          >
            All Sites ({locations.length})
          </button>
          <button
            onClick={() => setFilterType('SAFEDOCKS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterType === 'SAFEDOCKS'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
            }`}
          >
            Safehouses & Docks
          </button>
          <button
            onClick={() => setFilterType('MEETING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterType === 'MEETING'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
            }`}
          >
            Meeting Drops
          </button>
        </div>
      </div>

      {/* Grid of Location Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredLocations.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
            No locations matching search query.
          </div>
        ) : (
          filteredLocations.map((loc) => (
            <div
              key={loc.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 shadow-xl transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {loc.facilityType}
                    </span>
                    <h4 className="text-base font-black text-white mt-2 flex items-center space-x-2">
                      <span>{loc.name}</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono flex items-center space-x-1">
                      <Camera className="w-3 h-3 text-cyan-400 inline" />
                      <span>{loc.security}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => onNavigateToGraph(loc.id)}
                    title="Focus location in 3D Orbit"
                    className="p-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition shadow-sm hover:scale-105"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Sighted Suspects */}
                <div className="mt-4 pt-3 border-t border-slate-800">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center space-x-1 mb-1.5">
                    <User className="w-3 h-3 text-cyan-400" />
                    <span>Suspects Sighted / Logged ({loc.visitors.length})</span>
                  </span>

                  <div className="flex flex-wrap gap-1.5">
                    {loc.visitors.length === 0 ? (
                      <span className="text-xs text-slate-500 italic">No direct sightings recorded</span>
                    ) : (
                      loc.visitors.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => onInspectEntity(v.id)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-200 border border-slate-700/60 hover:border-cyan-500/40 text-xs transition"
                        >
                          <span>{v.name}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Evidence snippet */}
                {loc.evidence && loc.evidence.length > 0 && (
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 italic">
                    "{loc.evidence[0]}"
                  </div>
                )}
              </div>

              <div className="mt-4 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Centrality: {Number(loc.betweenness).toFixed(3)}</span>
                <span className="text-emerald-400">Raid Target Eligible</span>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}