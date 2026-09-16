import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  X, 
  User, 
  Car, 
  MapPin, 
  Phone, 
  Building2, 
  AlertOctagon, 
  ArrowUpRight, 
  Eye, 
  CornerDownLeft,
  Sparkles,
  Command,
  UploadCloud
} from 'lucide-react';

export default function CommandHUD({ 
  isOpen, 
  onClose, 
  graphData, 
  patterns, 
  onSelectEntity, 
  onNavigateToGraph,
  onOpenIngest
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Auto focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const nodes = graphData?.nodes || [];

  // Instant in-memory search across nodes and patterns
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const matches = [];

    // Prepend Quick Action: Insert Crime Data if query is empty or matches import terms
    if (onOpenIngest && (!q || 'insert import upload data ingest csv json case file'.includes(q) || q.includes('data') || q.includes('import') || q.includes('insert') || q.includes('upload'))) {
      matches.push({
        type: 'action',
        id: 'action_ingest',
        entityType: 'Action',
        name: '📥 + Insert / Import Case Data',
        subtitle: 'Upload CSV, JSON, surveillance text briefs, or load case presets',
        badge: 'QUICK ACTION',
        action: onOpenIngest,
      });
    }

    if (!q) {
      // Default: show key kingpins and critical patterns
      const entityDefaults = nodes.slice(0, 8).map(n => ({
        type: 'entity',
        id: n.id,
        entityType: n.type,
        name: n.name,
        subtitle: n.attributes?.role || n.attributes?.model || n.attributes?.category || n.type,
        badge: n.attributes?.threat_level || 'NORMAL',
        node: n,
      }));
      return [...matches, ...entityDefaults];
    }

    // Search nodes
    nodes.forEach(node => {
      const matchName = node.name?.toLowerCase().includes(q);
      const matchType = node.type?.toLowerCase().includes(q);
      const matchRole = node.attributes?.role?.toLowerCase().includes(q);
      const matchModel = node.attributes?.model?.toLowerCase().includes(q);
      const matchPhone = node.attributes?.phone?.toLowerCase().includes(q);
      const matchAlias = node.aliases?.some(a => a.toLowerCase().includes(q));

      if (matchName || matchType || matchRole || matchModel || matchPhone || matchAlias) {
        matches.push({
          type: 'entity',
          id: node.id,
          entityType: node.type,
          name: node.name,
          subtitle: node.attributes?.role || node.attributes?.model || node.attributes?.phone || node.type,
          badge: node.type,
          node,
        });
      }
    });

    // Search patterns
    (patterns || []).forEach((p, idx) => {
      if (p.pattern_type?.toLowerCase().includes(q) || p.evidence?.toLowerCase().includes(q)) {
        matches.push({
          type: 'pattern',
          id: `pat_${idx}`,
          entityType: 'Pattern',
          name: p.pattern_type.toUpperCase().replace('_', ' '),
          subtitle: p.evidence,
          badge: p.severity?.toUpperCase() || 'ALERT',
          pattern: p,
        });
      }
    });

    return matches.slice(0, 12);
  }, [nodes, patterns, query]);

  // Keyboard navigation: Arrows, Enter, Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (results.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % (results.length || 1));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleExecute(results[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const handleExecute = (item) => {
    if (item.type === 'action' && item.action) {
      item.action();
    } else if (item.type === 'entity') {
      onNavigateToGraph(item.id);
    } else if (item.pattern?.entities_involved?.[0]) {
      onNavigateToGraph(item.pattern.entities_involved[0]);
    }
    onClose();
  };

  if (!isOpen) return null;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Action': return <UploadCloud className="w-4 h-4 text-emerald-400" />;
      case 'Person': return <User className="w-4 h-4 text-cyan-400" />;
      case 'Vehicle': return <Car className="w-4 h-4 text-amber-400" />;
      case 'Location': return <MapPin className="w-4 h-4 text-emerald-400" />;
      case 'PhoneNumber': return <Phone className="w-4 h-4 text-purple-400" />;
      case 'Organization': return <Building2 className="w-4 h-4 text-teal-400" />;
      default: return <AlertOctagon className="w-4 h-4 text-rose-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      
      {/* Click backdrop to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh]">
        
        {/* Search Header Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-950/50">
          <Search className="w-5 h-5 text-cyan-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Spotlight search: Type name, plate, phone, shell org, or role..."
            className="w-full bg-transparent border-none text-slate-100 placeholder-slate-500 text-sm focus:outline-none"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 mr-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-400">
            <span>ESC</span>
          </kbd>
        </div>

        {/* Results Stream */}
        <div className="overflow-y-auto p-2 space-y-1 scrollbar-thin max-h-96">
          {results.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs">
              No entities or patterns matching "{query}"
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleExecute(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition ${
                    isSelected 
                      ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-indigo-500/20 border border-cyan-500/40 text-white shadow-md' 
                      : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 shrink-0">
                      {getTypeIcon(item.entityType)}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-100">{item.name}</span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="hidden sm:inline-flex items-center text-[10px] font-mono text-cyan-400 opacity-80">
                      <CornerDownLeft className="w-3 h-3 mr-1" /> Jump
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-cyan-400" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* HUD Footer Telemetry */}
        <div className="bg-slate-950/90 px-4 py-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center space-x-3">
            <span>Use <kbd className="text-slate-400 font-bold">↑↓</kbd> to navigate</span>
            <span><kbd className="text-slate-400 font-bold">ENTER</kbd> to focus 3D Orbit</span>
          </div>
          <span className="text-cyan-400 flex items-center space-x-1">
            <Sparkles className="w-3 h-3 mr-1" />
            <span>Sub-millisecond In-Memory Index</span>
          </span>
        </div>

      </div>

    </div>
  );
}