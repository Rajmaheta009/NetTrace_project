import React, { useState, useEffect } from 'react';
import { 
  Network, 
  BarChart3, 
  AlertOctagon, 
  FileText, 
  UploadCloud, 
  RotateCcw,
  Trash2,
  PlayCircle, 
  Sparkles, 
  ShieldAlert, 
  Shield,
  UserCheck,
  X,
  Sun, 
  Moon, 
  Zap, 
  Activity,
  Car,
  Clock,
  PhoneCall,
  Coins,
  MapPin,
  Search,
  Command
} from 'lucide-react';
import { fetchAuditTrail } from '../services/api';

export default function Navbar({
  activeTab, 
  setActiveTab, 
  health, 
  stats, 
  vehicleCount = 0,
  telecomCount = 0,
  financialCount = 0,
  locationCount = 0,
  patternCount = 0, 
  onReset,
  onLoadDemo,
  loading,
  theme,
  setTheme,
  onOpenCommandHUD
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [activeOfficer, setActiveOfficer] = useState('Officer_Agent_902');

  const isHealthy = health?.status === 'ok';

  useEffect(() => {
    if (showAuditModal) {
      setLoadingAudit(true);
      fetchAuditTrail(60)
        .then(data => setAuditLogs(data || []))
        .catch(err => console.error(err))
        .finally(() => setLoadingAudit(false));
    }
  }, [showAuditModal]);

  const navItems = [
    { id: 'graph', label: '3D Network Orbit', icon: Network, badge: stats?.nodes || 0, is3D: true },
    { id: 'ingest', label: 'Data Ingestion', icon: UploadCloud, isHighlight: true },
    { id: 'vehicles', label: 'Vehicles & Fleet', icon: Car, badge: vehicleCount },
    { id: 'telecom', label: 'Telecom & CDR', icon: PhoneCall, badge: telecomCount },
    { id: 'financial', label: 'Financial & Hawala', icon: Coins, badge: financialCount },
    { id: 'locations', label: 'Safehouses & Sites', icon: MapPin, badge: locationCount },
    { id: 'timeline', label: 'Incident Chronology', icon: Clock },
    { id: 'centrality', label: 'Influence & Brokers', icon: BarChart3 },
    { id: 'patterns', label: 'Pattern Radar', icon: AlertOctagon, badge: patternCount, alert: patternCount > 0 },
    { id: 'summary', label: 'AI Briefing', icon: FileText, ai: true },
  ];

  return (
    <header className="bg-slate-950/95 dark:bg-[#030611]/95 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-30 shadow-2xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Codename */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-cyan-400/30 shrink-0">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-black tracking-tight bg-gradient-to-r from-cyan-300 via-sky-200 to-blue-400 bg-clip-text text-transparent">
                  NetTrace AI
                </span>
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  v2.0 PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium tracking-tight">Criminal Syndicate & Multi-Vector Intelligence Engine</p>
            </div>
          </div>

          {/* Center: Fast Spotlight Search Trigger */}
          <div className="hidden md:flex items-center">
            <button
              onClick={onOpenCommandHUD}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 text-slate-300 hover:text-white transition shadow-sm group"
              title="Open Spotlight Search (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition" />
              <span className="text-xs font-medium">Spotlight Search...</span>
              <kbd className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-slate-850 border border-slate-700 text-[10px] font-mono text-slate-400">
                <Command className="w-2.5 h-2.5 mr-0.5" />
                <span>K</span>
              </kbd>
            </button>
          </div>

          {/* Right Controls: Prominent Insert Data CTA + Reset + Theme + Telemetry */}
          <div className="flex items-center space-x-2 text-xs">
            
            {/* Mobile Search Button */}
            <button
              onClick={onOpenCommandHUD}
              className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400"
              title="Spotlight Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* PROMINENT TOP-RIGHT INSERT DATA BUTTON (User Can Never Miss It!) */}
            <button
              onClick={() => setActiveTab('ingest')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl font-black text-xs transition-all shadow-md ${
                activeTab === 'ingest'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border border-emerald-400 shadow-emerald-500/30 ring-2 ring-emerald-400/40 scale-105'
                  : 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border border-cyan-300/60 shadow-lg shadow-cyan-500/25 hover:scale-105'
              }`}
              title="Click to insert or upload crime case data (CSV, JSON, Surveillance Reports)"
            >
              <UploadCloud className="w-4 h-4 text-white" />
              <span>+ Insert Data</span>
            </button>

            {/* Reset / Clear All Memory Button (Wipes graph empty) */}
            <button
              onClick={onReset}
              disabled={loading}
              title="Wipe all graph data from memory and empty the diagram completely"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-200 transition-all font-bold text-xs shadow-md disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset (Empty)</span>
            </button>

            {/* Load Sample Demo Case */}
            {onLoadDemo && (
              <button
                onClick={onLoadDemo}
                disabled={loading}
                title="Load sample crime syndicate case for demonstration"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white transition-all font-bold text-xs shadow-md disabled:opacity-50"
              >
                <PlayCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Demo Case</span>
              </button>
            )}

                        {/* Security Audit Trail Button */}
            <button
              onClick={() => setShowAuditModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-cyan-500/10 border border-slate-700 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-300 transition-all font-bold text-xs shadow-md"
              title="View immutable security audit log file (username_or_id :- look3d graph)"
            >
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden lg:inline font-mono">Audit Log</span>
            </button>

            {/* Live Engine Status */}
            <div className={`hidden xl:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border ${
              isHealthy 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-500/10' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span className="font-semibold text-[11px]">{isHealthy ? 'Engine Online' : 'Engine Offline'}</span>
            </div>

            {/* 3-Mode Theme Switcher */}
            <div className="flex items-center bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-lg transition ${
                  theme === 'light' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Forensic Daylight Mode"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-lg transition ${
                  theme === 'dark' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tactical Cyber Dark Mode"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme('midnight')}
                className={`p-1.5 rounded-lg transition ${
                  theme === 'midnight' ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Midnight OLED Stealth Mode"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>

        {/* Dynamic Tab Navigation Bar */}
        <div className="flex space-x-1.5 overflow-x-auto pb-2 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-200 border border-cyan-500/50 shadow-md shadow-cyan-500/10'
                    : item.isHighlight
                    ? 'text-cyan-300 hover:text-cyan-100 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-300' : item.isHighlight ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.is3D && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    3D
                  </span>
                )}
                {item.isHighlight && !isActive && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    New Case
                  </span>
                )}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                    item.alert 
                      ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 animate-pulse' 
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {item.ai && (
                  <span className="flex items-center text-[10px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.2 rounded border border-amber-500/30">
                    <Sparkles className="w-2.5 h-2.5 mr-0.5" /> AI
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>
      {/* Security Audit Trail Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>Security Activity & Audit Trail</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Tamper-Resistant
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    Log format: <span className="text-cyan-300">username_or_id :- action details</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Officer ID / Log File Info Banner */}
            <div className="my-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center space-x-2 text-slate-300">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Active Officer:</span>
                <input
                  type="text"
                  value={activeOfficer}
                  onChange={(e) => setActiveOfficer(e.target.value)}
                  className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-lg text-emerald-300 font-bold focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>
              <div className="flex items-center space-x-2 text-slate-500 text-[11px]">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>File: V2/logs/user_activity_audit.log</span>
              </div>
            </div>

            {/* Audit Log Stream */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs custom-scrollbar">
              {loadingAudit ? (
                <div className="py-12 text-center text-slate-400 animate-pulse">
                  Loading security audit stream...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  No activity logs recorded yet. Interact with 3D graph or ingest data to generate audit entries.
                </div>
              ) : (
                auditLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-cyan-500/30 transition flex flex-col space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span className="text-cyan-300 font-semibold">{log.timestamp}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-amber-300 font-bold">{log.user_id}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-bold">
                        {log.action}
                      </span>
                    </div>
                    <div className="text-slate-300 text-[11px] pl-4">
                      {log.details || log.raw}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 mt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Auto-capturing look3d, drag node, double click, ingest, and reset</span>
              <button
                onClick={() => {
                  fetchAuditTrail(60).then(data => setAuditLogs(data || []));
                }}
                className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-bold"
              >
                Refresh Log
              </button>
            </div>

          </div>
        </div>
      )}

    </header>
  );
}