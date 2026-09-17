import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Layers
} from 'lucide-react';
import { fetchCaseReport } from '../services/api';

export default function ReportsView({ activeCase }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await fetchCaseReport(activeCase?.case_id);
      setReport(data);
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [activeCase?.case_id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCase?.case_id || 'case'}_forensic_dossier.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 print:bg-white print:text-black">
      {/* Print / Export Action Bar (hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-400" />
            <span>Comprehensive Investigation Dossier</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Official law-enforcement export including verified evidence ledger, deterministic graph findings, and audit verification.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadReport}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 cursor-pointer"
            title="Regenerate Report"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={handleDownloadJson}
            disabled={!report}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={!report}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF Dossier</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-12 text-center text-slate-400 font-mono text-xs animate-pulse">
          Assembling forensic dossier and calculating graph metrics...
        </div>
      )}

      {report && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 print:border-none print:shadow-none print:p-0">
          
          {/* Dossier Header */}
          <div className="border-b border-slate-800 pb-6 print:border-black">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
                  CONFIDENTIAL FORENSIC INTELLIGENCE REPORT
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight mt-1 print:text-black">
                  {report.case_info.case_name}
                </h1>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl print:text-slate-700">
                  {report.case_info.description}
                </p>
              </div>
              <div className="text-right font-mono text-[11px] text-slate-400 print:text-slate-700">
                <div>Case ID: <span className="text-cyan-400 font-bold">{report.case_info.case_id}</span></div>
                <div>Status: <span className="text-emerald-400 font-semibold">{report.case_info.status}</span></div>
                <div>Generated: {report.generated_at}</div>
                <div>Officer: {report.generated_by}</div>
              </div>
            </div>
          </div>

          {/* Core Summary: Observed Facts vs Graph Findings vs AI Interpretation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl print:border-black">
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono mb-2">
                1. Observed Facts
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4 print:text-black">
                {report.summary.observed_facts.map((fact, idx) => (
                  <li key={idx}>{fact}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl print:border-black">
              <div className="text-xs font-bold text-blue-400 uppercase tracking-wider font-mono mb-2">
                2. Graph Findings (Deterministic)
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4 print:text-black">
                {report.summary.graph_findings.map((finding, idx) => (
                  <li key={idx}>{finding}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl print:border-black">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono mb-2">
                3. AI Analytical Summary
              </div>
              <p className="text-xs text-slate-300 leading-relaxed print:text-black">
                {report.summary.summary}
              </p>
            </div>
          </div>

          {/* Evidence Chain of Custody Table */}
          <div>
            <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2 print:text-black">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <span>Evidence Ledger & SHA-256 Integrity Hashes</span>
            </h3>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Artifact Name</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Records</th>
                    <th className="p-2.5">SHA-256 Checksum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {report.evidence_list.map((ev) => (
                    <tr key={ev.evidence_id} className="text-slate-300">
                      <td className="p-2.5 font-bold text-cyan-400">{ev.evidence_id}</td>
                      <td className="p-2.5 font-sans">{ev.filename}</td>
                      <td className="p-2.5">{ev.source_type}</td>
                      <td className="p-2.5">{ev.record_count}</td>
                      <td className="p-2.5 text-[10px] text-slate-400 select-all break-all">{ev.sha256_hash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Suspects & Centrality Table */}
          <div>
            <h3 className="text-sm font-bold text-slate-200 mb-3 print:text-black">
              Key Centrality Influencers (NetworkX Ranking)
            </h3>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Rank</th>
                    <th className="p-2.5">Entity Name</th>
                    <th className="p-2.5">Betweenness Brokerage</th>
                    <th className="p-2.5">Degree Centrality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {report.top_entities.slice(0, 5).map((ent, idx) => (
                    <tr key={ent.id} className="text-slate-300">
                      <td className="p-2.5 font-bold text-cyan-400">#{idx + 1}</td>
                      <td className="p-2.5 font-sans font-semibold">{ent.name}</td>
                      <td className="p-2.5">{ent.betweenness.toFixed(3)}</td>
                      <td className="p-2.5">{ent.degree.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detected Behavioral Patterns */}
          <div>
            <h3 className="text-sm font-bold text-slate-200 mb-3 print:text-black">
              Flagged Behavioral Patterns ({report.detected_patterns.length})
            </h3>
            <div className="space-y-2">
              {report.detected_patterns.map((p, idx) => (
                <div key={idx} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 uppercase font-mono text-[10px]">{p.pattern_type}</span>
                    <span className="text-red-400 font-bold uppercase text-[9px]">{p.severity} SEVERITY</span>
                  </div>
                  <div className="text-slate-200">{p.evidence}</div>
                  {p.why && <div className="text-slate-400 text-[11px] italic">Rationale: {p.why}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Forensic Stamp */}
          <div className="pt-6 border-t border-slate-800 text-[11px] text-slate-500 font-mono flex items-center justify-between print:text-slate-600 print:border-black">
            <span>NetTrace Law-Enforcement Certified Dossier</span>
            <span>Immutable Hash: {report.case_info.case_id}-CERT-2026</span>
          </div>

        </div>
      )}
    </div>
  );
}
