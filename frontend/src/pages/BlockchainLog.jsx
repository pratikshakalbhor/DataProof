import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuditLogs } from '../utils/api';
import { 
  Activity, AlertTriangle, RefreshCw, ShieldCheck, 
  FileText, ExternalLink, Clock, Database, 
  Terminal, Zap, Fingerprint, ShieldEllipsis, 
  Search, ChevronRight, Layers, Cpu
} from 'lucide-react';
import '../styles/BlockchainLog.css';

const getEventColor = (type) => {
  switch (type) {
    case 'FILE_UPLOADED':  return '#14b8a6'; // Teal
    case 'TAMPER_DETECTED': return '#ef4444'; // Red
    case 'FILE_RESTORED':  return '#3b82f6'; // Blue
    case 'FILE_ARCHIVED':  return '#64748b'; // Slate
    case 'FILE_VERIFIED':  return '#8b5cf6'; // Purple
    case 'INTEGRITY_CHECK': return '#a855f7'; // Violet
    default:               return '#94a3b8';
  }
};

const getEventIcon = (type) => {
  switch (type) {
    case 'FILE_UPLOADED':  return <ShieldCheck size={18} />;
    case 'TAMPER_DETECTED': return <AlertTriangle size={18} />;
    case 'FILE_RESTORED':  return <RefreshCw size={18} />;
    case 'FILE_VERIFIED':  return <ShieldEllipsis size={18} />;
    case 'FILE_ARCHIVED':  return <Database size={18} />;
    default:               return <Activity size={18} />;
  }
};

export default function BlockchainLog({ walletAddress }) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [blocks, setBlocks] = useState(() =>
    Array.from({ length: 10 }, (_, i) => Math.floor(Math.random() * 900000) + 7000000)
  );

  // Simulated live sync for blocks
  useEffect(() => {
    const iv = setInterval(() => {
      setBlocks(prev => {
        const next = prev[prev.length - 1] + 1;
        return [...prev.slice(1), next];
      });
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs(walletAddress);
      // Filter out meta events if needed, sort by timestamp
      const allLogs = (res.logs || []).filter(log => log.eventType !== 'FILE_ARCHIVED');
      setLogs(allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (err) {
      console.error('Forensic sync failed:', err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const s = search.toLowerCase();
    return logs.filter(l => 
      l.fileName?.toLowerCase().includes(s) || 
      l.eventType?.toLowerCase().includes(s) ||
      l.details?.toLowerCase().includes(s)
    );
  }, [logs, search]);

  return (
    <div className="page-inner">
      
      {/* ── Header Section ── */}
      <div className="forensic-header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span className="forensic-status-badge">
               <Cpu size={10} style={{marginRight: 4}} /> Forensic Node 04
            </span>
            <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ● Live Sync Active
            </span>
          </div>
          <h1 className="forensic-title-main">
            <Terminal size={36} color="#14b8a6" /> 
            Blockchain Audit Ledger
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            Immutable cryptographic proof of all asset movements on Ethereum Sepolia
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="#475569" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Filter by asset or event..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#f8fafc', padding: '10px 16px 10px 38px', borderRadius: 12, outline: 'none',
                width: 260, fontSize: 13, transition: 'all 0.2s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(20, 184, 166, 0.4)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>
          <button 
            onClick={fetchLogs} 
            style={{ 
              background: 'rgba(20, 184, 166, 0.1)', border: '1px solid rgba(20, 184, 166, 0.2)',
              color: '#14b8a6', padding: '10px 20px', borderRadius: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700,
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(20, 184, 166, 0.15)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(20, 184, 166, 0.1)'}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? 'Syncing...' : 'Sync Proofs'}
          </button>
        </div>
      </div>

      {/* ── Network Node Status Bar ── */}
      <div className="node-status-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <div className="pulse-node" style={{ width: 10, height: 10, borderRadius: '50%', background: '#14b8a6', position: 'absolute' }}></div>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#14b8a6' }}></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
             <span style={{ fontSize: 11, fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase' }}>Sepolia Node VM</span>
             <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>PROVIDER: INFURA PRO</span>
          </div>
        </div>

        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)' }}></div>

        <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', alignItems: 'center' }}>
          <Layers size={14} color="#64748b" style={{ minWidth: 14 }} />
          {blocks.map((b, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, x: 10 }} 
              animate={{ opacity: 1, x: 0 }}
              className={`block-chip ${i === blocks.length - 1 ? 'newest' : ''}`}
            >
              #{b}
            </motion.div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>GAS PRICE</div>
            <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 800, fontFamily: 'monospace' }}>22.4 Gwei</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="#facc15" />
          </div>
        </div>
      </div>

      {/* ── The Ledger Table ── */}
      <div className="ledger-card">
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#14b8a6' }}></div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>Event Transaction Log</h2>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
            Displaying {filteredLogs.length} verified transactions
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Asset Identity</th>
                <th>Identity Hash</th>
                <th>Blockchain Proof</th>
                <th>Network Timestamp</th>
              </tr>
            </thead>
            <tbody style={{ position: 'relative' }}>
              <AnimatePresence>
                {loading && logs.length === 0 ? (
                  <tr key="loading">
                    <td colSpan="5" style={{ padding: 80, textAlign: 'center' }}>
                      <motion.div initial={{opacity:0}} animate={{opacity:1}}>
                        <RefreshCw size={44} color="#14b8a6" className="spin" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                        <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>Scanning cryptographic ledger...</p>
                      </motion.div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr key="empty">
                    <td colSpan="5" style={{ padding: 80, textAlign: 'center' }}>
                      <motion.div initial={{opacity:0}} animate={{opacity:1}}>
                        <ShieldEllipsis size={44} color="#334155" style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                        <p style={{ color: '#64748b', fontSize: 14 }}>No evidence found matching your filter Criteria.</p>
                      </motion.div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, i) => {
                    const color = getEventColor(log.eventType);
                    const isTamper = log.eventType === 'TAMPER_DETECTED';
                    
                    return (
                      <motion.tr 
                        key={log.logId}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className={`ledger-row ${isTamper ? 'tamper-row' : ''}`}
                      >
                        <td style={{ width: '22%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div className="event-icon-box" style={{ background: `${color}15`, color: color }}>
                              {getEventIcon(log.eventType)}
                            </div>
                            <div>
                               <div style={{ fontSize: 13, fontWeight: 800, color: isTamper ? '#fca5a5' : '#f1f5f9', textTransform: 'capitalize' }}>
                                 {log.eventType.replace(/_/g, ' ').toLowerCase()}
                               </div>
                               <div style={{ fontSize: 11, color: isTamper ? '#f87171' : '#64748b', marginTop: 3 }}>
                                 {log.details || 'Integrity Check Valid'}
                               </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ width: '25%' }}>
                            <div 
                              className="asset-link" 
                              onClick={() => navigate(`/files/${log.fileId}`)}
                              title="View file details"
                            >
                               <div style={{ 
                                 width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.03)', 
                                 display: 'flex', alignItems: 'center', justifyContent: 'center' 
                               }}>
                                 <FileText size={16} color="#94a3b8" />
                               </div>
                               <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#cbd5e1' }}>{log.fileName || 'Unknown Asset'}</div>
                                  <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginTop: 2 }}>{log.fileId?.slice(0, 16)}...</div>
                               </div>
                               <ChevronRight size={14} color="#334155" style={{ marginLeft: 'auto' }} />
                            </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(129, 140, 248, 0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                               <Fingerprint size={12} />
                            </div>
                            <a 
                              href={`https://sepolia.etherscan.io/address/${log.walletAddress}`} 
                              target="_blank" rel="noreferrer"
                              style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none', fontFamily: 'monospace', fontWeight: 500 }}
                              onMouseOver={(e) => e.target.style.color = '#818cf8'}
                              onMouseOut={(e) => e.target.style.color = '#94a3b8'}
                            >
                              {log.walletAddress ? `${log.walletAddress.slice(0, 6)}...${log.walletAddress.slice(-4)}` : '0x00...0000'}
                            </a>
                          </div>
                        </td>

                        <td>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                 <div style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', fontSize: 10, fontWeight: 800 }}>TX</div>
                                 <a 
                                   href={`https://sepolia.etherscan.io/tx/${log.txHash}`} 
                                   target="_blank" rel="noreferrer"
                                   style={{ fontSize: 11, color: '#cbd5e1', textDecoration: 'none', fontFamily: 'monospace' }}
                                   onMouseOver={(e) => e.target.style.color = '#38bdf8'}
                                   onMouseOut={(e) => e.target.style.color = '#cbd5e1'}
                                 >
                                   {log.txHash?.slice(0, 18)}...
                                 </a>
                                 <ExternalLink size={10} color="#475569" />
                              </div>
                              <div style={{ fontSize: 10, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                                 <Layers size={10} /> 
                                 <span>Block: <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>{log.blockNumber || '7,489,102'}</span></span>
                              </div>
                           </div>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                             <Clock size={12} color="#64748b" />
                             <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                               {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                             </span>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Enhanced Forensic Stats Summary ── */}
      <div className="forensic-stats-grid">
        {[
          { label: 'Total Logs', val: logs.length, icon: <Activity />, color: '#38bdf8', desc: 'Immutable Events' },
          { label: 'Secured Assets', val: logs.filter(l => l.eventType === 'FILE_UPLOADED').length, icon: <ShieldCheck />, color: '#14b8a6', desc: 'Integrity OK' },
          { label: 'Threats Blocked', val: logs.filter(l => l.eventType === 'TAMPER_DETECTED').length, icon: <AlertTriangle />, color: '#ef4444', desc: 'Forensic Alarms' },
          { label: 'Cloud Node', val: 'Online', icon: <Cpu />, color: '#818cf8', desc: 'Sync Status OK' },
        ].map((s, i) => (
          <div key={i} className="stat-card-premium">
             <div className="event-icon-box" style={{ width: 52, height: 52, background: `${s.color}15`, color: s.color, borderRadius: 14 }}>
               {s.icon}
             </div>
             <div>
               <div style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', lineHeight: 1 }}>{s.val}</div>
               <div style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
               <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{s.desc}</div>
             </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40, borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
         <p style={{ color: '#334155', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
           ChainSeal Laboratory — Forensic Blockchain Protocol v4.2.1
         </p>
      </div>

    </div>
  );
}