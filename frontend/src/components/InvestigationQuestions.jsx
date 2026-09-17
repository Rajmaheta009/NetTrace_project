import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronRight, 
  Search, 
  Sparkles, 
  Layers, 
  CheckCircle2,
  ExternalLink,
  Target
} from 'lucide-react';

export default function InvestigationQuestions({
  questions = [],
  profileName = 'Organized Crime Network',
  onExploreQuestion = null,
}) {
  const [expandedIndex, setExpandedIndex] = useState(0);

  if (!questions || questions.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-4 text-center text-xs text-slate-500 font-mono">
        No crime-specific questions loaded for the active profile.
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4.5 shadow-xl space-y-3 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white font-mono uppercase tracking-wider">
              Investigation Questions
            </h4>
            <p className="text-[11px] text-slate-400">
              Hypothesis guidance for <span className="text-cyan-300 font-semibold">{profileName}</span>
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          {questions.length} Analytical Prompts
        </span>
      </div>

      {/* Questions Accordion / List */}
      <div className="space-y-2">
        {questions.map((q, idx) => {
          const isExpanded = expandedIndex === idx;
          return (
            <div
              key={q.index || idx}
              className={`rounded-2xl border transition-all ${
                isExpanded
                  ? 'bg-slate-950/90 border-cyan-500/50 shadow-md shadow-cyan-950/30'
                  : 'bg-slate-950/50 hover:bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                className="w-full text-left p-3 flex items-start justify-between space-x-2 cursor-pointer"
              >
                <div className="flex items-start space-x-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono font-black text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                    Q{q.index || idx + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-200 leading-snug">
                    {q.question}
                  </span>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform shrink-0 mt-0.5 ${isExpanded ? 'rotate-90 text-cyan-400' : ''}`} />
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-800/80 space-y-2 text-[11px] font-sans">
                  {/* Relevant vectors */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400">Target Vectors:</span>
                    {q.relevant_entity_types && q.relevant_entity_types.map((et, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-cyan-300"
                      >
                        {et}
                      </span>
                    ))}
                  </div>

                  {q.relevant_relationship_types && q.relevant_relationship_types.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400">Key Links:</span>
                      {q.relevant_relationship_types.map((rt, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.2 rounded bg-indigo-500/15 border border-indigo-500/30 text-[9px] font-mono text-indigo-300"
                        >
                          {rt}
                        </span>
                      ))}
                    </div>
                  )}

                  {onExploreQuestion && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onExploreQuestion(q)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold transition cursor-pointer"
                      >
                        <span>Examine In Graph</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-slate-500 font-mono pt-1 text-right">
        Neutral analytical guidance • Hypothesis evaluation
      </div>
    </div>
  );
}
