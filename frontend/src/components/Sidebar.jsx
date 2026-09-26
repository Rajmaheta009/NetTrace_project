import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  Network,
  ShieldCheck,
  CheckSquare,
  Users2,
  GitFork,
  Clock,
  AlertOctagon,
  BarChart3,
  PhoneCall,
  Coins,
  Car,
  MapPin,
  FileText,
  StickyNote,
  History,
  UploadCloud,
  FolderLock,
  ChevronLeft,
  ChevronRight,
  User,
  ShieldAlert
} from 'lucide-react';
import { getAuthorizedNavItems, can, isTabAuthorized } from '../utils/permissions';

export default function Sidebar({
  activeTab,
  setActiveTab,
  activeCase,
  currentUser,
  onOpenHistoryModal,
  onOpenCaseModal,
  onOpenRoleModal,
  validationCount = 0,
  evidenceCount = 0,
  patternCount = 0,
  notesCount = 0,
  collapsed,
  setCollapsed,
}) {
  const rawNavSections = [
    {
      title: 'Command & Core',
      items: [
        { id: 'dashboard', label: 'Command Overview', icon: LayoutDashboard },
        { id: 'graph', label: '3D Network Orbit', icon: Network, highlight: true },
        { id: 'evidence', label: 'Evidence Registry', icon: ShieldCheck, badge: evidenceCount },
        { id: 'validation', label: 'Data Quality Queue', icon: CheckSquare, badge: validationCount, badgeAlert: validationCount > 0 },
      ],
    },
    {
      title: 'Forensic Analytics',
      items: [
        { id: 'communities', label: 'Communities & Clusters', icon: Users2 },
        { id: 'connections', label: 'Connection Finder', icon: GitFork },
        { id: 'timeline', label: 'Chronology & Events', icon: Clock },
        { id: 'patterns', label: 'Pattern Radar', icon: AlertOctagon, badge: patternCount, badgeAlert: patternCount > 0 },
        { id: 'centrality', label: 'Centrality & Brokers', icon: BarChart3 },
      ],
    },
    {
      title: 'Surveillance Vectors',
      items: [
        { id: 'telecom', label: 'Telecom & CDR', icon: PhoneCall },
        { id: 'financial', label: 'Financial & Hawala', icon: Coins },
        { id: 'vehicles', label: 'Vehicles & Fleet', icon: Car },
        { id: 'locations', label: 'Locations & Sites', icon: MapPin },
      ],
    },
    {
      title: 'Dossier & Governance',
      items: [
        { id: 'reports', label: 'Case Dossier & Export', icon: FileText, special: true },
        { id: 'notes', label: 'Field Notes', icon: StickyNote, badge: notesCount },
        { id: 'audit', label: 'Investigation History', icon: History },
        { id: 'ingest', label: 'Data Ingestion', icon: UploadCloud },
        { id: 'cases', label: 'Case Files Manager', icon: FolderLock },
        { id: 'admin', label: 'Administration & RBAC', icon: ShieldAlert, special: true },
      ],
    },
  ];

  // Dynamically resolve only the sections and tabs authorized for the current user's role and case status
  const navSections = useMemo(() => {
    return getAuthorizedNavItems(currentUser, rawNavSections, Boolean(activeCase));
  }, [currentUser, activeCase, evidenceCount, validationCount, patternCount, notesCount]);

  const getRoleBadgeColor = (role) => {
    const r = String(role || '').toUpperCase().replace(' ', '_');
    switch (r) {
      case 'SUPER_ADMIN': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'ADMIN': return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'INVESTIGATOR': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'ANALYST': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'REVIEWER': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'VIEWER': return 'bg-slate-700/40 text-slate-300 border-slate-600';
      default: return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <aside
      className={`bg-slate-950/95 dark:bg-[#030712]/95 backdrop-blur-xl border-r border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out shrink-0 z-20 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Active Case Context Card */}
      <div className="p-3 border-b border-slate-800/70">
        {!collapsed ? (
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                <FolderLock className={`w-3 h-3 ${activeCase ? 'text-cyan-400' : 'text-amber-400'}`} />
                {activeCase ? 'Active Case' : 'No Case Selected'}
              </span>
              <button
                onClick={onOpenCaseModal}
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                title="Switch or Create Case"
              >
                {activeCase ? 'Switch' : 'Select'}
              </button>
            </div>
            {activeCase ? (
              <div
                onClick={onOpenCaseModal}
                className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 rounded-lg p-2 cursor-pointer transition-colors group"
              >
                <div className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 truncate">
                  {activeCase.case_name}
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
                  <span>{activeCase.case_id}</span>
                  <span className="text-emerald-400 font-semibold">{activeCase.status || 'Open'}</span>
                </div>
              </div>
            ) : (
              <button
                onClick={onOpenCaseModal}
                className="w-full py-2 px-2.5 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15 text-amber-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <FolderLock className="w-3.5 h-3.5 text-amber-400" />
                <span>Select / Open Case</span>
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenCaseModal}
            className={`w-10 h-10 mx-auto flex items-center justify-center rounded-lg border cursor-pointer transition-colors ${
              activeCase
                ? 'bg-slate-900 border-slate-800 text-cyan-400 hover:bg-slate-800'
                : 'bg-amber-950/30 border-amber-700/50 text-amber-400 hover:bg-amber-900/40'
            }`}
            title={activeCase ? `Active: ${activeCase.case_name}` : 'No Case Selected - Click to Open Case'}
          >
            <FolderLock className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Scrollable Area */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
        {navSections.map((sec, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {!collapsed && (
              <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                {sec.title}
              </div>
            )}
            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-950/80 to-blue-950/40 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/70 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                        : item.highlight
                        ? 'text-cyan-400/80'
                        : item.special
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  />
                  {!collapsed && (
                    <span className="flex-1 text-left truncate">{item.label}</span>
                  )}
                  {!collapsed && item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                        item.badgeAlert
                          ? 'bg-red-950/80 text-red-300 border-red-700/60'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {collapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 absolute right-2" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom User & Role Section */}
      <div className="p-3 border-t border-slate-800/70 bg-slate-950/50">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center space-x-2 truncate cursor-pointer group"
              onClick={onOpenRoleModal}
              title="Click to Switch Role or Log In"
            >
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-cyan-400 group-hover:border-cyan-500 transition">
                <User className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-[11px] font-semibold text-slate-200 group-hover:text-cyan-300 transition truncate">
                  {currentUser?.name || currentUser?.username || 'Officer Vikram'}
                </div>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="text-[9px] font-mono text-cyan-300 font-bold bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40 group-hover:border-cyan-500/60 transition">
                    {currentUser?.role?.value || currentUser?.role || 'Active Role'}
                  </span>
                  {onOpenHistoryModal && can(currentUser, 'AUDIT_VIEW') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenHistoryModal(); }}
                      className="text-[9px] font-mono text-amber-400 hover:text-amber-300 flex items-center space-x-0.5 cursor-pointer underline decoration-amber-500/40"
                      title="Check Previous Investigation Records"
                    >
                      <History className="w-2.5 h-2.5" />
                      <span>History</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-900 cursor-pointer"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            {can(currentUser, 'AUDIT_VIEW') && (
              <button
                onClick={() => onOpenHistoryModal ? onOpenHistoryModal() : setActiveTab('audit')}
                className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400 hover:bg-slate-800 cursor-pointer"
                title="Check Previous Investigation Records"
              >
                <History className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setCollapsed(false)}
              className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-900 cursor-pointer"
              title="Expand Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
