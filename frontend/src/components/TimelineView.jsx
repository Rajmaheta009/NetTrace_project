import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  Calendar, 
  FileText, 
  ArrowUpRight, 
  ShieldAlert, 
  Radio, 
  CheckCircle2,
  Filter,
  Search,
  ExternalLink,
  User,
  Link as LinkIcon,
  Tag
} from 'lucide-react';
import { RELATION_LABELS } from '../utils/colors';

export default function TimelineView({ 
  graphData, 
  onNavigateToGraph,
  onInspectEntity = null,
  onInspectEvidence = null
}) {
  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];

  // Filter state
  const [searchEntity, setSearchEntity] = useState('');
  const [selectedRelType, setSelectedRelType] = useState('ALL');
  const [selectedEvidenceFilter, setSelectedEvidenceFilter] = useState('ALL');

  // Build events
  const allEvents = useMemo(() => {
    const list = [];

    links.forEach((link, idx) => {
      const sId = typeof link.source === 'object' && link.source !== null ? link.source.id : link.source;
      const tId = typeof link.target === 'object' && link.target !== null ? link.target.id : link.target;
      const srcNode = nodes.find(n => n.id === sId);
      const tgtNode = nodes.find(n => n.id === tId);

      const ts = link.attributes?.timestamp || link.attributes?.date || link.attributes?.time || `Event-${idx + 1}`;
      const relType = link.relation_type || 'CONNECTED';
      const evId = link.evidence_id || (link.evidence && link.evidence[0]) || null;

      list.push({
        id: link.id || `evt-${idx}`,
        eventId: link.event_id || `EVT-${idx + 1}`,
        timestamp: String(ts),
        source: srcNode || { id: sId, name: sId, type: 'Entity' },
        target: tgtNode || { id: tId, name: tId, type: 'Entity' },
        relation_type: relType,
        confidence: link.confidence !== undefined ? link.confidence : 0.5,
        confidence_label: link.confidence_label || 'Moderate',
        evidence_id: evId,
        evidenceList: link.evidence || [],
        attributes: link.attributes || {},
      });
    });

    return list;
  }, [nodes, links]);

  // Unique relation types for filter
  const relationTypes = useMemo(() => {
    const s = new Set(allEvents.map(e => e.relation_type));
    return ['ALL', ...Array.from(s)];
  }, [allEvents]);

  // Unique evidence references for filter
  const evidenceReferences = useMemo(() => {
    const s = new Set();
    allEvents.forEach(e => {
      if (e.evidence_id) s.add(e.evidence_id);
    });
    return ['ALL', ...Array.from(s)];
  }, [allEvents]);

  // Filtered list
  const filteredEvents = useMemo(() => {
    return allEvents.filter(e => {
      if (selectedRelType !== 'ALL' && e.relation_type !== selectedRelType) return false;
      if (selectedEvidenceFilter !== 'ALL' && e.evidence_id !== selectedEvidenceFilter) return false;
      if (searchEntity.trim()) {
        const q = searchEntity.toLowerCase();
        const srcName = (e.source?.name || e.source?.id || '').toLowerCase();
        const tgtName = (e.target?.name || e.target?.id || '').toLowerCase();
        if (!srcName.includes(q) && !tgtName.includes(q)) return false;
      }
      return true;
    });
  }, [allEvents, selectedRelType, selectedEvidenceFilter, searchEntity]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-white text-base">Incident & Surveillance Chronology</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological ledger of wiretap intercepts, meetings, and movements recorded across case files.
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold text-teal-300 bg-teal-500/15 px-3 py-1 rounded-full border border-teal-500/30 shrink-0">
          {filteredEvents.length} Events Displayed
        </span>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-950/90 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center gap-3 text-xs font-mono">
        <div className="flex items-center space-x-1.5 text-slate-400">
          <Filter className="w-3.5 h-3.5 text-teal-400" />
          <span className="font-bold uppercase text-[10px]">Filters:</span>
        </div>

        {/* Entity Search Filter */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by entity name..."
            value={searchEntity}
            onChange={(e) => setSearchEntity(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
          />
        </div>

        {/* Relationship Type Filter */}
        <div className="flex items-center space-x-1">
          <span className="text-slate-500 text-[10px]">Type:</span>
          <select
            value={selectedRelType}
            onChange={(e) => setSelectedRelType(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-slate-300 text-xs focus:outline-none focus:border-teal-500/50"
          >
            {relationTypes.map(rt => (
              <option key={rt} value={rt}>{rt}</option>
            ))}
          </select>
        </div>

        {/* Evidence Filter */}
        {evidenceReferences.length > 1 && (
          <div className="flex items-center space-x-1">
            <span className="text-slate-500 text-[10px]">Evidence:</span>
            <select
              value={selectedEvidenceFilter}
              onChange={(e) => setSelectedEvidenceFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-slate-300 text-xs focus:outline-none focus:border-teal-500/50"
            >
              {evidenceReferences.map(ev => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>
          </div>
        )}

        {(selectedRelType !== 'ALL' || selectedEvidenceFilter !== 'ALL' || searchEntity) && (
          <button
            onClick={() => {
              setSelectedRelType('ALL');
              setSelectedEvidenceFilter('ALL');
              setSearchEntity('');
            }}
            className="text-[10px] text-rose-400 hover:underline cursor-pointer"
          >
            Reset Filters ✕
          </button>
        )}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="font-bold text-slate-300 text-sm">No Events Match Filter Criteria</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Adjust the entity or relation type filters above to inspect chronological surveillance entries.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 border-l-2 border-slate-800 space-y-5">
          {filteredEvents.map((evt, idx) => (
            <div key={evt.id || idx} className="relative group">
              
              {/* Bullet */}
              <div className="absolute -left-[31px] top-3 w-4 h-4 rounded-full bg-slate-950 border-2 border-teal-400 group-hover:bg-teal-400 transition" />

              <div className="bg-slate-900/80 border border-slate-800 group-hover:border-teal-500/40 rounded-2xl p-4 shadow-xl space-y-3 transition">
                
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 font-mono text-xs">
                    <span className="px-2 py-0.5 rounded-md font-bold uppercase bg-teal-500/15 text-teal-300 border border-teal-500/30 text-[10px]">
                      {evt.eventId}
                    </span>
                    <span className="text-slate-400 font-bold">{evt.timestamp}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-300">
                      {((evt.confidence || 0.5)*100).toFixed(0)}% Conf
                    </span>
                    {evt.evidence_id && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                        {evt.evidence_id}
                      </span>
                    )}
                  </div>
                </div>

                {/* Event Relationship Narrative */}
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                  <span className="text-cyan-300">{evt.source.name}</span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-teal-400">
                    → {evt.relation_type} →
                  </span>
                  <span className="text-cyan-300">{evt.target.name}</span>
                </div>

                {/* Event Evidence Quote */}
                {evt.evidenceList && evt.evidenceList.length > 0 && (
                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-300 italic">
                    "{evt.evidenceList[0]}"
                  </div>
                )}

                {/* Interactive Inspection Triggers: [ VIEW ENTITY ], [ VIEW RELATIONSHIP ], [ VIEW EVIDENCE ] */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => onInspectEntity && onInspectEntity(evt.source.id)}
                      className="inline-flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 transition hover:underline cursor-pointer"
                    >
                      <User className="w-3 h-3" />
                      <span>View {evt.source.name}</span>
                    </button>

                    <span className="text-slate-600">•</span>

                    <button
                      type="button"
                      onClick={() => onInspectEntity && onInspectEntity(evt.target.id)}
                      className="inline-flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 transition hover:underline cursor-pointer"
                    >
                      <User className="w-3 h-3" />
                      <span>View {evt.target.name}</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    {onNavigateToGraph && (
                      <button
                        type="button"
                        onClick={() => onNavigateToGraph()}
                        className="inline-flex items-center space-x-1 text-teal-400 hover:text-teal-300 transition hover:underline cursor-pointer"
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>View in 3D Orbit ↗</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
