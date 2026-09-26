import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  FileText,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Hash
} from 'lucide-react';
import { fetchEvidence, registerEvidence } from '../services/api';
import { can } from '../utils/permissions';

export default function EvidenceView({ activeCase, currentUser }) {
  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedHash, setCopiedHash] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFilename, setNewFilename] = useState('');
  const [newType, setNewType] = useState('CSV');
  const [newContent, setNewContent] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const loadEvidence = async () => {
    setLoading(true);
    try {
      const data = await fetchEvidence(activeCase?.case_id);
      setEvidenceList(data);
    } catch (err) {
      console.error('Failed to load evidence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, [activeCase?.case_id]);

  const handleCopyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!newFilename.trim() || !newContent.trim()) return;
    setLoading(true);
    try {
      await registerEvidence(activeCase?.case_id, {
        filename: newFilename.trim(),
        source_type: newType,
        content: newContent,
        description: newDesc,
      });
      setIsModalOpen(false);
      setNewFilename('');
      setNewContent('');
      setNewDesc('');
      await loadEvidence();
    } catch (err) {
      alert('Failed to register evidence: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = evidenceList.filter(
    (ev) =>
      ev.filename?.toLowerCase().includes(search.toLowerCase()) ||
      ev.evidence_id?.toLowerCase().includes(search.toLowerCase()) ||
      ev.sha256_hash?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span>Evidence Registry & Chain of Custody</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Cryptographic SHA-256 integrity verification, surveillance artifact indexing, and relationship lineage citations.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadEvidence}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          {can(currentUser, 'EVIDENCE_UPLOAD') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register Surveillance File</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
        <input
          type="text"
          placeholder="Filter by filename, evidence ID, or SHA-256 hash..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Evidence Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Evidence ID</th>
                <th className="py-3 px-4">Artifact Name</th>
                <th className="py-3 px-4">Source Type</th>
                <th className="py-3 px-4">Records</th>
                <th className="py-3 px-4">SHA-256 Checksum</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Ingested At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No evidence records matching query in this case.
                  </td>
                </tr>
              ) : (
                filtered.map((ev) => (
                  <tr key={ev.evidence_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-cyan-400">{ev.evidence_id}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-200">{ev.filename}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        {ev.source_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{ev.record_count}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {ev.sha256_hash ? `${ev.sha256_hash.slice(0, 16)}...` : 'N/A'}
                        </span>
                        {ev.sha256_hash && (
                          <button
                            onClick={() => handleCopyHash(ev.sha256_hash)}
                            className="text-slate-500 hover:text-cyan-400 cursor-pointer"
                            title="Copy full SHA-256 hash"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                        {copiedHash === ev.sha256_hash && (
                          <span className="text-[9px] text-emerald-400">Copied!</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{ev.processing_status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[10px]">{ev.uploaded_at}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedItem(ev)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Evidence Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-cyan-400">{selectedItem.evidence_id}</span>
                <h2 className="text-base font-bold text-slate-100">{selectedItem.filename}</h2>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Cryptographic SHA-256 Hash</div>
                <div className="text-cyan-300 break-all select-all">{selectedItem.sha256_hash}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px]">Source Type:</span>
                  <div className="text-slate-200 font-semibold">{selectedItem.source_type}</div>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px]">Total Records Ingested:</span>
                  <div className="text-slate-200 font-semibold">{selectedItem.record_count}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px]">Investigative Description:</span>
                <div className="text-slate-300 mt-1 font-sans">{selectedItem.description || 'No description provided.'}</div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Manual Evidence Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Register Surveillance Evidence Artifact</span>
            </h2>
            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Artifact / Filename</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. wiretap_intercept_mar12.txt"
                  value={newFilename}
                  onChange={(e) => setNewFilename(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Source Format</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="CSV">CSV</option>
                  <option value="JSON">JSON</option>
                  <option value="Log">Log File</option>
                  <option value="Report">Report Document</option>
                  <option value="Text">Raw Text</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Raw Artifact Content (Hashed via SHA-256)</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Paste raw surveillance content or ledger entries..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Custody Notes</label>
                <input
                  type="text"
                  placeholder="Subpoena reference, tower location, or seizing unit..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newFilename.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 cursor-pointer"
                >
                  Compute Hash & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
