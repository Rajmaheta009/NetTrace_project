import React, { useState, useEffect } from 'react';
import {
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  Hash,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { fetchAuditTrail, verifyAuditIntegrity } from '../services/api';

export default function AuditView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [integrityResult, setIntegrityResult] = useState(null);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditTrail(200);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      const res = await verifyAuditIntegrity();
      setIntegrityResult(res);
    } catch (err) {
      setIntegrityResult({
        valid: false,
        total_records: logs.length,
        verified_records: 0,
        message: 'Integrity verification request failed: ' + err.message,
      });
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.user_id?.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase()) ||
      l.case_id?.toLowerCase().includes(search.toLowerCase()) ||
      l.current_hash?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <History className="w-6 h-6 text-cyan-400" />
            <span>Tamper-Evident Security Audit Trail</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Cryptographic SHA-256 hash-chained ledger tracking all operational actions, RBAC changes, data ingestion, and forensic merges.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleVerifyIntegrity}
            disabled={verifying}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 text-xs font-semibold cursor-pointer transition-all shadow-sm"
          >
            <ShieldCheck className={`w-4 h-4 ${verifying ? 'animate-pulse text-cyan-400' : ''}`} />
            <span>{verifying ? 'Verifying Hashes...' : 'Verify Cryptographic Integrity'}</span>
          </button>
          <button
            onClick={loadAudit}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 cursor-pointer transition-all"
            title="Refresh Audit Trail"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cryptographic Integrity Verification Banner */}
      {integrityResult && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 transition-all animate-in fade-in ${
            integrityResult.valid
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
          }`}
        >
          {integrityResult.valid ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="text-xs space-y-1">
            <div className="font-bold text-sm">
              {integrityResult.valid
                ? 'SHA-256 Cryptographic Hash Chain: VERIFIED AUTHENTIC'
                : 'INTEGRITY ALERT: Tamper Detection Triggered'}
            </div>
            <div className="opacity-90 leading-relaxed font-sans">{integrityResult.message}</div>
            <div className="font-mono text-[11px] opacity-75">
              Verified Records: {integrityResult.verified_records} / {integrityResult.total_records}
              {integrityResult.broken_at && ` • Broken at log sequence: ${integrityResult.broken_at}`}
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
        <input
          type="text"
          placeholder="Filter audit trail by officer, action, case ID, or SHA-256 hash..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 shadow-inner"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Officer / Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Case</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4">Cryptographic Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No matching audit entries found.
                  </td>
                </tr>
              ) : (
                filtered.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-3 px-4 font-bold text-cyan-400 whitespace-nowrap">
                      {log.user_id}
                      {log.user_role && (
                        <span className="block text-[10px] text-slate-500 font-normal">
                          Role: {log.user_role}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-amber-300 whitespace-nowrap">{log.action}</td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {log.case_id ? (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px] border border-slate-700">
                          {log.case_id}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans text-xs max-w-xs sm:max-w-sm truncate">
                      {log.details}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {log.current_hash ? (
                        <div
                          className="flex items-center space-x-1 font-mono text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800"
                          title={`Current Hash: ${log.current_hash}\nPrevious Hash: ${log.previous_hash || 'GENESIS'}`}
                        >
                          <Hash className="w-3 h-3 text-cyan-500 shrink-0" />
                          <span className="text-cyan-300">{log.current_hash.slice(0, 10)}...</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600">Legacy record</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
