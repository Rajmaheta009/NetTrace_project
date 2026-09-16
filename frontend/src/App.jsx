import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from './components/Navbar';
import LiveTicker from './components/LiveTicker';
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

  // Handle Entity selection
  const handleSelectEntity = async (entityId) => {
    setSelectedEntityId(entityId);
    setDrawerLoading(true);
    try {
      const detail = await fetchEntityDetail(entityId);
      setEntityDetail(detail);
    } catch (err) {
      console.error('Error fetching entity detail:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Cross-Tab Redirection to 3D Graph
  const handleNavigateToGraph = (entityId) => {
    setActiveTab('graph');
    handleSelectEntity(entityId);
  };

  // Reset graph: clear all memory data and empty diagram completely
  const handleReset = async () => {
    setLoading(true);
    try {
      await clearGraph();
      setSelectedEntityId(null);
      setEntityDetail(null);
      setGraphData({ nodes: [], links: [] });
      setCentralityList([]);
      setPatternFlags([]);
      setSummaryData({
        summary: "All graph memory data cleared. The diagram is currently empty. Insert new case data or load a demo to begin analysis.",
        entities_to_watch: []
      });
      await loadAllData();
    } catch (err) {
      alert('Reset failed: ' + err.message);
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
      alert('Failed to load demo: ' + err.message);
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
      
      {/* Live Tactical Surveillance Intercept Stream Ticker */}
      <LiveTicker />

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
        entityDetail={entityDetail}
        loading={drawerLoading}
        onClose={() => {
          setSelectedEntityId(null);
          setEntityDetail(null);
        }}
        onSelectNeighbor={handleSelectEntity}
        onOpenVehiclesTab={() => setActiveTab('vehicles')}
      />

      {/* Tactical Footer */}
      <footer className="border-t border-slate-800/60 py-3 px-6 text-center text-[11px] text-slate-500 font-mono flex items-center justify-between">
        <span>NetTrace AI v2.0 • Multi-Vector Crime Analytics & Signal Intelligence</span>
        <span className="hidden sm:inline text-cyan-500/70">Press <kbd className="text-slate-400 font-bold px-1 bg-slate-900 border border-slate-800 rounded">Ctrl</kbd> + <kbd className="text-slate-400 font-bold px-1 bg-slate-900 border border-slate-800 rounded">K</kbd> for Global Spotlight</span>
        <span className="text-emerald-400/80">Deterministic Engine Active</span>
      </footer>

    </div>
  );
}