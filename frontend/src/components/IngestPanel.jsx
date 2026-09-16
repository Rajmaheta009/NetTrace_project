import React, { useState } from 'react';
import { 
  UploadCloud, 
  FileCode, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ArrowRight, 
  Sparkles,
  Play,
  RotateCcw
} from 'lucide-react';
import { importText, importFile } from '../services/api';

export default function IngestPanel({ onIngestSuccess }) {
  const [activeMode, setActiveMode] = useState('text'); // 'text' | 'file' | 'presets'
  const [textContent, setTextContent] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Quick Demo Presets
  const demoPresets = [
    {
      title: '🚨 00. Operation Black Lotus (Full Syndicate Case)',
      type: 'json',
      label: 'operation_black_lotus',
      snippet: JSON.stringify({
        "entities": [
          {"id": "p1", "type": "Person", "name": "Vikram 'Ghost' Singhania", "attributes": {"role": "Kingpin & Broker", "phone": "+91-9876543210"}},
          {"id": "p2", "type": "Person", "name": "Rajesh Shrestha", "attributes": {"role": "Hawala Operator", "phone": "+971-50-1122334"}},
          {"id": "p3", "type": "Person", "name": "Anita Rao", "attributes": {"role": "Shell Comptroller", "phone": "+91-9123456789"}},
          {"id": "p4", "type": "Person", "name": "Sanjay Patel", "attributes": {"role": "Narcotics Lead", "phone": "+91-9876543210"}},
          {"id": "p5", "type": "Person", "name": "Imran 'Chhota' Khan", "attributes": {"role": "Enforcer", "phone": "+91-9876500111"}},
          {"id": "p6", "type": "Person", "name": "Tariq Mansoor", "attributes": {"role": "Safehouse Custodian", "phone": "+91-9876500222"}},
          {"id": "org1", "type": "Organization", "name": "Al-Zahra Global Trading LLC", "attributes": {"category": "Hawala Front"}},
          {"id": "org2", "type": "Organization", "name": "Coastal Shipping & Logistics", "attributes": {"category": "Maritime Smuggling"}},
          {"id": "v1", "type": "Vehicle", "name": "MH-01-CZ-9999", "attributes": {"model": "Black Fortuner"}},
          {"id": "v2", "type": "Vehicle", "name": "MH-04-AB-1234", "attributes": {"model": "Grey Scorpio"}},
          {"id": "loc1", "type": "Location", "name": "Dock 14, Nhava Sheva Port", "attributes": {"type": "Container Terminal"}},
          {"id": "loc2", "type": "Location", "name": "Penthouse 7B, Bandra West", "attributes": {"type": "Safehouse"}},
          {"id": "loc3", "type": "Location", "name": "Cafe Coastal Marine Drive", "attributes": {"type": "Meeting Cabin"}}
        ],
        "relationships": [
          {"source": "p1", "target": "p2", "relation_type": "KNOWS", "event_id": "ev_wire_01"},
          {"source": "p2", "target": "org1", "relation_type": "MEMBER_OF", "event_id": "ev_corp_01"},
          {"source": "p3", "target": "org1", "relation_type": "MEMBER_OF", "event_id": "ev_corp_02"},
          {"source": "p2", "target": "p3", "relation_type": "KNOWS", "event_id": "ev_audit"},
          {"source": "p1", "target": "p4", "relation_type": "KNOWS", "event_id": "ev_drop_01"},
          {"source": "p1", "target": "loc2", "relation_type": "LOCATED_AT", "event_id": "ev_raid_prep"},
          {"source": "p2", "target": "loc2", "relation_type": "LOCATED_AT", "event_id": "ev_raid_prep"},
          {"source": "p4", "target": "p5", "relation_type": "KNOWS", "event_id": "ev_enforce_01"},
          {"source": "p4", "target": "p6", "relation_type": "KNOWS", "event_id": "ev_safehouse_drop"},
          {"source": "p5", "target": "p6", "relation_type": "KNOWS", "event_id": "ev_guard_duty"},
          {"source": "p4", "target": "v1", "relation_type": "OWNS_VEHICLE", "event_id": "ev_traffic_stop"},
          {"source": "p5", "target": "v1", "relation_type": "OWNS_VEHICLE", "event_id": "ev_cctv_dock"},
          {"source": "p5", "target": "v2", "relation_type": "OWNS_VEHICLE", "event_id": "ev_reg"},
          {"source": "p4", "target": "loc1", "relation_type": "MET_AT", "event_id": "ev_cargo_drop"},
          {"source": "p1", "target": "loc1", "relation_type": "MET_AT", "event_id": "ev_cargo_drop"},
          {"source": "org2", "target": "loc1", "relation_type": "LOCATED_AT", "event_id": "ev_lease"},
          {"source": "p1", "target": "loc3", "relation_type": "MET_AT", "event_id": "ev_cafe"},
          {"source": "p4", "target": "loc3", "relation_type": "MET_AT", "event_id": "ev_cafe"}
        ]
      }, null, 2)
    },
    {
      title: '01. Structured Entities CSV',
      type: 'csv',
      label: 'sample_entities',
      snippet: `id,type,name,phone
e1,Person,Rakesh Verma,+91-9876543210
e2,Person,Sanjay Patel,+91-9876500000
e3,Vehicle,MH-04-AB-1234,
e4,Location,Cafe Coastal Mumbai,`
    },
    {
      title: '02. Structured Relationships CSV',
      type: 'csv',
      label: 'sample_relationships',
      snippet: `source,target,relation_type,event_id
e1,e2,MET_AT,ev1
e1,e3,OWNS_VEHICLE,
e1,e4,LOCATED_AT,ev1`
    },
    {
      title: '03. Combined Intelligence JSON',
      type: 'json',
      label: 'case_03_json',
      snippet: `{
  "entities": [
    {"id": "p1", "type": "Person", "name": "Vikram Malhotra"},
    {"id": "p2", "type": "Person", "name": "Anita Roy"},
    {"id": "v1", "type": "Vehicle", "name": "DL-01-XY-9999"}
  ],
  "relationships": [
    {"source": "p1", "target": "p2", "relation_type": "KNOWS"},
    {"source": "p1", "target": "v1", "relation_type": "OWNS_VEHICLE"}
  ]
}`
    },
    {
      title: '04. Unstructured Narrative Report (AI Extraction)',
      type: 'text',
      label: 'field_report_04',
      snippet: `On 12 March, Rakesh Verma met Sanjay Patel at Cafe Coastal, Mumbai. 
Rakesh called +91-9876543210 minutes later. 
A black car with plate MH-04-AB-1234 was seen parked outside for the duration of the meeting.`
    }
  ];


  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!textContent.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await importText(textContent, null, sourceLabel || 'direct_paste');
      setResult(res);
      onIngestSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await importFile(file, sourceLabel || file.name);
      setResult(res);
      onIngestSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPreset = async (preset) => {
    setTextContent(preset.snippet);
    setSourceLabel(preset.label);
    setActiveMode('text');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Mode Switcher */}
      <div className="flex space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveMode('text')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeMode === 'text'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Paste Text / Raw Report</span>
        </button>
        <button
          onClick={() => setActiveMode('file')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeMode === 'file'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload File (.csv, .json, .txt)</span>
        </button>
        <button
          onClick={() => setActiveMode('presets')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeMode === 'presets'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Demo Case Datasets</span>
        </button>
      </div>

      {/* Mode 1: Paste Text */}
      {activeMode === 'text' && (
        <form onSubmit={handleTextSubmit} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Source Tag / Case Label (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Case_2026_09, Wiretap_Log_01"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-300">
                Investigation Content (CSV, JSON, or Plain Narrative Text)
              </label>
              <span className="text-[10px] text-cyan-400 font-mono">Auto-Triage Classifier Active</span>
            </div>
            <textarea
              rows={8}
              placeholder="Paste raw CSV rows (id,type,name...), structured JSON (entities, relationships), or an unstructured field agent surveillance report..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="w-full bg-slate-950 text-xs text-slate-200 p-3 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 font-mono leading-relaxed"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !textContent.trim()}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'Classifying & Ingesting...' : 'Classify & Import Evidence'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Mode 2: Upload File */}
      {activeMode === 'file' && (
        <form onSubmit={handleFileSubmit} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Source Tag / Case Label (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. precinct_export_44"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-2xl p-8 text-center bg-slate-950/60 transition cursor-pointer">
            <input
              type="file"
              accept=".csv,.json,.txt,.log"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
              <UploadCloud className="w-10 h-10 text-cyan-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-200">
                {file ? file.name : 'Click or Drag & Drop investigation file'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Accepted formats: .csv, .json, .txt, .log (Max 15 MB)
              </p>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !file}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{loading ? 'Uploading & Extracting...' : 'Upload & Process File'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Mode 3: Presets */}
      {activeMode === 'presets' && (
        <div className="grid sm:grid-cols-2 gap-4">
          {demoPresets.map((preset, idx) => (
            <div 
              key={idx}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between space-y-3 hover:border-cyan-500/40 transition"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-100 text-xs sm:text-sm">{preset.title}</h4>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {preset.type}
                  </span>
                </div>
                <pre className="mt-2 text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-lg font-mono overflow-x-auto max-h-28 border border-slate-800/80">
                  {preset.snippet}
                </pre>
              </div>
              <button
                onClick={() => handleLoadPreset(preset)}
                className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Load into Editor</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center space-x-2 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
            <h4 className="font-bold text-sm">Ingestion Completed Successfully</h4>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Entities Imported</span>
              <span className="text-lg font-bold text-emerald-300">+{result.imported_entities}</span>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Relationships</span>
              <span className="text-lg font-bold text-emerald-300">+{result.imported_relationships}</span>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Total Graph Nodes</span>
              <span className="text-lg font-bold text-cyan-300">{result.node_count}</span>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Detected Format</span>
              <span className="text-xs font-bold text-amber-300 uppercase block mt-1">
                {result.detected_input_type || 'Structured'}
              </span>
            </div>
          </div>

          {result.warnings && result.warnings.length > 0 && (
            <div className="space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-[11px] text-amber-300/90 font-mono">
              <span className="font-bold uppercase text-[10px] text-amber-400 block mb-0.5">Notices & Warnings:</span>
              {result.warnings.map((w, idx) => (
                <p key={idx}>• {w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Card */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 shadow-xl space-y-2 text-xs text-rose-300">
          <div className="flex items-center space-x-2 text-rose-400 font-bold">
            <XCircle className="w-5 h-5" />
            <span>Ingestion Error</span>
          </div>
          <p className="font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            {error}
          </p>
        </div>
      )}

    </div>
  );
}
