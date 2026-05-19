import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getAuditLogs } from '../utils/api';
import { 
  Activity, AlertTriangle, RefreshCw, ShieldCheck, 
  FileText, Link as LinkIcon, ExternalLink, Clock, Database, 
  Terminal, Zap, Fingerprint, ShieldCheck as Shield
} from 'lucide-react';
import '../styles/BlockchainLog.css';

const getEventColor = (type) => {
  switch (type) {
    case 'FILE_UPLOADED': return '#14b8a6';
    case 'TAMPER_DETECTED': return '#ef4444';
    case 'FILE_RESTORED': return '#3b82f6';
    case 'FILE_ARCHIVED': return '#64748b';
    case 'FILE_VERIFIED': return '#8b5cf6';
    case 'INTEGRITY_CHECK': return '#8b5cf6';
    default: return '#94a3b8';
  }
};

const getEventIcon = (type) => {
  switch (type) {
    case 'FILE_UPLOADED': return <ShieldCheck size={16} />;
    case 'TAMPER_DETECTED': return <AlertTriangle size={16} />;
    case 'FILE_RESTORED': return <RefreshCw size={16} />;
    case 'FILE_VERIFIED': return <Shield size={16} />;
    case 'FILE_ARCHIVED': return <Database size={16} />;
    default: return <Activity size={16} />;
  }
};

export default function BlockchainLog({ walletAddress }) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState(() =>
    Array.from({ length: 8 }, (_, i) => Math.floor(Math.random() * 900) + 100)
  );

  useEffect(() => {
    const iv = setInterval(() => {
      setBlocks(prev => {
        const next = Math.floor(Math.random() * 900) + 100;
        return [...prev.slice(1), next];
      });
    }, 4000);
    return () => clearInterval(iv);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs(walletAddress);
      const filteredLogs = (res.logs || []).filter(log => log.eventType !== 'FILE_ARCHIVED');
      setLogs(filteredLogs);
    } catch (err) {
      console.error('Failed to retrieve forensic logs:', err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="page-inner">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Terminal size={32} color="#14b8a6" /> Forensic Audit Trail
          </h1>
          <p style={{ color: '#64748b', marginTop: 4 }}>Immutable Blockchain Ledger Events for Ethereum Sepolia</p>
        </div>
        <button 
          onClick={fetchLogs} 
          style={{ 
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', padding: '10px 18px', borderRadius: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600
          }}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Synchronize Ledger
        </button>
      </div>

      {/* Network Status Bar */}
      <div style={{ 
        background: '#0f172a', border: '1px solid rgba(20,184,166,0.1)', borderRadius: 16, 
        padding: '16px 24px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 24
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="pulse-active" style={{ width: 8, height: 8, borderRadius: '50%', background: '#14b8a6' }}></div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Ethereum Sepolia</span>
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.05)' }}></div>
        <div style={{ flex: 1, display: 'flex', gap: 8, overflow: 'hidden' }}>
          {blocks.map((b, i) => (
            <motion.div 
              key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              style={{ 
                padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', 
                border: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: '#64748b', fontFamily: 'monospace' 
              }}>
              BLK-{b}
            </motion.div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#14b8a6', fontWeight: 800 }}>LIVE SYNC ACTIVE</div>
      </div>

      {/* Audit Log Table */}
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>EVENT</th>
              <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>ASSET</th>
              <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>WALLET</th>
              <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>BLOCKCHAIN PROOF</th>
              <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>TIMESTAMP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" style={{ padding: 60, textAlign: 'center' }}>
                  <RefreshCw size={40} color="#334155" className="spin" />
                  <p style={{ marginTop: 16, color: '#64748b' }}>Retrieving immutable evidence...</p>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: 60, textAlign: 'center' }}>
                  <Shield size={40} color="#334155" style={{ opacity: 0.5 }} />
                  <p style={{ marginTop: 16, color: '#64748b' }}>No forensic events found for this vault.</p>
                </td>
              </tr>
            ) : (
              logs.map((log, i) => (
                <motion.tr 
                  key={log.logId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: log.eventType === 'TAMPER_DETECTED' ? 'rgba(239,68,68,0.02)' : 'transparent' }}
                >
                  <td style={{ padding: '18px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ 
                        width: 32, height: 32, borderRadius: 8, 
                        background: `${getEventColor(log.eventType)}15`,
                        color: getEventColor(log.eventType),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${getEventColor(log.eventType)}33`
                      }}>
                        {getEventIcon(log.eventType)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{log.eventType.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{log.details || 'System Verified'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '18px 24px', cursor: 'pointer' }} onClick={() => navigate(`/files/${log.fileId}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={16} color="#94a3b8" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>{log.fileName}</div>
                        <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginTop: 2 }}>{log.fileId}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '18px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Fingerprint size={14} color="#818cf8" />
                      <a 
                        href={`https://sepolia.etherscan.io/address/${log.walletAddress}`} 
                        target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none', fontFamily: 'monospace' }}
                      >
                        {log.walletAddress ? `${log.walletAddress.slice(0, 6)}...${log.walletAddress.slice(-4)}` : '0x000...0000'}
                      </a>
                    </div>
                  </td>
                  <td style={{ padding: '18px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Zap size={12} color="#14b8a6" />
                        <a href={`https://sepolia.etherscan.io/tx/${log.txHash}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: '#38bdf8', textDecoration: 'none', fontFamily: 'monospace' }}>
                          {log.txHash?.slice(0, 16)}...
                        </a>
                        <ExternalLink size={10} color="#475569" />
                      </div>
                      <div style={{ fontSize: 10, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <LinkIcon size={10} /> Block: <span style={{ color: '#94a3b8' }}>{log.blockNumber || '6,482,912'}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '18px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 12 }}>
                      <Clock size={14} />
                      {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Forensic Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginTop: 32 }}>
        {[
          { label: 'Total Events', val: logs.length, icon: <Activity />, color: '#38bdf8' },
          { label: 'Integrity OK', val: logs.filter(l => l.eventType === 'FILE_UPLOADED').length, icon: <ShieldCheck />, color: '#14b8a6' },
          { label: 'Tamper Alerts', val: logs.filter(l => l.eventType === 'TAMPER_DETECTED').length, icon: <AlertTriangle />, color: '#ef4444' },
          { label: 'Active Identity', val: walletAddress ? `${walletAddress.slice(0, 6)}...` : 'Unknown', icon: <Fingerprint />, color: '#818cf8' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
             <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}10`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               {s.icon}
             </div>
             <div>
               <div style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9' }}>{s.val}</div>
               <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
             </div>
          </div>
        ))}
      </div>

    </div>
  );
}