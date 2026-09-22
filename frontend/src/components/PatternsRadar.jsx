import React, { useState } from 'react';
import { 
  AlertOctagon, 
  ShieldAlert, 
  Share2, 
  Users2, 
  Repeat, 
  ArrowRight,
  CheckCircle,
  FileSearch,
  Check,
  XCircle,
  Clock,
  Filter,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';
import { reviewPatternFinding } from '../services/api';

export default function PatternsRadar({ 
  patterns, 
  onSelectEntity,
  activeCase,
  onPatternsUpdated,
}) {
  const flags = patterns || [];
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewAction, setReviewAction] = useState('DISMISSED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDismissed, setShowDismissed] = useState(true);

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
          desc: 'Multiple entities using or linked to the identical phone number, vehicle plate, or communication identifier.',
        };
      case 'dense_subgroup':
        return {
          title: 'Dense Subgroup / Network Cluster',
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

  const handleOpenReview = (flag, action) => {
    setReviewingId(flag.finding_id || flag.pattern_type);
    setReviewAction(action);
    setReviewNotes(
      action === 'DISMISSED'
        ? 'Routine commercial activity / expected shared connection.'
        : 'Confirmed operational concern requiring prioritized surveillance.'
    );
  };

  const handleSubmitReview = async (flag) => {
    const caseId = flag.case_id || activeCase?.case_id || 'case-001';
    const findingId = flag.finding_id;
    if (!findingId) return;

    setSubmitting(true);
    try {
      await reviewPatternFinding(caseId, findingId, reviewAction, reviewNotes);
      setReviewingId(null);
      if (onPatternsUpdated) onPatternsUpdated();
    } catch (err) {
      alert('Failed to submit pattern review: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const visibleFlags = flags.filter((f) => {
    if (!showDismissed && f.review_status === 'DISMISSED') return false;
    return true;
  });

  const activeThreatsCount = flags.filter((f) => f.review_status !== 'DISMISSED').length;
  const dismissedCount = flags.filter((f) => f.review_status === 'DISMISSED').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <AlertOctagon className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-slate-100 text-base">Network Pattern & Structural Anomaly Radar</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated, deterministic graph algorithms identified {flags.length} structural signatures. Supports false-positive dismissal and investigator review.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            {showDismissed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showDismissed ? 'Hide Dismissed' : `Show Dismissed (${dismissedCount})`}</span>
          </button>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
            activeThreatsCount > 0 
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            {activeThreatsCount > 0 ? `${activeThreatsCount} Active Findings` : 'All Reviewed / Clear'}
          </span>
        </div>
      </div>

      {visibleFlags.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
          <h4 className="font-bold text-slate-200 text-sm">No Patterns Requiring Immediate Action</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            All detected structural patterns have been reviewed or dismissed, or no articulation points meet detection thresholds.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleFlags.map((flag, idx) => {
            const meta = getPatternMeta(flag.pattern_type);
            const Icon = meta.icon;
            const isDismissed = flag.review_status === 'DISMISSED';
            const isConfirmed = flag.review_status === 'CONFIRMED';
            const severityColor = flag.severity === 'high' ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30';
            const isEditing = reviewingId === (flag.finding_id || flag.pattern_type);

            return (
              <div 
                key={idx}
                className={`border rounded-2xl p-5 shadow-lg transition space-y-3.5 ${
                  isDismissed
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-70'
                    : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                
                {/* Title & Status Badges */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-cyan-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className={`font-bold text-sm sm:text-base ${isDismissed ? 'text-slate-400 line-through' : 'text-slate-100'}`}>
                          {meta.title}
                        </h4>
                        {flag.finding_id && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                            {flag.finding_id}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{meta.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                    {/* Review Status Badge */}
                    {isDismissed && (
                      <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full border bg-slate-800 text-slate-400 border-slate-700">
                        Dismissed (Expected)
                      </span>
                    )}
                    {isConfirmed && (
                      <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full border bg-emerald-950/40 text-emerald-300 border-emerald-500/40">
                        Confirmed Threat
                      </span>
                    )}
                    {!isDismissed && !isConfirmed && (
                      <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full border bg-amber-950/30 text-amber-300 border-amber-500/30">
                        New Finding
                      </span>
                    )}
                    <span className={`text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full border ${severityColor}`}>
                      {flag.severity} Priority
                    </span>
                  </div>
                </div>

                {/* Evidence Quote */}
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center">
                    <FileSearch className="w-3 h-3 mr-1 text-slate-400" /> Evidence & Mathematical Observation:
                  </span>
                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    {flag.evidence}
                  </p>
                </div>

                {/* Documented Review History if available */}
                {(flag.reviewed_by || flag.review_notes) && (
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/60 text-xs text-slate-300 space-y-0.5 font-sans">
                    <div className="flex items-center space-x-1 text-[11px] text-cyan-400 font-medium">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Reviewed by {flag.reviewed_by} • {flag.reviewed_at}</span>
                    </div>
                    {flag.review_notes && (
                      <div className="text-slate-400 italic text-[11px]">
                        "{flag.review_notes}"
                      </div>
                    )}
                  </div>
                )}

                {/* Entities Involved & Review Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Entities Involved:</span>
                    {flag.entities_involved?.map((id) => (
                      <button
                        key={id}
                        onClick={() => onSelectEntity(id)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                      >
                        <span>{id}</span>
                        <ArrowRight className="w-3 h-3 text-cyan-400" />
                      </button>
                    ))}
                  </div>

                  {/* False-Positive Handling Buttons */}
                  {flag.finding_id && (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {!isConfirmed && (
                        <button
                          onClick={() => handleOpenReview(flag, 'CONFIRMED')}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Confirm</span>
                        </button>
                      )}
                      {!isDismissed && (
                        <button
                          onClick={() => handleOpenReview(flag, 'DISMISSED')}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium cursor-pointer"
                        >
                          <XCircle className="w-3 h-3 text-slate-400" />
                          <span>Dismiss False-Positive</span>
                        </button>
                      )}
                      {isDismissed && (
                        <button
                          onClick={() => handleOpenReview(flag, 'NEW')}
                          className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                        >
                          Reopen Finding
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline Review Justification Drawer */}
                {isEditing && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2 animate-in fade-in">
                    <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>Document Finding Review ({reviewAction}):</span>
                      <button
                        onClick={() => setReviewingId(null)}
                        className="text-slate-500 hover:text-slate-300 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Enter investigative rationale (e.g. routine commercial transaction, verified family member)..."
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setReviewingId(null)}
                        className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={submitting}
                        onClick={() => handleSubmitReview(flag)}
                        className="px-3 py-1 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 cursor-pointer"
                      >
                        {submitting ? 'Saving...' : 'Save Decision'}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
