import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from './components/Navbar';
import CommandHUD from './components/CommandHUD';
import GraphView from './components/GraphView';
import EntityDrawer from './components/EntityDrawer';
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
  loadDemoGraph
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('graph');
  const [theme, setTheme] = useState('midnight'); // 'midnight' | 'dark' | 'light'
  
  const [health, setHealth] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [centralityList, setCentralityList] = useState([]);
  const [patternFlags, setPatternFlags] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [entityDetail, setEntityDetail] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  // Apply Theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('midnight', 'dark', 'light');
    root.classList.add(theme);
  }, [theme]);

  // Global Keyboard Shortcut: Ctrl+K or Cmd+K for Spotlight Search
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

  // Load all graph intelligence data
  const loadAllData = useCallback(async () => {
    try {
      const [h, g, c, p] = await Promise.all([
        checkHealth().catch(() => null),
        fetchGraph().catch(() => ({ nodes: [], links: [] })),
        fetchCentrality().catch(() => []),
        fetchPatterns().catch(() => []),
      ]);
      setHealth(h);
      setGraphData(g);
      setCentralityList(c);
      setPatternFlags(p);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }, []);

  // Initial mount & polling
  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      checkHealth().then(setHealth).catch(() => null);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadAllData]);

  // Handle Entity selection & forensic side drawer opening
  const handleSelectEntity = async (entityId, shouldOpenDrawer = true) => {
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
      setEntityDetail(detail);
    } catch (err) {
      console.warn('Backend entity detail fetch failed, using resilient local graph fallback:', err);
      // Resilient Fallback: construct full entity dossier directly from client graphData
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
      setDrawerLoading(false);
    }
  };

  // Explicitly Open Forensic Dossier Side Drawer for Target Node
  const handleOpenDrawer = (entityId) => {
    const targetId = entityId || selectedEntityId;
    if (targetId) {
      handleSelectEntity(targetId, true);
    }
  };

  // Cross-Tab Redirection to 3D Graph
  const handleNavigateToGraph = (entityId) => {
    setActiveTab('graph');
    handleSelectEntity(entityId, true);
  };

  // Reset graph: clear all memory data and empty diagram completely
  const handleReset = async () => {
    // 1. Immediately wipe local UI state so the diagram empties with zero delay
    setSelectedEntityId(null);
    setEntityDetail(null);
    setIsDrawerOpen(false);
    setEntityDetail(null);
    setGraphData({ nodes: [], links: [] });
    setCentralityList([]);
    setPatternFlags([]);
    setSummaryData({
      summary: "All graph memory data cleared. The diagram is currently empty. Insert new case data or load a demo to begin analysis.",
      entities_to_watch: []
    });

    // 2. Synchronize with backend quietly in background without any blocking alert pop-up
    setLoading(true);
    try {
      await clearGraph();
    } catch (err) {
      console.warn('Backend graph clear warning (offline or unreachable):', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load sample demo case
  const handleLoadDemo = async () => {
    setLoading(true);
    try {
      await loadDemoGraph();
      await loadAllData();
      loadSummary();
    } catch (err) {
      console.warn('Backend demo load failed (offline or unreachable):', err.message);
      // Graceful offline fallback: load built-in sample demo nodes directly into state
      setGraphData({
        nodes: [
          { id: 'e1', type: 'Person', name: 'Rakesh Verma', aliases: ['The Broker'], attributes: { phone: '+91-9876543210' }, centrality: { degree: 1.0, betweenness: 0.9 }, source_refs: ['sample'] },
          { id: 'e2', type: 'Person', name: 'Sanjay Patel', aliases: [], attributes: { phone: '+91-9123456789' }, centrality: { degree: 0.8, betweenness: 0.3 }, source_refs: ['sample'] },
          { id: 'e3', type: 'Vehicle', name: 'MH-04-AB-1234', aliases: [], attributes: { plate: 'MH-04-AB-1234' }, centrality: { degree: 0.4, betweenness: 0.0 }, source_refs: ['sample'] },
          { id: 'e4', type: 'Location', name: 'Cafe Coastal Mumbai', aliases: [], attributes: { city: 'Mumbai' }, centrality: { degree: 0.6, betweenness: 0.1 }, source_refs: ['sample'] },
          { id: 'e5', type: 'Person', name: 'Anita Rao', aliases: [], attributes: {}, centrality: { degree: 0.4, betweenness: 0.0 }, source_refs: ['sample'] },
          { id: 'e6', type: 'Organization', name: 'Coastal Traders Pvt Ltd', aliases: [], attributes: {}, centrality: { degree: 0.4, betweenness: 0.0 }, source_refs: ['sample'] }
        ],
        links: [
          { source: 'e1', target: 'e2', relation_type: 'KNOWS', weight: 1, evidence: ['Wiretap log'] },
          { source: 'e1', target: 'e3', relation_type: 'OWNS_VEHICLE', weight: 1, evidence: ['RTO registration'] },
          { source: 'e1', target: 'e4', relation_type: 'MET_AT', weight: 1, evidence: ['Surveillance log'] },
          { source: 'e2', target: 'e4', relation_type: 'MET_AT', weight: 1, evidence: ['Surveillance log'] },
          { source: 'e5', target: 'e6', relation_type: 'MEMBER_OF', weight: 1, evidence: ['Corporate registry'] },
          { source: 'e1', target: 'e5', relation_type: 'KNOWS', weight: 1, evidence: ['Call logs'] }
        ]
      });
      setCentralityList([
        { id: 'e1', name: 'Rakesh Verma', degree: 1.0, betweenness: 0.9 },
        { id: 'e2', name: 'Sanjay Patel', degree: 0.8, betweenness: 0.3 },
        { id: 'e4', name: 'Cafe Coastal Mumbai', degree: 0.6, betweenness: 0.1 },
        { id: 'e3', name: 'MH-04-AB-1234', degree: 0.4, betweenness: 0.0 },
        { id: 'e5', name: 'Anita Rao', degree: 0.4, betweenness: 0.0 },
        { id: 'e6', name: 'Coastal Traders Pvt Ltd', degree: 0.4, betweenness: 0.0 }
      ]);
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

  // Derived Category Counts for Navigation Badges
  const vehicleCount = useMemo(() => {
    return graphData.nodes?.filter(n => n.type === 'Vehicle').length || 0;
  }, [graphData]);

  const telecomCount = useMemo(() => {
    const direct = graphData.nodes?.filter(n => n.type === 'PhoneNumber').length || 0;
    const fromPersons = graphData.nodes?.filter(n => n.type === 'Person' && n.attributes?.phone).length || 0;
    return direct > 0 ? direct : fromPersons;
  }, [graphData]);

  const financialCount = useMemo(() => {
    return graphData.nodes?.filter(n => n.type === 'Organization').length || 0;
  }, [graphData]);

  const locationCount = useMemo(() => {
    return graphData.nodes?.filter(n => n.type === 'Location').length || 0;
  }, [graphData]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col antialiased transition-colors duration-300">
      
      {/* Top Header & Navigation */}
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
      />

      {/* Main Content Area - Non-overlapping responsive layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6">
        {activeTab === 'graph' && (
          <GraphView
            graphData={graphData}
            selectedEntityId={selectedEntityId}
            onSelectEntity={handleSelectEntity}
            isDrawerOpen={isDrawerOpen}
            onOpenDrawer={handleOpenDrawer}
            onRefresh={loadAllData}
            onOpenIngest={() => setActiveTab('ingest')}
            onLoadDemo={handleLoadDemo}
            theme={theme}
          />
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
      </main>

      {/* Spotlight Command HUD Search Palette (Ctrl+K) */}
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

      {/* Entity Inspector Side Drawer with Non-Overlapping Dismiss */}
      <EntityDrawer
        isOpen={isDrawerOpen}
        entityDetail={entityDetail}
        loading={drawerLoading}
        onClose={() => setIsDrawerOpen(false)}
        onSelectNeighbor={handleSelectEntity}
        onOpenVehiclesTab={() => setActiveTab('vehicles')}
      />

      {/* Tactical Footer */}
      <footer className="border-t border-slate-800/60 py-3 px-6 text-center text-[11px] text-slate-500 font-mono flex items-center justify-between">
        <span>NetTrace AI v2.0 • Multi-Vector AI-Powered Criminal Network Analysis</span>
        <span className="hidden sm:inline text-cyan-500/70">Press <kbd className="text-slate-400 font-bold px-1 bg-slate-900 border border-slate-800 rounded">Ctrl</kbd> + <kbd className="text-slate-400 font-bold px-1 bg-slate-900 border border-slate-800 rounded">K</kbd> for Global Spotlight</span>
        <span className="text-emerald-400/80">Deterministic Engine Active</span>
      </footer>

    </div>
  );
}