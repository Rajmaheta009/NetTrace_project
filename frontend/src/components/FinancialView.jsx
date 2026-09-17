import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Coins, 
  DollarSign, 
  Search, 
  ArrowUpRight, 
  ShieldAlert, 
  ExternalLink, 
  User, 
  FileText, 
  AlertTriangle,
  TrendingUp,
  Globe,
  Landmark,
  Layers
} from 'lucide-react';

export default function FinancialView({ 
  graphData, 
  patterns, 
  onInspectEntity, 
  onNavigateToGraph 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'HIGH_VALUE' | 'SHELL_ONLY'

  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];

  const getEndpointId = (ep) => (typeof ep === 'object' && ep !== null ? ep.id : ep);

  // Extract organizations (shell companies, conduits, trading fronts)
  const organizations = useMemo(() => {
    return nodes.filter(n => n.type === 'Organization').map(org => {
      // Related links
      const orgLinks = links.filter(l => getEndpointId(l.source) === org.id || getEndpointId(l.target) === org.id);
      
      const members = [];
      const locations = [];
      const evidence = [];

      orgLinks.forEach(link => {
        const sId = getEndpointId(link.source);
        const tId = getEndpointId(link.target);
        const otherId = sId === org.id ? tId : sId;
        const otherNode = nodes.find(n => n.id === otherId);
        if (otherNode) {
          if (otherNode.type === 'Person') members.push(otherNode);
          if (otherNode.type === 'Location') locations.push(otherNode);
        }
        if (link.evidence) evidence.push(...link.evidence);
      });

      return {
        ...org,
        members,
        locations,
        evidence: [...new Set(evidence)],
        jurisdiction: org.attributes?.jurisdiction || 'Offshore Jurisdiction',
        category: org.attributes?.category || 'Commercial Enterprise',
        degree: org.centrality?.degree || 0,
        betweenness: org.centrality?.betweenness || 0,
      };
    });
  }, [nodes, links]);

  // Derived Hawala and Money Laundering Transactions from actual Graph Links & Nodes
  const transactions = useMemo(() => {
    const list = [];
    let txCounter = 1;

    links.forEach((link) => {
      const sId = getEndpointId(link.source);
      const tId = getEndpointId(link.target);
      const srcNode = nodes.find(n => n.id === sId);
      const tgtNode = nodes.find(n => n.id === tId);
      if (!srcNode || !tgtNode) return;

      const relUpper = (link.relation_type || '').toUpperCase();
      const evidenceText = (link.evidence || []).join(' ');
      const isFinRel = ['TRANSFERRED', 'PAID', 'FUNDED', 'FINANCIAL', 'MEMBER_OF', 'HAWALA', 'INVESTED_IN', 'SETTLED'].includes(relUpper);
      const isOrgTransfer = srcNode.type === 'Organization' || tgtNode.type === 'Organization';
      const hasMoneySign = /(?:₹|Rs\.?|INR|\$|Cr|Crore|Lakh|hawala|settlement|payment|transfer|account)/i.test(evidenceText);

      if (isFinRel || isOrgTransfer || hasMoneySign) {
        // Extract amount if present in evidence or attributes
        const amountMatch = evidenceText.match(/(?:₹|Rs\.?|INR|\$)\s*[\d,.]+\s*(?:Cr|Crore|Lakh|k|M)?/i)
          || link.attributes?.amount;
        const amountStr = amountMatch ? (typeof amountMatch === 'string' ? amountMatch : amountMatch[0]) : (link.attributes?.amount || 'Documented Transfer');

        list.push({
          txId: link.event_id ? `TX-${link.event_id}` : `TX-FIN-${String(txCounter++).padStart(3, '0')}`,
          originator: srcNode.name || srcNode.id,
          originatorId: srcNode.id,
          beneficiary: tgtNode.name || tgtNode.id,
          beneficiaryId: tgtNode.id,
          conduit: (srcNode.type === 'Organization' ? srcNode.name : (tgtNode.type === 'Organization' ? tgtNode.name : 'Direct Channel')),
          conduitId: (srcNode.type === 'Organization' ? srcNode.id : tgtNode.id),
          amount: amountStr,
          channel: relUpper ? relUpper.replace(/_/g, ' ') : 'COMMERCIAL FLOW',
          risk: (srcNode.centrality?.betweenness > 0.3 || tgtNode.centrality?.betweenness > 0.3) ? 'CRITICAL' : 'EVALUATED',
          evidence: link.evidence?.[0] || 'Direct inter-entity transaction documented in case intelligence',
          timestamp: link.attributes?.timestamp || (link.event_id ? `Event: ${link.event_id}` : 'Case Intercept'),
          origNode: srcNode,
          benNode: tgtNode,
        });
      }
    });

    return list;
  }, [nodes, links]);

  const filteredOrgs = useMemo(() => {
    return organizations.filter(o => {
      const q = searchQuery.toLowerCase();
      const match = (o.name || '').toLowerCase().includes(q) ||
                    (o.category || '').toLowerCase().includes(q) ||
                    (o.jurisdiction || '').toLowerCase().includes(q) ||
                    (o.members || []).some(m => (m?.name || '').toLowerCase().includes(q));
      return match;
    });
  }, [organizations, searchQuery]);

  const filteredTx = useMemo(() => {
    return transactions.filter(t => {
      const q = searchQuery.toLowerCase();
      const match = t.txId.toLowerCase().includes(q) ||
                    t.originator.toLowerCase().includes(q) ||
                    t.beneficiary.toLowerCase().includes(q) ||
                    t.conduit.toLowerCase().includes(q) ||
                    t.channel.toLowerCase().includes(q) ||
                    (t.amount && t.amount.toLowerCase().includes(q));
      
      if (filterMode === 'HIGH_VALUE') return match && (t.amount.includes('Cr') || t.amount.includes('Lakh'));
      if (filterMode === 'SHELL_ONLY') return match && t.channel.toLowerCase().includes('member');
      return match;
    });
  }, [transactions, searchQuery, filterMode]);

  const primaryAxis = useMemo(() => {
    const jurisdictions = organizations.map(o => o.jurisdiction).filter(j => j && j !== 'Offshore Jurisdiction');
    if (!jurisdictions.length) return organizations.length ? 'Domestic Fleet' : 'None Registered';
    return [...new Set(jurisdictions)].slice(0, 2).join(' • ');
  }, [organizations]);

  const volumeDisplay = useMemo(() => {
    if (!transactions.length) return '₹ 0';
    const explicitAmounts = transactions.filter(t => t.amount.includes('₹') || t.amount.includes('Cr') || t.amount.includes('Lakh'));
    if (explicitAmounts.length > 0) {
      return explicitAmounts[0].amount;
    }
    return `${transactions.length} Active Trails`;
  }, [transactions]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Top Banner & KPI Telemetry */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{organizations.length}</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Shell Entities</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400">{volumeDisplay}</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Identified Volume</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-400">{transactions.length}</div>
            <div className="text-[11px] text-rose-300/80 font-medium uppercase tracking-wider">Laundering Trails</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-black text-cyan-300 truncate max-w-[140px]">{primaryAxis}</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Jurisdiction Axis</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search entity, transaction ID, conduit, channel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterMode === 'ALL'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
            }`}
          >
            All Transfers ({transactions.length})
          </button>
          <button
            onClick={() => setFilterMode('HIGH_VALUE')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterMode === 'HIGH_VALUE'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
            }`}
          >
            <Coins className="w-3 h-3 text-emerald-400" />
            <span>High Value (&gt;1 Cr)</span>
          </button>
          <button
            onClick={() => setFilterMode('SHELL_ONLY')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterMode === 'SHELL_ONLY'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
            }`}
          >
            <Landmark className="w-3 h-3 text-rose-400" />
            <span>Corporate Shell Layering</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Corporate Shell Cards (5 cols) & Hawala Ledger (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Shell Company Cards */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span>Corporate Shell Entities</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{filteredOrgs.length} Identified</span>
          </div>

          <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredOrgs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800">
                No shell companies registered in active intelligence file.
              </div>
            ) : (
              filteredOrgs.map((org) => (
                <div
                  key={org.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {org.category}
                      </span>
                      <h4 className="text-base font-black text-white mt-2 flex items-center space-x-2">
                        <span>{org.name}</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{org.jurisdiction}</p>
                    </div>

                    <button
                      onClick={() => onNavigateToGraph(org.id)}
                      title="Focus shell company in 3D Orbit"
                      className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition shadow-sm hover:scale-105"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Connected Signatories / Members */}
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center space-x-1 mb-1.5">
                      <User className="w-3 h-3 text-cyan-400" />
                      <span>Authorized Signatories & Beneficial Owners ({org.members.length})</span>
                    </span>

                    <div className="flex flex-wrap gap-1.5">
                      {org.members.map((person) => (
                        <button
                          key={person.id}
                          onClick={() => onInspectEntity(person.id)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-200 border border-slate-700/60 hover:border-cyan-500/40 text-xs transition"
                        >
                          <span>{person.name}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fleet or Warehouses */}
                  {org.attributes?.fleet_size && (
                    <div className="mt-3 text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="font-semibold text-slate-300">Registered Assets:</span>
                      <span className="font-mono text-cyan-400">{org.attributes.fleet_size}</span>
                    </div>
                  )}

                  {/* Evidence snippet */}
                  {org.evidence && org.evidence.length > 0 && (
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 italic">
                      "{org.evidence[0]}"
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Hawala & Money Laundering Transaction Ledger */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span>Hawala & Illicit Flow Ledger</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{filteredTx.length} Transactions</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] uppercase font-mono">
                  <tr>
                    <th className="py-3 px-4">Tx ID & Channel</th>
                    <th className="py-3 px-4">Originator</th>
                    <th className="py-3 px-4">Beneficiary</th>
                    <th className="py-3 px-4">Amount & Risk</th>
                    <th className="py-3 px-4 text-right">3D Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredTx.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                        No financial transactions or laundering trails recorded in active case data.
                      </td>
                    </tr>
                  ) : filteredTx.map((tx) => (
                    <tr key={tx.txId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-200 block">{tx.txId}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{tx.channel}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        {tx.origNode ? (
                          <button
                            onClick={() => onInspectEntity(tx.origNode.id)}
                            className="text-cyan-300 hover:text-cyan-100 font-bold block text-left"
                          >
                            {tx.originator}
                          </button>
                        ) : (
                          <span className="text-slate-300 font-bold block">{tx.originator}</span>
                        )}
                        <span className="text-[10px] text-slate-500">{tx.timestamp.split(' ')[0]}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        {tx.benNode ? (
                          <button
                            onClick={() => onInspectEntity(tx.benNode.id)}
                            className="text-amber-300 hover:text-amber-100 font-bold block text-left"
                          >
                            {tx.beneficiary}
                          </button>
                        ) : (
                          <span className="text-slate-300 font-bold block">{tx.beneficiary}</span>
                        )}
                        <span className="text-[10px] text-slate-500 truncate max-w-[130px] block">{tx.conduit}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-emerald-300 text-xs block">
                          {tx.amount}
                        </span>
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold uppercase font-mono ${
                          tx.risk === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {tx.risk}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            if (tx.origNode) onNavigateToGraph(tx.origNode.id);
                            else if (tx.benNode) onNavigateToGraph(tx.benNode.id);
                          }}
                          title="Trace transaction path in 3D Orbit"
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold inline-flex items-center space-x-1 transition"
                        >
                          <span>Orbit</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-950/60 p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Landmark className="w-3.5 h-3.5 text-amber-400" />
                <span>Enforcement Directorate & Financial Intelligence Unit (FIU-IND) Hawala Pattern Tracking</span>
              </span>
              <span className="font-mono text-slate-500">FATF Rec. 16 Compliant</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}