import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ChevronDown, 
  Target, 
  Check, 
  Layers, 
  Sparkles,
  Search,
  Activity
} from 'lucide-react';

export default function CrimeTypeSelector({
  profiles = [],
  activeProfileId = 'organized_crime',
  onSelectProfile,
  disabled = false,
  variant = 'compact' // 'compact' | 'full' | 'dropdown'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || {
    id: 'organized_crime',
    name: 'Organized Crime Network',
    description: 'Hierarchical syndicates and multi-enterprise underworld cartels.'
  };

  const filteredProfiles = profiles.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase()) ||
    (p.important_entity_types && p.important_entity_types.some(e => e.toLowerCase().includes(search.toLowerCase())))
  );

  const handleSelect = (profileId) => {
    if (disabled) return;
    onSelectProfile(profileId);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={`relative inline-block text-left font-sans ${isOpen ? 'z-50' : 'z-20'}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-2xl border transition-all cursor-pointer ${
          isOpen
            ? 'bg-rose-500/20 border-rose-500/50 text-white shadow-lg shadow-rose-950/40'
            : 'bg-slate-950/90 hover:bg-slate-900 border-slate-800 hover:border-rose-500/40 text-slate-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Switch active crime investigation profile (re-weights analytics & questions without altering graph)"
      >
        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold hidden sm:inline">Profile:</span>
        <span className="text-xs font-black text-rose-300 truncate max-w-[150px] sm:max-w-[190px]">
          {activeProfile.name}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-rose-400' : ''}`} />
      </button>

      {/* Dropdown Modal / Popover */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute left-0 mt-2 w-80 sm:w-96 max-h-[460px] bg-slate-950/98 backdrop-blur-2xl border border-rose-500/40 rounded-3xl p-3.5 shadow-2xl shadow-black/90 z-50 flex flex-col space-y-2 animate-in fade-in zoom-in-95">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-black text-white font-mono uppercase tracking-wider">
                  Investigation Profiles (11)
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Select Profile</span>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search crime profiles or vectors..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/50 font-mono"
              />
            </div>

            {/* Profile Options List */}
            <div className="flex-1 overflow-y-auto max-h-72 space-y-1.5 pr-1 scrollbar-thin">
              {filteredProfiles.map((p) => {
                const isSelected = p.id === activeProfileId;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p.id)}
                    className={`p-2.5 rounded-2xl border transition cursor-pointer flex flex-col space-y-1 ${
                      isSelected
                        ? 'bg-rose-500/15 border-rose-500/50 shadow-md shadow-rose-950/40'
                        : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white flex items-center space-x-1.5">
                        <span>{p.name}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-mono font-bold">
                            ACTIVE
                          </span>
                        )}
                      </span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono hover:text-rose-300">
                          Switch →
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>

                    {/* Vector Tags */}
                    {p.important_entity_types && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {p.important_entity_types.slice(0, 4).map((t, idx) => (
                          <span 
                            key={idx} 
                            className="px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-[9px] font-mono text-slate-400"
                          >
                            {t}
                          </span>
                        ))}
                        {p.important_entity_types.length > 4 && (
                          <span className="text-[9px] font-mono text-slate-500">
                            +{p.important_entity_types.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Explanatory Footer */}
            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>All 11 profiles share the same graph</span>
              <span className="text-rose-400">Zero Data Loss</span>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
