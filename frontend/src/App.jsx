import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import CommandHUD from './components/CommandHUD';
import GraphView from './components/GraphView';
import EntityDrawer from './components/EntityDrawer';
import DeepEntityInspection from './components/DeepEntityInspection';
import { CaseSwitcherModal } from './components/CaseRoleModals';
import HistoryRecordsModal from './components/HistoryRecordsModal';

// Core & Forensic Views
import DashboardOverview from './components/DashboardOverview';
import CasesView from './components/CasesView';
import EvidenceView from './components/EvidenceView';
import ValidationCenter from './components/ValidationCenter';
import CommunitiesView from './components/CommunitiesView';
import ConnectionFinderView from './components/ConnectionFinderView';
import NotesView from './components/NotesView';
import ReportsView from './components/ReportsView';
import AuditView from './components/AuditView';

// Vector Views
import VehiclesView from './components/VehiclesView';
import TelecomView from './components/TelecomView';
import FinancialView from './components/FinancialView';
import LocationsView from './components/LocationsView';
import TimelineView from './components/TimelineView';
import CentralityTable from './components/CentralityTable';
import PatternsRadar from './components/PatternsRadar';
import SummaryView from './components/SummaryView';
import IngestPanel from './components/IngestPanel';

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

  // Load all investigation data for the active case
  const loadAllData = useCallback(async () => {
    try {
      const [h, g, c, p, activeC, curUser, ev, val, comms, nts, cProfiles] = await Promise.all([
        checkHealth().catch(() => null),
        fetchGraph().catch(() => ({ nodes: [], links: [] })),
        fetchCentrality().catch(() => []),
        fetchPatterns().catch(() => []),
        fetchActiveCase().catch(() => null),
        fetchCurrentUser().catch(() => null),
        fetchEvidence().catch(() => []),
        fetchValidationRecords().catch(() => []),
        fetchCommunities().catch(() => []),
        fetchNotes().catch(() => []),
        fetchCrimeProfiles().catch(() => []),
      ]);
      setHealth(h);
      setGraphData(g);
      setCentralityList(c);
      setPatternFlags(p);
      if (activeC) setActiveCase(activeC);
      if (curUser) setCurrentUser(curUser);
      setEvidenceList(ev);
      setValidationQueue(val);
      setCommunities(comms);
      setNotesList(nts);
      if (cProfiles && cProfiles.length) setCrimeProfiles(cProfiles);
    } catch (err) {
      console.error('Failed to load initial investigation data:', err);
    }
  }, []);

  // Initial mount & telemetry polling
  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      checkHealth().then(setHealth).catch(() => null);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadAllData]);

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
    await loadAllData();
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
  const vehicleCount = useMemo(() => graphData.nodes?.filter(n => n.type === 'Vehicle').length || 0, [graphData]);
  const telecomCount = useMemo(() => {
    const direct = graphData.nodes?.filter(n => n.type === 'PhoneNumber').length || 0;
    const fromPersons = graphData.nodes?.filter(n => n.type === 'Person' && n.attributes?.phone).length || 0;
    return direct > 0 ? direct : fromPersons;
  }, [graphData]);
  const financialCount = useMemo(() => graphData.nodes?.filter(n => n.type === 'Organization').length || 0, [graphData]);
  const locationCount = useMemo(() => graphData.nodes?.filter(n => n.type === 'Location').length || 0, [graphData]);
  const pendingValidationCount = useMemo(() => validationQueue.filter(v => v.status === 'Needs Review').length, [validationQueue]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col antialiased transition-colors duration-300">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        stats={{ nodes: graphData.nodes?.length || 0, edges: graphData.links?.length || 0 }}
        vehicleCount={vehicleCount}
        telecomCount={telecomCount}
        financialCount={financialCount}
        locationCount={locationCount}
        patternCount={patternFlags.length}
        onReset={handleReset}
        onLoadDemo={handleLoadDemo}
        loading={loading}
        theme={theme}
        setTheme={setTheme}
        onOpenCommandHUD={() => setIsCommandOpen(true)}
        activeCase={activeCase}
        currentUser={currentUser}
        onOpenCaseModal={() => setIsCaseModalOpen(true)}
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
          onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
          onOpenCaseModal={() => setIsCaseModalOpen(true)}
          validationCount={pendingValidationCount}
          evidenceCount={evidenceList.length}
          patternCount={patternFlags.length}
          notesCount={notesList.length}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />

        {/* Viewport Main Container */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <div className="max-w-7xl mx-auto">
            
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

          </div>
        </main>

      </div>

      {/* Spotlight Command HUD (Ctrl+K) */}
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

      {/* Full-Spectrum Deep Entity Inspection Modal */}
      {deepInspectEntityId && (
        <DeepEntityInspection
          caseId={activeCase?.case_id || 'case-001'}
          entityId={deepInspectEntityId}
          onClose={() => setDeepInspectEntityId(null)}
          allEntities={graphData.nodes || []}
          onHighlightCommunity={handleHighlightCommunityInGraph}
          onHighlightPath={handleHighlightPathInGraph}
          onSelectEntity={handleSelectEntity}
        />
      )}

      {/* Forensic Entity Inspector Side Drawer */}
      <EntityDrawer
        isOpen={isDrawerOpen}
        entityDetail={entityDetail}
        loading={drawerLoading}
        onClose={() => setIsDrawerOpen(false)}
        onSelectNeighbor={handleSelectEntity}
        onOpenVehiclesTab={() => setActiveTab('vehicles')}
      />

      {/* Case Switcher Modal */}
      <CaseSwitcherModal
        isOpen={isCaseModalOpen}
        onClose={() => setIsCaseModalOpen(false)}
        activeCase={activeCase}
        onCaseSwitched={handleCaseSwitched}
      />

      {/* Investigation History & Previous Records Modal */}
      <HistoryRecordsModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onInspectEntity={handleOpenDeepInspect}
        onNavigate={(tab) => {
          setActiveTab(tab);
          setIsHistoryModalOpen(false);
        }}
      />

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
