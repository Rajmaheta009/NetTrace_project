import React from 'react';
import { 
  Clock, 
  Calendar, 
  FileText, 
  ArrowUpRight, 
  ShieldAlert, 
  Radio, 
  CheckCircle2
} from 'lucide-react';
import { RELATION_LABELS } from '../utils/colors';

export default function TimelineView({ 
  graphData, 
  onNavigateToGraph 
}) {
  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];

  // Group relationships by event_id or fallback
  const events = React.useMemo(() => {
    const eventMap = {};

    links.forEach(link => {
      const eid = link.event_id || 'UNSPECIFIED_EVENT';
      if (!eventMap[eid]) {
        eventMap[eid] = {
          eventId: eid,
          connections: [],
          evidenceList: [],
        };
      }

      const sId = typeof link.source === 'object' && link.source !== null ? link.source.id : link.source;
      const tId = typeof link.target === 'object' && link.target !== null ? link.target.id : link.target;
      const srcNode = nodes.find(n => n.id === sId);
      const tgtNode = nodes.find(n => n.id === tId);

      eventMap[eid].connections.push({
        source: srcNode || { id: sId, name: sId },
        target: tgtNode || { id: tId, name: tId },
        relation_type: link.relation_type,
      });

      if (link.evidence && link.evidence.length) {
        eventMap[eid].evidenceList.push(...link.evidence);
      }
    });

    return Object.values(eventMap);
  }, [nodes, links]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">Incident & Wiretap Chronology</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Sequence of meetings, wiretap intercepts, and contraband drops recorded across case files.
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/15 px-3 py-1 rounded-full border border-cyan-500/30">
          {events.length} Intercept Events
        </span>
      </div>

      {events.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="font-bold text-slate-300 text-sm">No Timeline Events Recorded</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Case files have not tagged discrete event IDs. Ingest Operation Black Lotus to view chronological intercepts.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 border-l-2 border-slate-800 space-y-6">
          {events.map((evt, idx) => (
            <div key={idx} className="relative group">
              
              {/* Timeline Bullet */}
              <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-slate-950 border-2 border-cyan-400 group-hover:bg-cyan-400 transition" />

              <div className="bg-slate-900/80 border border-slate-800 group-hover:border-cyan-500/40 rounded-2xl p-5 shadow-xl space-y-3 transition">
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {evt.eventId}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Logged Intercept Event</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Sequence #{idx + 1}</span>
                </div>

                {/* Interactions in this Event */}
                <div className="space-y-2">
                  {evt.connections.map((conn, cIdx) => (
                    <div key={cIdx} className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        onClick={() => onNavigateToGraph(conn.source.id)}
                        className="font-bold text-slate-200 hover:text-cyan-300 transition"
                      >
                        {conn.source.name}
                      </button>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        {conn.relation_type}
                      </span>
                      <button
                        onClick={() => onNavigateToGraph(conn.target.id)}
                        className="font-bold text-slate-200 hover:text-cyan-300 transition"
                      >
                        {conn.target.name}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Evidence Quotes */}
                {evt.evidenceList.length > 0 && (
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 italic font-mono leading-relaxed">
                    "{evt.evidenceList[0]}"
                  </div>
                )}

              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
