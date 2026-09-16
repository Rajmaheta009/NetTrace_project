import React from 'react';
import { 
  AlertOctagon, 
  ShieldAlert, 
  Share2, 
  Users2, 
  Repeat, 
  ArrowRight,
  CheckCircle,
  FileSearch
} from 'lucide-react';

export default function PatternsRadar({ 
  patterns, 
  onSelectEntity 
}) {
  const flags = patterns || [];

  const getPatternMeta = (type) => {
    switch (type) {
      case 'broker':
        return {
          title: 'Broker / Articulation Bridge',
          icon: Share2,
          color: 'rose',
          desc: 'An individual serving as the single critical bridge between otherwise isolated groups. Removing this person fractures the network.',
        };
      case 'shared_attribute':
        return {
          title: 'Shared Attribute / Identity Conflation',
          icon: ShieldAlert,
          color: 'amber',
          desc: 'Multiple suspects using or linked to the identical phone number, vehicle plate, or burner account.',
        };
      case 'dense_subgroup':
        return {
          title: 'Dense Subgroup / Conspiratorial Cell',
          icon: Users2,
          color: 'purple',
          desc: 'A tightly-knit clique where members frequently coordinate directly with each other, indicating an organized cell.',
        };
      case 'repeated_cooccurrence':
        return {
          title: 'Repeated Co-occurrence',
          icon: Repeat,
          color: 'cyan',
          desc: 'Entities repeatedly witnessed together across separate independent events or dates, reducing coincidental probability.',
        };
      default:
        return {
          title: type,
          icon: AlertOctagon,
          color: 'slate',
          desc: 'Deterministic pattern detected by graph analytics.',
        };
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <AlertOctagon className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-slate-100 text-base">Suspicious Pattern Radar</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated, deterministic graph algorithms flagged {flags.length} high-confidence suspicious structural patterns.
          </p>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
          flags.length > 0 
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' 
            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        }`}>
          {flags.length > 0 ? `${flags.length} Threats Active` : 'No Threats Detected'}
        </span>
      </div>

      {flags.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
          <h4 className="font-bold text-slate-200 text-sm">No Suspicious Patterns Detected</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            The current network contains no articulation points or dense cliques meeting detection thresholds. Ingest more case reports to discover structural patterns.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {flags.map((flag, idx) => {
            const meta = getPatternMeta(flag.pattern_type);
            const Icon = meta.icon;
            const severityColor = flag.severity === 'high' ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

            return (
              <div 
                key={idx}
                className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition space-y-3"
              >
                
                {/* Title & Severity Badge */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-cyan-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-100 text-sm sm:text-base">{meta.title}</h4>
                      <p className="text-xs text-slate-400">{meta.desc}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full border ${severityColor}`}>
                    {flag.severity} Risk
                  </span>
                </div>

                {/* Evidence Quote */}
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center mb-1">
                    <FileSearch className="w-3 h-3 mr-1 text-slate-400" /> Evidence & Mathematical Justification:
                  </span>
                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    {flag.evidence}
                  </p>
                </div>

                {/* Entities Involved */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400 font-medium">Entities Involved:</span>
                  {flag.entities_involved?.map((id) => (
                    <button
                      key={id}
                      onClick={() => onSelectEntity(id)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono text-xs font-semibold flex items-center space-x-1 transition"
                    >
                      <span>{id}</span>
                      <ArrowRight className="w-3 h-3 text-cyan-400" />
                    </button>
                  ))}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
