// Entity Type visual themes and color definitions
export const ENTITY_COLORS = {
  Person: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-400',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    fill: '#6366f1',
    label: 'Person / Suspect',
    icon: 'User',
  },
  Location: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    fill: '#10b981',
    label: 'Location / Safehouse',
    icon: 'MapPin',
  },
  Vehicle: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    fill: '#f59e0b',
    label: 'Vehicle / Transport',
    icon: 'Car',
  },
  PhoneNumber: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    fill: '#a855f7',
    label: 'Phone / Device',
    icon: 'Phone',
  },
  Organization: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    fill: '#06b6d4',
    label: 'Organization / Syndicate',
    icon: 'Building2',
  },
};

export const RELATION_LABELS = {
  KNOWS: { label: 'Knows / Associate', color: '#60a5fa' },
  CALLED: { label: 'Called / Telecom', color: '#c084fc' },
  MET_AT: { label: 'Met At / Physical Meeting', color: '#34d399' },
  OWNS_VEHICLE: { label: 'Owns / Registered', color: '#fbbf24' },
  MEMBER_OF: { label: 'Member Of', color: '#38bdf8' },
  LOCATED_AT: { label: 'Located At', color: '#4ade80' },
  ASSOCIATED_WITH: { label: 'Associated With', color: '#94a3b8' },
};

export function getEntityColor(type) {
  return ENTITY_COLORS[type] || {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    fill: '#64748b',
    label: type || 'Entity',
    icon: 'Circle',
  };
}
