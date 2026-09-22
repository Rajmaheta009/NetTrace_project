import React from 'react';
import { Loader2, Shield } from 'lucide-react';

export default function ViewLoadingSkeleton({ message = 'Loading Forensic Module...' }) {
  return (
    <div className="w-full min-h-[420px] flex flex-col items-center justify-center p-8 space-y-6 animate-in fade-in duration-200">
      <div className="relative flex items-center justify-center">
        {/* Ambient Glow */}
        <div className="absolute w-24 h-24 bg-cyan-500/10 rounded-full blur-xl animate-pulse" />
        
        {/* Outer Rotating Radar Ring */}
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-cyan-500/40 animate-[spin_4s_linear_infinite]" />
        
        {/* Inner Counter-Rotating Ring */}
        <div className="absolute w-10 h-10 rounded-full border-2 border-t-cyan-400 border-r-transparent border-b-blue-500 border-l-transparent animate-[spin_1.5s_linear_infinite]" />
        
        {/* Center Shield Icon */}
        <Shield className="absolute w-5 h-5 text-cyan-400" />
      </div>

      <div className="text-center space-y-1.5">
        <p className="text-xs font-bold font-mono tracking-widest uppercase text-cyan-300">
          {message}
        </p>
        <p className="text-[11px] text-slate-500 font-mono">
          NetTrace Intelligence • Decoupled Module Loading
        </p>
      </div>

      {/* Shimmer Placeholder Grid */}
      <div className="w-full max-w-2xl grid grid-cols-3 gap-3 pt-2 opacity-40 pointer-events-none">
        <div className="h-16 rounded-2xl bg-slate-800/40 border border-slate-800 animate-pulse" />
        <div className="h-16 rounded-2xl bg-slate-800/40 border border-slate-800 animate-pulse delay-75" />
        <div className="h-16 rounded-2xl bg-slate-800/40 border border-slate-800 animate-pulse delay-150" />
      </div>
    </div>
  );
}
