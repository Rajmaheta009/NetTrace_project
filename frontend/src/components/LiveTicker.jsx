import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Play, 
  Pause, 
  ShieldAlert, 
  ChevronRight, 
  Zap, 
  Car, 
  Phone, 
  MapPin, 
  Coins 
} from 'lucide-react';

const SURVEILLANCE_EVENTS = [
  { id: 'ev_1', type: 'CAR', icon: Car, text: 'Toll Gate 04: Black Fortuner MH-01-CZ-9999 passed Bandra Sea Link northbound (Speed: 74 km/h)', time: 'Just now' },
  { id: 'ev_2', type: 'PHONE', icon: Phone, text: 'CDR Intercept: Burner line +91-9876543210 initiated 3m 42s call via Bandra West BTS-09', time: '1m ago' },
  { id: 'ev_3', type: 'FINANCE', icon: Coins, text: 'Hawala Chit Alert: ₹15 Cr offshore settlement recorded via Al-Zahra Global Trading LLC', time: '2m ago' },
  { id: 'ev_4', type: 'LOC', icon: MapPin, text: 'Dock 14 Security: Suspect Sanjay Patel biometric scan logged during container unloading', time: '3m ago' },
  { id: 'ev_5', type: 'PHONE', icon: Phone, text: 'Wiretap Trigger: Encrypted VoIP ping intercepted between Mumbai and Dubai (+971-50-1122334)', time: '4m ago' },
  { id: 'ev_6', type: 'CAR', icon: Car, text: 'ANPR Hit: Grey Scorpio MH-04-AB-1234 sighted parked outside Cafe Coastal Marine Drive', time: '5m ago' },
];

export default function LiveTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % SURVEILLANCE_EVENTS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const currentEvent = SURVEILLANCE_EVENTS[currentIndex];
  const Icon = currentEvent.icon;

  return (
    <div className="bg-slate-950 border-b border-cyan-950/60 px-3 sm:px-6 py-1.5 flex items-center justify-between text-xs overflow-hidden shadow-inner">
      
      {/* Left Badge: Live Status */}
      <div className="flex items-center space-x-2 shrink-0 mr-3">
        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-bold font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
          <span>LIVE INTERCEPT FEED</span>
        </div>
        
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-1 rounded text-slate-500 hover:text-slate-300 transition"
          title={isPlaying ? 'Pause live stream' : 'Resume live stream'}
        >
          {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </button>
      </div>

      {/* Middle Animated Event Snippet */}
      <div className="flex-1 truncate flex items-center space-x-2 text-slate-300 font-mono text-[11px]">
        <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="text-slate-400">[{currentEvent.time}]</span>
        <span className="truncate text-slate-200 font-medium">{currentEvent.text}</span>
      </div>

      {/* Right Controls / Step */}
      <div className="hidden md:flex items-center space-x-2 shrink-0 ml-3">
        <span className="text-[10px] font-mono text-slate-500">
          {currentIndex + 1} / {SURVEILLANCE_EVENTS.length}
        </span>
        <button
          onClick={() => setCurrentIndex((currentIndex + 1) % SURVEILLANCE_EVENTS.length)}
          className="p-1 rounded text-slate-400 hover:text-cyan-300 transition"
          title="Next surveillance alert"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
}