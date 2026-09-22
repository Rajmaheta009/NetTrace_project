import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FolderLock,
  UploadCloud, 
  Trash2,
  PlayCircle, 
  Shield,
  X,
  Sun, 
  Moon, 
  Zap, 
  Activity,
  Search,
  Command,
  PanelLeft,
  History
} from 'lucide-react';

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
  onOpenCommandHUD,
  activeCase = null,
  currentUser = null,
  onOpenCaseModal = null,
  onOpenRoleModal = null,
  onOpenHistoryModal = null,
  sidebarCollapsed = false,
  setSidebarCollapsed = null
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Close reset confirmation dialog on Escape key
  useEffect(() => {
    if (!showResetConfirm) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowResetConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showResetConfirm]);

  const isHealthy = health?.status === 'ok';

  return (
    <header className="bg-slate-950/95 dark:bg-[#030611]/95 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-30 shadow-2xl">
      <div className="w-full px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Sidebar Toggle + Brand Logo + Case Pill */}
          <div className="flex items-center space-x-3">
            
            {/* Sidebar Collapse/Expand Toggle */}
            {setSidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                title={sidebarCollapsed ? "Expand Navigation Sidebar" : "Collapse Navigation Sidebar"}
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            {/* Logo & Codename */}
            <div className="flex items-center space-x-2">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-black tracking-tight bg-gradient-to-r from-cyan-300 via-sky-200 to-blue-400 bg-clip-text text-transparent">
                    NetTrace AI
                  </span>
                  <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    v2.0 PRO
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium tracking-tight hidden sm:block">Digital Investigation & Intelligence</p>
              </div>
            </div>

            {/* Active Case Selector Pill */}
            {onOpenCaseModal && (
              <button
                onClick={onOpenCaseModal}
                className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-xs font-bold transition shadow-sm group cursor-pointer"
                title="Click to Switch Active Case File"
              >
                <FolderLock className={`w-3.5 h-3.5 ${activeCase ? 'text-cyan-400' : 'text-amber-400'} group-hover:scale-110 transition-transform`} />
                <span className="text-slate-200 group-hover:text-cyan-300 truncate max-w-[140px]">
                  {activeCase?.case_name || 'No Active Case'}
                </span>
                <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                  activeCase 
                    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' 
                    : 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                }`}>
                  {activeCase?.status || 'Select Case'}
                </span>
              </button>
            )}

            {/* History & Previous Records Navigation Pill */}
            <button
              onClick={() => {
                if (onOpenHistoryModal) {
                  onOpenHistoryModal();
                } else if (setActiveTab) {
                  setActiveTab('audit');
                }
              }}
              className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer group shadow-sm ${
                activeTab === 'audit'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-sm shadow-amber-950/50'
                  : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-800 text-slate-300 hover:text-amber-300'
              }`}
              title="Check Previous Records & Investigation History"
            >
              <History className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-[-20deg] transition-transform" />
              <span>History</span>
            </button>
          </div>

          {/* Center: Fast Spotlight Search Trigger (Ctrl+K) */}
          <div className="hidden md:flex items-center">
            <button
              onClick={onOpenCommandHUD}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 text-slate-300 hover:text-white transition shadow-sm group cursor-pointer"
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

          {/* Right Controls: Insert Data CTA + Reset + Demo + Theme */}
          <div className="flex items-center space-x-2 text-xs">
            
            {/* Mobile Search Button */}
            <button
              onClick={onOpenCommandHUD}
              className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400"
              title="Spotlight Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Ingest Data CTA Button */}
            <button
              onClick={() => setActiveTab('ingest')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl font-black text-xs transition-all shadow-md cursor-pointer ${
                activeTab === 'ingest'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border border-emerald-400 shadow-emerald-500/30 ring-2 ring-emerald-400/40 scale-105'
                  : 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border border-cyan-300/60 shadow-lg shadow-cyan-500/25 hover:scale-105'
              }`}
              title="Click to insert or upload crime case data (CSV, JSON, Surveillance Reports)"
            >
              <UploadCloud className="w-4 h-4 text-white" />
              <span>+ Insert Data</span>
            </button>

            {/* Reset / Clear Memory Button */}
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={loading || ((stats?.nodes || 0) === 0 && (stats?.edges || 0) === 0)}
              title={((stats?.nodes || 0) > 0 || (stats?.edges || 0) > 0) ? "Wipe all graph data from memory and empty the diagram completely" : "No data inserted yet (Reset disabled)"}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                ((stats?.nodes || 0) === 0 && (stats?.edges || 0) === 0)
                  ? 'bg-transparent border border-slate-800/40 text-slate-600 opacity-20 cursor-not-allowed pointer-events-none shadow-none'
                  : 'bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-200 shadow-md cursor-pointer hover:scale-105'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {/* Load Sample Demo Case */}
            {onLoadDemo && (
              <button
                onClick={onLoadDemo}
                disabled={loading}
                title="Load sample crime syndicate case for demonstration"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white transition-all font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
              >
                <PlayCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Demo</span>
              </button>
            )}

            {/* Live Engine Status */}
            <div className={`hidden xl:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border ${
              isHealthy 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-500/10' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span className="font-semibold text-[11px]">{isHealthy ? 'Online' : 'Offline'}</span>
            </div>

            {/* 3-Mode Theme Switcher */}
            <div className="flex items-center bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-lg transition ${
                  theme === 'light' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Daylight Mode"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-lg transition ${
                  theme === 'dark' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Cyber Dark Mode"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme('midnight')}
                className={`p-1.5 rounded-lg transition ${
                  theme === 'midnight' ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Midnight OLED Mode"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* User Role & Login Switcher Pill */}
            {onOpenRoleModal && (
              <button
                onClick={onOpenRoleModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-xs font-bold transition shadow-sm group cursor-pointer hover:border-cyan-500/50"
                title="Switch Role or Log In to Account"
              >
                <Shield className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span className="text-slate-200 group-hover:text-cyan-300 font-mono text-[11px] truncate max-w-[120px]">
                  {currentUser?.role?.value || currentUser?.role || 'Switch Role'}
                </span>
              </button>
            )}

          </div>

        </div>
      </div>

      {/* Tactical Confirmation Modal Before Reset Data */}
      {showResetConfirm && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] w-screen h-screen min-h-screen flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowResetConfirm(false)}
        >
          <div 
            className="relative w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-rose-950/70 flex flex-col m-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowResetConfirm(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-500/10">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Confirm Data Reset</h3>
                <p className="text-xs text-rose-400/90 font-medium">Clear In-Memory Case Graph</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to reset graph data? This will clear active in-memory entities and relationships. The 3D diagram will become completely empty.
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  onReset();
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Reset Data</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
