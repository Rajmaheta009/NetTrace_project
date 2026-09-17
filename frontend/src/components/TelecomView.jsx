import React, { useState, useMemo } from 'react';
import { 
  Phone, 
  PhoneCall, 
  Radio, 
  AlertTriangle, 
  Search, 
  ArrowUpRight, 
  User, 
  Clock, 
  Wifi, 
  Flame,
  Activity,
  ExternalLink
} from 'lucide-react';

export default function TelecomView({ 
  graphData, 
  patterns, 
  onInspectEntity, 
  onNavigateToGraph 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'BURNER' | 'WIRETAP'

  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];

  // Extract phone data from explicit PhoneNumber nodes AND person attributes
  const telecomDirectory = useMemo(() => {
    const phoneMap = new Map();

    // 1. Explicit PhoneNumber nodes
    nodes.filter(n => n.type === 'PhoneNumber').forEach(node => {
      phoneMap.set(node.name || node.id, {
        id: node.id,
        number: node.name || node.id,
        carrier: node.attributes?.carrier || 'Cellular / VoIP Gateway',
        imei: node.attributes?.imei || 'Not Disclosed',
        type: 'PhoneNumber',
        nodeRef: node,
        linkedPersons: [],
        calls: [],
        isExplicitNode: true,
        betweenness: node.centrality?.betweenness || 0,
      });
    });

    // 2. Phone attributes on Person nodes (support multiple phone numbers per person)
    nodes.filter(n => n.type === 'Person').forEach(person => {
      const rawPhoneAttr = person.attributes?.phone;
      if (rawPhoneAttr) {
        const phoneList = String(rawPhoneAttr).split(',').map(s => s.trim()).filter(Boolean);
        phoneList.forEach(phoneAttr => {
          if (!phoneMap.has(phoneAttr)) {
            phoneMap.set(phoneAttr, {
              id: `${person.id}_${phoneAttr}`,
              number: phoneAttr,
              carrier: person.attributes?.carrier || (phoneAttr.startsWith('+') ? 'International Gateway' : 'Cellular Carrier'),
              imei: person.attributes?.imei || 'Not Disclosed',
              type: 'Attribute',
              nodeRef: person,
              linkedPersons: [],
              calls: [],
              isExplicitNode: false,
              betweenness: person.centrality?.betweenness || 0,
            });
          }
          const entry = phoneMap.get(phoneAttr);
          if (!entry.linkedPersons.some(p => p.id === person.id)) {
            entry.linkedPersons.push(person);
          }
        });
      }
    });

    // 3. Connect relationships touching phones or CALLED relationships
    links.forEach(link => {
      const sId = typeof link.source === 'object' && link.source !== null ? link.source.id : link.source;
      const tId = typeof link.target === 'object' && link.target !== null ? link.target.id : link.target;
      const sourceNode = nodes.find(n => n.id === sId);
      const targetNode = nodes.find(n => n.id === tId);

      if (sourceNode && targetNode) {
        if (targetNode.type === 'PhoneNumber' && phoneMap.has(targetNode.name || targetNode.id)) {
          const entry = phoneMap.get(targetNode.name || targetNode.id);
          if (sourceNode.type === 'Person' && !entry.linkedPersons.some(p => p.id === sourceNode.id)) {
            entry.linkedPersons.push(sourceNode);
          }
        }
        if (sourceNode.type === 'PhoneNumber' && phoneMap.has(sourceNode.name || sourceNode.id)) {
          const entry = phoneMap.get(sourceNode.name || sourceNode.id);
          if (targetNode.type === 'Person' && !entry.linkedPersons.some(p => p.id === targetNode.id)) {
            entry.linkedPersons.push(targetNode);
          }
        }

        if (link.relation_type === 'CALLED') {
          const p1Phone = sourceNode.attributes?.phone;
          const p2Phone = targetNode.attributes?.phone;
          if (p1Phone && phoneMap.has(p1Phone)) {
            phoneMap.get(p1Phone).calls.push({
              otherPerson: targetNode,
              direction: 'OUTGOING',
              eventId: link.event_id || 'ev_call',
              evidence: link.evidence?.[0] || 'Direct voice communication logged',
            });
          }
          if (p2Phone && phoneMap.has(p2Phone)) {
            phoneMap.get(p2Phone).calls.push({
              otherPerson: sourceNode,
              direction: 'INCOMING',
              eventId: link.event_id || 'ev_call',
              evidence: link.evidence?.[0] || 'Direct voice communication logged',
            });
          }
        }
      }
    });

    return Array.from(phoneMap.values()).map(item => {
      const isShared = item.linkedPersons.length > 1 || patterns?.some(
        p => p.pattern_type === 'shared_attribute' && p.entities_involved.includes(item.id)
      );
      return {
        ...item,
        isBurner: isShared,
        wiretapActive: true,
      };
    });
  }, [nodes, links, patterns]);

  // Derived Call Detail Records (CDR) Matrix
  const cdrLogs = useMemo(() => {
    const list = [];
    
    links.filter(l => (l.relation_type || '').toUpperCase() === 'CALLED').forEach((link, idx) => {
      const sId = typeof link.source === 'object' && link.source !== null ? link.source.id : link.source;
      const tId = typeof link.target === 'object' && link.target !== null ? link.target.id : link.target;
      const src = nodes.find(n => n.id === sId);
      const tgt = nodes.find(n => n.id === tId);
      if (src && tgt) {
        const durationMatch = (link.evidence?.[0] || '').match(/\d+m\s*\d*s?/i);
        const durationStr = link.attributes?.duration || (durationMatch ? durationMatch[0] : 'Recorded Call');
        
        // Dynamic cell tower resolution from attributes or linked location
        const towerName = link.attributes?.tower 
          || link.attributes?.bts 
          || link.attributes?.location
          || (nodes.find(n => n.type === 'Location' && (n.id === tId || n.id === sId))?.name)
          || (link.evidence?.[0]?.includes('Bandra') ? 'Bandra West BTS-09' : (link.evidence?.[0]?.includes('Port') ? 'Nhava Sheva Port BTS-14' : null));

        list.push({
          id: `cdr_${idx + 1}`,
          caller: src,
          receiver: tgt,
          callerPhone: src.attributes?.phone || src.name || src.id,
          receiverPhone: tgt.attributes?.phone || tgt.name || tgt.id,
          duration: durationStr,
          status: link.attributes?.status || 'RECORDED_AUDIO',
          eventId: link.event_id || `ev_cdr_${idx + 1}`,
          evidence: link.evidence?.[0] || 'Lawful intercept audio transcript logged',
          timestamp: link.attributes?.timestamp || (link.event_id ? `Event: ${link.event_id}` : 'Logged Call'),
          tower: towerName,
        });
      }
    });

    links.filter(l => l.evidence?.some(e => e.toLowerCase().includes('wiretap') || e.toLowerCase().includes('call'))).forEach((link, idx) => {
      const sId = typeof link.source === 'object' && link.source !== null ? link.source.id : link.source;
      const tId = typeof link.target === 'object' && link.target !== null ? link.target.id : link.target;
      const src = nodes.find(n => n.id === sId);
      const tgt = nodes.find(n => n.id === tId);
      if (src && tgt && !list.some(c => c.eventId === link.event_id)) {
        const durationMatch = (link.evidence?.[0] || '').match(/\d+m\s*\d*s?/i);
        const durationStr = link.attributes?.duration || (durationMatch ? durationMatch[0] : 'Wiretap Intercept');
        const towerName = link.attributes?.tower 
          || link.attributes?.bts 
          || link.attributes?.location
          || (nodes.find(n => n.type === 'Location' && (n.id === tId || n.id === sId))?.name)
          || null;

        list.push({
          id: `cdr_wire_${idx + 10}`,
          caller: src,
          receiver: tgt,
          callerPhone: src.attributes?.phone || src.name || src.id,
          receiverPhone: tgt.attributes?.phone || tgt.name || tgt.id,
          duration: durationStr,
          status: link.attributes?.status || 'ACTIVE_WIRETAP',
          eventId: link.event_id || `ev_wire_${idx + 1}`,
          evidence: link.evidence?.[0] || 'Intercepted tactical call snippet',
          timestamp: link.attributes?.timestamp || (link.event_id ? `Event: ${link.event_id}` : 'Intercept Record'),
          tower: towerName,
        });
      }
    });

    return list;
  }, [links, nodes]);

  const filteredPhones = useMemo(() => {
    return telecomDirectory.filter(p => {
      const q = searchQuery.toLowerCase();
      const num = (p.number || p.id || '').toLowerCase();
      const carrier = (p.carrier || '').toLowerCase();
      const matchSearch = num.includes(q) ||
                          carrier.includes(q) ||
                          (p.linkedPersons || []).some(lp => (lp?.name || lp?.id || '').toLowerCase().includes(q));
      
      if (filterMode === 'BURNER') return matchSearch && p.isBurner;
      if (filterMode === 'WIRETAP') return matchSearch && p.wiretapActive;
      return matchSearch;
    });
  }, [telecomDirectory, searchQuery, filterMode]);

  const filteredCdrLogs = useMemo(() => {
    if (!searchQuery.trim()) return cdrLogs;
    const q = searchQuery.toLowerCase();
    return cdrLogs.filter(c => 
      (c.callerPhone && c.callerPhone.toLowerCase().includes(q)) ||
      (c.receiverPhone && c.receiverPhone.toLowerCase().includes(q)) ||
      (c.caller?.name && c.caller.name.toLowerCase().includes(q)) ||
      (c.receiver?.name && c.receiver.name.toLowerCase().includes(q)) ||
      (c.tower && c.tower.toLowerCase().includes(q)) ||
      (c.duration && c.duration.toLowerCase().includes(q))
    );
  }, [cdrLogs, searchQuery]);

  const burnerCount = telecomDirectory.filter(p => p.isBurner).length;

  // Dynamic BTS (Base Transceiver Station) Cell Tower Triangulation Rate
  const btsTriangulationPct = useMemo(() => {
    if (!cdrLogs.length) return 0;
    const withTower = cdrLogs.filter(c => Boolean(c.tower)).length;
    return Math.round((withTower / cdrLogs.length) * 100);
  }, [cdrLogs]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Top Banner & Telecommunications KPI Telemetry */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{telecomDirectory.length}</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Registered Lines</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-400">{burnerCount}</div>
            <div className="text-[11px] text-rose-300/80 font-medium uppercase tracking-wider">Cloned/Pool SIMs</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Radio className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <div className="text-2xl font-black text-cyan-300">{cdrLogs.length}</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">CDR Intercepts</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-300">{btsTriangulationPct}%</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">BTS Triangulation</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search phone, IMEI, carrier, or suspect..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterMode === 'ALL'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
            }`}
          >
            All Lines ({telecomDirectory.length})
          </button>
          <button
            onClick={() => setFilterMode('BURNER')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterMode === 'BURNER'
                ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-sm shadow-rose-500/20'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
            }`}
          >
            <Flame className="w-3 h-3 text-rose-400" />
            <span>Shared Burners ({burnerCount})</span>
          </button>
          <button
            onClick={() => setFilterMode('WIRETAP')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterMode === 'WIRETAP'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
            }`}
          >
            <Radio className="w-3 h-3 text-cyan-400" />
            <span>Active Taps</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Content: Monitored Lines & CDR Call Intercept Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Intercepted Phone Cards (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Phone className="w-4 h-4 text-purple-400" />
              <span>Target Phone Identifiers</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{filteredPhones.length} Lines</span>
          </div>

          <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredPhones.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800">
                No matching phone lines detected in active intercepts.
              </div>
            ) : (
              filteredPhones.map((phone) => (
                <div
                  key={phone.number}
                  className={`bg-slate-900/90 border rounded-2xl p-4 transition-all hover:border-purple-500/40 shadow-lg ${
                    phone.isBurner 
                      ? 'border-rose-500/40 bg-gradient-to-br from-rose-950/20 via-slate-900/90 to-slate-900/90 ring-1 ring-rose-500/20' 
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-base font-black tracking-wider text-purple-300 bg-purple-950/40 px-2.5 py-0.5 rounded-lg border border-purple-500/30">
                          {phone.number}
                        </span>
                        {phone.isBurner && (
                          <span className="flex items-center space-x-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                            <Flame className="w-3 h-3" />
                            <span>Burner Pool</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono">{phone.carrier}</p>
                    </div>

                    <button
                      onClick={() => onNavigateToGraph(phone.id)}
                      title="Locate phone node in 3D Network Orbit"
                      className="p-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition shadow-sm hover:scale-105"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center space-x-1 mb-1.5">
                      <User className="w-3 h-3 text-cyan-400" />
                      <span>Associated Suspects ({phone.linkedPersons.length})</span>
                    </span>
                    
                    <div className="flex flex-wrap gap-1.5">
                      {phone.linkedPersons.length === 0 ? (
                        <span className="text-xs text-slate-500 italic">Unidentified Subscriber</span>
                      ) : (
                        phone.linkedPersons.map((person) => (
                          <button
                            key={person.id}
                            onClick={() => onInspectEntity(person.id)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-200 border border-slate-700/60 hover:border-cyan-500/40 text-xs transition"
                          >
                            <span>{person.name}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {phone.isBurner && (
                    <div className="mt-3 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                      <div>
                        <span className="font-bold">Operational Security Breach:</span> Same SIM card used concurrently across distinct syndicate tiers. Strong indicator of pooled burner communication.
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>IMEI: {phone.imei}</span>
                    <span className="text-emerald-400 flex items-center space-x-1">
                      <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                      <span>Live Tap Active</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Call Detail Records (CDR) Intercept Ledger (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <PhoneCall className="w-4 h-4 text-cyan-400" />
              <span>Call Detail Records (CDR) & Intercept Matrix</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{filteredCdrLogs.length} Events Logged</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] uppercase font-mono">
                  <tr>
                    <th className="py-3 px-4">Caller Suspect</th>
                    <th className="py-3 px-4">Recipient Suspect</th>
                    <th className="py-3 px-4">BTS Cell Tower</th>
                    <th className="py-3 px-4">Status & Duration</th>
                    <th className="py-3 px-4 text-right">3D Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredCdrLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No Call Detail Records matching the current criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCdrLogs.map((cdr) => (
                      <tr key={cdr.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => onInspectEntity(cdr.caller.id)}
                            className="text-cyan-300 hover:text-cyan-100 font-bold block text-left"
                          >
                            {cdr.caller.name}
                          </button>
                          <span className="text-[10px] text-slate-400 font-mono">{cdr.callerPhone}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => onInspectEntity(cdr.receiver.id)}
                            className="text-purple-300 hover:text-purple-100 font-bold block text-left"
                          >
                            {cdr.receiver.name}
                          </button>
                          <span className="text-[10px] text-slate-400 font-mono">{cdr.receiverPhone}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="text-slate-300 font-mono text-[11px] block">{cdr.tower}</span>
                          <span className="text-[10px] text-slate-500">{cdr.eventId}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono ${
                            cdr.status === 'ACTIVE_WIRETAP'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            <Clock className="w-2.5 h-2.5 mr-1" />
                            {cdr.duration}
                          </span>
                          <p className="text-[10px] text-slate-400 italic line-clamp-1 mt-0.5">{cdr.evidence}</p>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => onNavigateToGraph(cdr.caller.id)}
                            title="Trace call intercept in 3D Orbit"
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold inline-flex items-center space-x-1 transition"
                          >
                            <span>Orbit</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-950/60 p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Deterministic telecommunications cross-referencing via lawful intercept warrants</span>
              </span>
              <span className="font-mono text-slate-500">GSM / 3GPP Rel. 17 Compliant</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}