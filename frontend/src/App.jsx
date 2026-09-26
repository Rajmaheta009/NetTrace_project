import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ViewLoadingSkeleton from './components/ViewLoadingSkeleton';
import { ShieldAlert, FolderLock, X } from 'lucide-react';

// =============================================================
// LAZY-LOADED CORE & FORENSIC VIEWS (Code Splitting / Decoupled Chunks)
// =============================================================
const GraphView = lazy(() => import('./components/GraphView'));
const DashboardOverview = lazy(() => import('./components/DashboardOverview'));
const CasesView = lazy(() => import('./components/CasesView'));
const EvidenceView = lazy(() => import('./components/EvidenceView'));
const ValidationCenter = lazy(() => import('./components/ValidationCenter'));
const CommunitiesView = lazy(() => import('./components/CommunitiesView'));
const ConnectionFinderView = lazy(() => import('./components/ConnectionFinderView'));
const NotesView = lazy(() => import('./components/NotesView'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const AuditView = lazy(() => import('./components/AuditView'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));

// =============================================================
// LAZY-LOADED VECTOR VIEWS
// =============================================================
const VehiclesView = lazy(() => import('./components/VehiclesView'));
const TelecomView = lazy(() => import('./components/TelecomView'));
const FinancialView = lazy(() => import('./components/FinancialView'));
const LocationsView = lazy(() => import('./components/LocationsView'));
const TimelineView = lazy(() => import('./components/TimelineView'));
const CentralityTable = lazy(() => import('./components/CentralityTable'));
const PatternsRadar = lazy(() => import('./components/PatternsRadar'));
const SummaryView = lazy(() => import('./components/SummaryView'));
const IngestPanel = lazy(() => import('./components/IngestPanel'));

// =============================================================
// LAZY-LOADED MODALS & DRAWERS (Zero Initial Footprint)
// =============================================================
const CommandHUD = lazy(() => import('./components/CommandHUD'));
const DeepEntityInspection = lazy(() => import('./components/DeepEntityInspection'));
const EntityDrawer = lazy(() => import('./components/EntityDrawer'));
const HistoryRecordsModal = lazy(() => import('./components/HistoryRecordsModal'));
const CaseSwitcherModal = lazy(() => 
  import('./components/CaseRoleModals').then(module => ({ default: module.CaseSwitcherModal }))
);
const RoleSwitcherModal = lazy(() => 
  import('./components/CaseRoleModals').then(module => ({ default: module.RoleSwitcherModal }))
);

import { 
  checkHealth, 
  fetchGraph, 
  fetchCentrality, 
  fetchPatterns, 
  fetchSummary, 
  fetchEntityDetail, 
  resetGraph,
  clearGraph,
  loadDemoGraph,
  fetchActiveCase,
  switchCase,
  fetchCurrentUser,
  fetchEvidence,
  fetchValidationRecords,
  fetchCommunities,
  fetchNotes,
  fetchCrimeProfiles,
  updateCaseInvestigationType
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('graph');
  const [theme, setTheme] = useState('midnight');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Case & RBAC State
  const [activeCase, setActiveCase] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [crimeProfiles, setCrimeProfiles] = useState([]);
  const [deepInspectEntityId, setDeepInspectEntityId] = useState(null);
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Investigation Data State
  const [health, setHealth] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [centralityList, setCentralityList] = useState([]);
  const [patternFlags, setPatternFlags] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [evidenceList, setEvidenceList] = useState([]);
  const [validationQueue, setValidationQueue] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [notesList, setNotesList] = useState([]);

  // Active Cross-View Highlights in 3D Orbit
  const [highlightedCommunity, setHighlightedCommunity] = useState(null);
  const [highlightedPath, setHighlightedPath] = useState(null);

  // Inspector & Drawer State
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [entityDetail, setEntityDetail] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const selectedEntityRef = useRef(null);

  // Apply Theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('midnight', 'dark', 'light');
    root.classList.add(theme);
  }, [theme]);

  // Global Keyboard Shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Investigation Case & Context Hydration Status
  const [caseLoadStatus, setCaseLoadStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'unauthorized' | 'not_found' | 'error'
  const [caseLoadError, setCaseLoadError] = useState(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(null);

  // Global Session Expiration Listener
  useEffect(() => {
    const handleSessionExpired = (e) => {
      const msg = e?.detail?.message || 'Your session has expired. Please log in again to continue.';
      setSessionExpiredNotice(msg);
      setCurrentUser(null);
      setIsRoleModalOpen(true);
    };
    window.addEventListener('nettrace:session-expired', handleSessionExpired);
    return () => window.removeEventListener('nettrace:session-expired', handleSessionExpired);
  }, []);

  /**
   * loadActiveCaseAndContext
   * Core orchestrator responsible for:
   * 1. Verifying authenticated session & loading user role/permissions
   * 2. Switching or fetching active case file metadata from PostgreSQL backend
   * 3. Hydrating case graph (nodes/links), centrality rankings, and pattern radar flags
   * 4. Asynchronously background-hydrating evidence, validation queue, communities, notes, and crime profiles
   * 5. Safely separating authentication, authorization, missing case, and network error states
   */
  const loadActiveCaseAndContext = useCallback(async (targetCaseId = null) => {
    setLoading(true);
    setCaseLoadStatus('loading');
    setCaseLoadError(null);

    try {
      // Step 1: Verify authenticated user & roles
      try {
        const curUser = await fetchCurrentUser();
        if (curUser) {
          setCurrentUser(curUser);
        }
      } catch (authErr) {
        console.warn('Session verification notice:', authErr.message);
        if (authErr.message?.includes('401')) {
          setCaseLoadStatus('unauthenticated');
        }
      }

      // Step 2: Switch case if targetCaseId provided, else fetch currently active case
      let activeC = null;
      if (targetCaseId) {
        try {
          const switchRes = await switchCase(targetCaseId);
          activeC = switchRes?.case || switchRes;
          setCaseLoadStatus('success');
          setCaseLoadError(null);
        } catch (switchErr) {
          console.warn(`Failed to switch active case to ${targetCaseId}:`, switchErr.message);
          const msg = switchErr.message || '';
          if (msg.includes('403') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('not assigned')) {
            setCaseLoadStatus('unauthorized');
            setCaseLoadError('Access Denied: You are not assigned to this case file.');
          } else if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
            setCaseLoadStatus('not_found');
            setCaseLoadError('Case file not found.');
          } else {
            setCaseLoadStatus('error');
            setCaseLoadError(msg || 'Failed to switch case.');
          }
          activeC = null;
        }
      } else {
        try {
          activeC = await fetchActiveCase();
          setCaseLoadStatus('success');
          setCaseLoadError(null);
        } catch (caseErr) {
          const msg = caseErr.message || '';
          if (msg.includes('403') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('not assigned')) {
            setCaseLoadStatus('unauthorized');
            setCaseLoadError('Access Denied: You are not assigned to this case file.');
            activeC = null;
          } else if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
            setCaseLoadStatus('not_found');
            setCaseLoadError('No active investigation selected.');
            activeC = null;
          } else {
            setCaseLoadStatus('error');
            setCaseLoadError(msg || 'Failed to retrieve active case.');
            activeC = null;
          }
        }
      }

      if (activeC) {
        setActiveCase(activeC);
        setCaseLoadStatus('success');
        const caseId = activeC?.case_id || targetCaseId || null;

        // Step 3: Priority core investigation fetch (Graph, Centrality, Patterns, Crime Profiles, Health)
        const [h, g, c, p, cProfiles] = await Promise.all([
          checkHealth().catch(() => null),
          fetchGraph().catch(() => ({ nodes: [], links: [] })),
          fetchCentrality().catch(() => []),
          fetchPatterns(caseId).catch(() => []),
          fetchCrimeProfiles().catch(() => []),
        ]);

        if (h) setHealth(h);
        setGraphData(g || { nodes: [], links: [] });
        setCentralityList(Array.isArray(c) ? c : (c?.centrality || []));
        setPatternFlags(Array.isArray(p) ? p : (p?.patterns || []));
        if (cProfiles && cProfiles.length) setCrimeProfiles(Array.isArray(cProfiles) ? cProfiles : (cProfiles?.profiles || []));

        // Step 4: Secondary deferred hydration (Evidence, Validation, Communities, Notes)
        Promise.all([
          fetchEvidence(caseId).catch(() => []),
          fetchValidationRecords(caseId).catch(() => []),
          fetchCommunities(caseId).catch(() => []),
          fetchNotes(caseId).catch(() => []),
        ]).then(([ev, val, comms, nts]) => {
          setEvidenceList(Array.isArray(ev) ? ev : (ev?.evidence || []));
          setValidationQueue(Array.isArray(val) ? val : (val?.records || []));
          setCommunities(Array.isArray(comms) ? comms : (comms?.communities || []));
          setNotesList(Array.isArray(nts) ? nts : (nts?.notes || []));
        });
      } else {
        // Clear presentation state when no case is active or access is denied
        setActiveCase(null);
        setGraphData({ nodes: [], links: [] });
        setCentralityList([]);
        setPatternFlags([]);
        setEvidenceList([]);
        setValidationQueue([]);
        setCommunities([]);
        setNotesList([]);
      }

    } catch (err) {
      console.error('Failed in loadActiveCaseAndContext:', err);
      setCaseLoadStatus('error');
      setCaseLoadError(err.message || 'Investigation context loading failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Primary Investigation Core Data Loader (aliased to loadActiveCaseAndContext for complete consistency)
  const loadAllData = loadActiveCaseAndContext;

  // Initial mount & telemetry polling
  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      checkHealth().then(setHealth).catch(() => null);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadAllData]);

  // On-Demand Lazy Data Fetching when user switches tabs
  useEffect(() => {
    if (activeTab === 'evidence' && evidenceList.length === 0) {
      fetchEvidence().then(setEvidenceList).catch(() => null);
    } else if (activeTab === 'validation' && validationQueue.length === 0) {
      fetchValidationRecords().then(setValidationQueue).catch(() => null);
    } else if (activeTab === 'communities' && communities.length === 0) {
      fetchCommunities().then(setCommunities).catch(() => null);
    } else if (activeTab === 'notes' && notesList.length === 0) {
      fetchNotes().then(setNotesList).catch(() => null);
    }
  }, [activeTab, evidenceList.length, validationQueue.length, communities.length, notesList.length]);

  // Entity selection & forensic side drawer opening
  const handleSelectEntity = async (entityId, shouldOpenDrawer = true) => {
    selectedEntityRef.current = entityId;
    if (!entityId) {
      setSelectedEntityId(null);
      setEntityDetail(null);
      setIsDrawerOpen(false);
      return;
    }

    setSelectedEntityId(entityId);
    if (shouldOpenDrawer) {
      setIsDrawerOpen(true);
    }
    setDrawerLoading(true);

    try {
      const detail = await fetchEntityDetail(entityId);
      if (selectedEntityRef.current === entityId) {
        setEntityDetail(detail);
      }
    } catch (err) {
      if (selectedEntityRef.current !== entityId) return;
      console.warn('Backend entity detail fetch failed, using local graph fallback:', err);
      const node = (graphData.nodes || []).find(n => n.id === entityId);
      if (node) {
        const conns = (graphData.links || [])
          .filter(l => {
            const sId = typeof l.source === 'object' ? l.source?.id : l.source;
            const tId = typeof l.target === 'object' ? l.target?.id : l.target;
            return sId === entityId || tId === entityId;
          })
          .map(l => {
            const sId = typeof l.source === 'object' ? l.source?.id : l.source;
            const tId = typeof l.target === 'object' ? l.target?.id : l.target;
            const isSource = sId === entityId;
            const neighborId = isSource ? tId : sId;
            const neighborNode = (graphData.nodes || []).find(n => n.id === neighborId);
            return {
              entity_id: neighborId,
              entity_name: neighborNode?.name || neighborId,
              relation_type: l.relation_type || 'CONNECTED',
              evidence: l.evidence || ['Derived from network graph link']
            };
          });
        setEntityDetail({
          entity: node,
          centrality: node.centrality || { degree: 0, betweenness: 0 },
          connections: conns
        });
      }
    } finally {
      if (selectedEntityRef.current === entityId) {
        setDrawerLoading(false);
      }
    }
  };

  const handleOpenDrawer = (entityId) => {
    const targetId = entityId || selectedEntityId;
    if (targetId) {
      handleSelectEntity(targetId, true);
    }
  };

  // Cross-Tab Redirections to 3D Graph
  const handleNavigateToGraph = (entityId) => {
    setActiveTab('graph');
    if (entityId) {
      handleSelectEntity(entityId, true);
    }
  };

  const handleHighlightCommunityInGraph = (communityName) => {
    setHighlightedCommunity(communityName);
    setActiveTab('graph');
  };

  const handleHighlightPathInGraph = (nodeIds) => {
    setHighlightedPath(nodeIds);
    setActiveTab('graph');
  };

  // Case Switch Callback
  const handleSwitchCrimeProfile = async (profileId) => {
    if (!activeCase?.case_id) return;
    try {
      const updated = await updateCaseInvestigationType(activeCase.case_id, profileId);
      setActiveCase(updated);
      await loadAllData();
    } catch (err) {
      console.error('Failed to switch crime profile:', err);
    }
  };

  const handleOpenDeepInspect = (entityId) => {
    setDeepInspectEntityId(entityId);
  };

  const handleCaseSwitched = async (newCaseId) => {
    setSelectedEntityId(null);
    setEntityDetail(null);
    setIsDrawerOpen(false);
    setHighlightedCommunity(null);
    setHighlightedPath(null);
    await loadActiveCaseAndContext(newCaseId);
  };

  // Reset graph: clear all memory data and empty diagram completely
  const handleReset = async () => {
    if (loading) return;
    setSelectedEntityId(null);
    selectedEntityRef.current = null;
    setEntityDetail(null);
    setIsDrawerOpen(false);
    setGraphData({ nodes: [], links: [] });
    setCentralityList([]);
    setPatternFlags([]);
    setSummaryData({
      summary: "All graph memory data cleared. The diagram is currently empty. Insert new case data or load a demo to begin analysis.",
      entities_to_watch: []
    });

    setLoading(true);
    try {
      await clearGraph();
      await loadAllData();
    } catch (err) {
      console.warn('Backend graph clear warning:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load sample demo case
  const handleLoadDemo = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await loadDemoGraph();
      await loadAllData();
      loadSummary();
    } catch (err) {
      console.warn('Backend demo load failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load AI Summary
  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const s = await fetchSummary();
      setSummaryData(s);
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'summary' && !summaryData && !summaryLoading) {
      loadSummary();
    }
  }, [activeTab, summaryData, summaryLoading]);

  // Derived Category Counts
  const vehicleCount = useMemo(() => {
    return graphData?.nodes?.filter(n => n?.type === 'Vehicle')?.length ?? 0;
  }, [graphData]);

  const telecomCount = useMemo(() => {
    const direct = graphData?.nodes?.filter(n => n?.type === 'PhoneNumber')?.length ?? 0;
    const fromPersons = graphData?.nodes?.filter(n => n?.type === 'Person' && n?.attributes?.phone)?.length ?? 0;
    return direct > 0 ? direct : fromPersons;
  }, [graphData]);

  const financialCount = useMemo(() => {
    return graphData?.nodes?.filter(n => n?.type === 'Organization')?.length ?? 0;
  }, [graphData]);

  const locationCount = useMemo(() => {
    return graphData?.nodes?.filter(n => n?.type === 'Location')?.length ?? 0;
  }, [graphData]);

  const pendingValidationCount = useMemo(() => {
    return validationQueue?.filter(v => v?.status === 'Needs Review')?.length ?? 0;
  }, [validationQueue]);

  const isAdmin = useMemo(() => {
    return currentUser?.roles?.some(r => ['ADMIN', 'SUPER_ADMIN'].includes(String(r).toUpperCase().replace(' ', '_'))) ||
           ['ADMIN', 'SUPER_ADMIN'].includes(String(currentUser?.role?.value || currentUser?.role || '').toUpperCase().replace(' ', '_'));
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col antialiased transition-colors duration-300">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        stats={{ nodes: graphData?.nodes?.length ?? 0, edges: graphData?.links?.length ?? 0 }}
        vehicleCount={vehicleCount}
        telecomCount={telecomCount}
        financialCount={financialCount}
        locationCount={locationCount}
        patternCount={patternFlags?.length ?? 0}
        onReset={handleReset}
        onLoadDemo={handleLoadDemo}
        loading={loading}
        theme={theme}
        setTheme={setTheme}
        onOpenCommandHUD={() => setIsCommandOpen(true)}
        activeCase={activeCase}
        currentUser={currentUser}
        onOpenCaseModal={() => setIsCaseModalOpen(true)}
        onOpenRoleModal={() => setIsRoleModalOpen(true)}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
      />

      {/* Main Workspace Layout (Sidebar + Center Content) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Modern Collapsible Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeCase={activeCase}
          currentUser={currentUser}
          onOpenRoleModal={() => setIsRoleModalOpen(true)}
          onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
          onOpenCaseModal={() => setIsCaseModalOpen(true)}
          validationCount={pendingValidationCount}
          evidenceCount={evidenceList?.length ?? 0}
          patternCount={patternFlags?.length ?? 0}
          notesCount={notesList?.length ?? 0}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />

        {/* Viewport Main Container with Lazy Suspense Wrapper */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <div className="max-w-7xl mx-auto">

            {/* Session Expiration Global Alert Banner */}
            {sessionExpiredNotice && (
              <div className="mb-6 p-4 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex items-center justify-between text-xs text-amber-200 shadow-xl animate-in fade-in">
                <div className="flex items-center space-x-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-bold text-amber-100">Session Expired</p>
                    <p className="text-amber-300/80">{sessionExpiredNotice}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setIsRoleModalOpen(true);
                      setSessionExpiredNotice(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer"
                  >
                    Log In Again
                  </button>
                  <button
                    onClick={() => setSessionExpiredNotice(null)}
                    className="p-1.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Case Authorization Alert Banner */}
            {caseLoadStatus === 'unauthorized' && (
              <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between text-xs text-rose-300 shadow-lg animate-in fade-in">
                <div className="flex items-center space-x-3">
                  <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-rose-200">Access Denied to Active Case File</p>
                    <p className="text-rose-400/90">{caseLoadError || 'Your current role is not assigned to this case file.'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCaseModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-bold transition cursor-pointer"
                >
                  Switch Case
                </button>
              </div>
            )}

            {/* No Active Case Selected Empty State Alert */}
            {caseLoadStatus === 'not_found' && !activeCase && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-300 shadow-lg animate-in fade-in">
                <div className="flex items-center space-x-3">
                  <FolderLock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-amber-200">No Active Investigation Selected</p>
                    <p className="text-amber-400/90">Please select an assigned case file or create a new case to begin evidence analysis.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCaseModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold transition cursor-pointer"
                >
                  Choose Case File
                </button>
              </div>
            )}
            
            <Suspense fallback={<ViewLoadingSkeleton message={`Initializing ${activeTab.toUpperCase()} View...`} />}>

              {activeTab === 'dashboard' && (
                <DashboardOverview
                  activeCase={activeCase}
                  graphData={graphData}
                  centralityList={centralityList}
                  patternFlags={patternFlags}
                  evidenceList={evidenceList}
                  validationQueue={validationQueue}
                  communities={communities}
                  crimeProfiles={crimeProfiles}
                  activeProfileId={activeCase?.investigation_type || 'organized_crime'}
                  onSelectProfile={handleSwitchCrimeProfile}
                  onNavigate={(tab) => setActiveTab(tab)}
                  onInspectEntity={handleNavigateToGraph}
                  onDeepInspect={handleOpenDeepInspect}
                />
              )}

              {activeTab === 'graph' && (
                <GraphView
                  graphData={graphData}
                  activeCase={activeCase}
                  selectedEntityId={selectedEntityId}
                  onSelectEntity={handleSelectEntity}
                  isDrawerOpen={isDrawerOpen}
                  onOpenDrawer={handleOpenDrawer}
                  onDeepInspect={handleOpenDeepInspect}
                  crimeProfile={crimeProfiles.find(p => p.id === (activeCase?.investigation_type || 'organized_crime'))}
                  onRefresh={loadAllData}
                  onOpenIngest={() => setActiveTab('ingest')}
                  onLoadDemo={handleLoadDemo}
                  theme={theme}
                  highlightedCommunity={highlightedCommunity}
                  onClearCommunityHighlight={() => setHighlightedCommunity(null)}
                  highlightedPath={highlightedPath}
                  onClearPathHighlight={() => setHighlightedPath(null)}
                />
              )}

              {activeTab === 'cases' && (
                <CasesView
                  activeCase={activeCase}
                  onCaseSwitched={handleCaseSwitched}
                />
              )}

              {activeTab === 'evidence' && (
                <EvidenceView
                  activeCase={activeCase}
                />
              )}

              {activeTab === 'validation' && (
                <ValidationCenter
                  activeCase={activeCase}
                  graphData={graphData}
                  onReviewCompleted={loadAllData}
                  onDeepInspect={handleOpenDeepInspect}
                />
              )}

              {activeTab === 'communities' && (
                <CommunitiesView
                  activeCase={activeCase}
                  onHighlightInGraph={handleHighlightCommunityInGraph}
                />
              )}

              {activeTab === 'connections' && (
                <ConnectionFinderView
                  activeCase={activeCase}
                  graphData={graphData}
                  onHighlightPathInGraph={handleHighlightPathInGraph}
                />
              )}

              {activeTab === 'notes' && (
                <NotesView
                  activeCase={activeCase}
                  graphData={graphData}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  activeCase={activeCase}
                />
              )}

              {activeTab === 'audit' && (
                <AuditView />
              )}

              {activeTab === 'vehicles' && (
                <VehiclesView
                  graphData={graphData}
                  patterns={patternFlags}
                  onInspectEntity={handleSelectEntity}
                  onNavigateToGraph={handleNavigateToGraph}
                />
              )}

              {activeTab === 'telecom' && (
                <TelecomView
                  graphData={graphData}
                  patterns={patternFlags}
                  onInspectEntity={handleSelectEntity}
                  onNavigateToGraph={handleNavigateToGraph}
                />
              )}

              {activeTab === 'financial' && (
                <FinancialView
                  graphData={graphData}
                  patterns={patternFlags}
                  onInspectEntity={handleSelectEntity}
                  onNavigateToGraph={handleNavigateToGraph}
                />
              )}

              {activeTab === 'locations' && (
                <LocationsView
                  graphData={graphData}
                  onInspectEntity={handleSelectEntity}
                  onNavigateToGraph={handleNavigateToGraph}
                />
              )}

              {activeTab === 'timeline' && (
                <TimelineView
                  graphData={graphData}
                  onNavigateToGraph={handleNavigateToGraph}
                  onInspectEntity={handleOpenDeepInspect}
                />
              )}

              {activeTab === 'centrality' && (
                <CentralityTable
                  centralityData={centralityList}
                  onInspectEntity={handleNavigateToGraph}
                />
              )}

              {activeTab === 'patterns' && (
                <PatternsRadar
                  patterns={patternFlags}
                  onSelectEntity={handleNavigateToGraph}
                  activeCase={activeCase}
                  onPatternsUpdated={loadAllData}
                />
              )}

              {activeTab === 'summary' && (
                <SummaryView
                  summaryData={summaryData}
                  loading={summaryLoading}
                  onRefresh={loadSummary}
                  onInspectEntity={handleNavigateToGraph}
                />
              )}

              {activeTab === 'ingest' && (
                <IngestPanel
                  onIngestSuccess={() => {
                    loadAllData();
                    setSummaryData(null);
                  }}
                />
              )}

              {activeTab === 'admin' && (
                isAdmin ? (
                  <AdminPanel
                    currentUser={currentUser}
                    onRoleSwitched={loadAllData}
                  />
                ) : (
                  <div className="p-10 text-center bg-slate-900/90 border border-rose-800/40 rounded-3xl max-w-lg mx-auto mt-12 space-y-4 shadow-2xl animate-in fade-in">
                    <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <h2 className="text-lg font-bold text-white">Access Denied: Administration Console</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      The Administration & RBAC panel requires <strong>Administrator</strong> or <strong>Super Admin</strong> credentials. Your current role is <strong>{currentUser?.role?.value || currentUser?.role || 'User'}</strong>.
                    </p>
                    <button
                      onClick={() => setActiveTab('graph')}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition cursor-pointer"
                    >
                      Return to Operational Graph
                    </button>
                  </div>
                )
              )}


            </Suspense>

          </div>
        </main>

      </div>

      {/* Spotlight Command HUD (Lazy Loaded on Open) */}
      {isCommandOpen && (
        <Suspense fallback={null}>
          <CommandHUD
            isOpen={isCommandOpen}
            onClose={() => setIsCommandOpen(false)}
            graphData={graphData}
            patterns={patternFlags}
            onSelectEntity={handleSelectEntity}
            onNavigateToGraph={handleNavigateToGraph}
            onOpenIngest={() => setActiveTab('ingest')}
            onLoadDemo={handleLoadDemo}
          />
        </Suspense>
      )}

      {/* Full-Spectrum Deep Entity Inspection Modal (Lazy Loaded on Trigger) */}
      {deepInspectEntityId && (
        <Suspense fallback={<ViewLoadingSkeleton message="Loading Deep Inspection Dossier..." />}>
          <DeepEntityInspection
            caseId={activeCase?.case_id || 'case-001'}
            entityId={deepInspectEntityId}
            onClose={() => setDeepInspectEntityId(null)}
            allEntities={graphData.nodes || []}
            onHighlightCommunity={handleHighlightCommunityInGraph}
            onHighlightPath={handleHighlightPathInGraph}
            onSelectEntity={handleSelectEntity}
          />
        </Suspense>
      )}

      {/* Forensic Entity Inspector Side Drawer (Lazy Loaded on Select) */}
      {isDrawerOpen && (
        <Suspense fallback={null}>
          <EntityDrawer
            isOpen={isDrawerOpen}
            entityDetail={entityDetail}
            loading={drawerLoading}
            onClose={() => setIsDrawerOpen(false)}
            onSelectNeighbor={handleSelectEntity}
            onOpenVehiclesTab={() => setActiveTab('vehicles')}
          />
        </Suspense>
      )}

      {/* Case Switcher Modal (Lazy Loaded on Request) */}
      {isCaseModalOpen && (
        <Suspense fallback={null}>
          <CaseSwitcherModal
            isOpen={isCaseModalOpen}
            onClose={() => setIsCaseModalOpen(false)}
            activeCase={activeCase}
            onCaseSwitched={handleCaseSwitched}
          />
        </Suspense>
      )}

      {/* Role Switcher & Account Login Modal (Lazy Loaded on Demand) */}
      {isRoleModalOpen && (
        <Suspense fallback={null}>
          <RoleSwitcherModal
            isOpen={isRoleModalOpen}
            onClose={() => setIsRoleModalOpen(false)}
            currentUser={currentUser}
            onRoleSwitched={(updatedUser) => {
              if (updatedUser) setCurrentUser(updatedUser);
              loadActiveCaseAndContext();
            }}
          />
        </Suspense>
      )}

      {/* Investigation History & Previous Records Modal (Lazy Loaded on Demand) */}
      {isHistoryModalOpen && (
        <Suspense fallback={null}>
          <HistoryRecordsModal
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            onInspectEntity={handleOpenDeepInspect}
            onNavigate={(tab) => {
              setActiveTab(tab);
              setIsHistoryModalOpen(false);
            }}
          />
        </Suspense>
      )}

      {/* Tactical Footer */}
      <footer className="border-t border-slate-800/60 py-3 px-6 text-center text-[11px] text-slate-500 font-mono flex items-center justify-between">
        <span>NetTrace Intelligence v2.0 • Deterministic NetworkX MultiDiGraph Engine</span>
        <span className="hidden sm:inline text-cyan-500/70">
          Press <kbd className="text-slate-400 font-bold px-1 bg-slate-900 border border-slate-800 rounded">Ctrl</kbd> + <kbd className="text-slate-400 font-bold px-1 bg-slate-900 border border-slate-800 rounded">K</kbd> for Global Spotlight
        </span>
        <span className="text-emerald-400/80">
          Case: {activeCase?.case_id || 'case-001'} (Lead Investigator)
        </span>
      </footer>

    </div>
  );
}
