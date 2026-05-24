import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllFiles, downloadOriginalFile, restoreFile } from '../utils/api';
import {
  Activity, AlertTriangle, ExternalLink,
  FileText, RefreshCw, Search, ShieldCheck, X, 
  DownloadCloud, Clock, Fingerprint, ChevronRight,
  Database, ShieldAlert, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import '../styles/MyFiles.css';

// ── Helpers ──────────────────────────────────────────────────────────
const fmtSize = b =>
  !b ? '—' : b < 1024 ? b + ' B' : b < 1048576
    ? (b / 1024).toFixed(1) + ' KB'
    : (b / 1048576).toFixed(2) + ' MB';

const fmtDate = dt =>
  dt ? new Date(dt).toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  }) : '—';


function StatusPill({ status, isExpired }) {
  const s = (status || '').toLowerCase();
  if (isExpired) return (
    <span className="status-pill expired">
      <Clock size={11} /> EXPIRED
    </span>
  );
  if (s === 'valid' || s === 'secure') return (
    <span className="status-pill valid">
      <ShieldCheck size={11} /> VALID
    </span>
  );
  if (s === 'tampered') return (
    <span className="status-pill tampered">
      <ShieldAlert size={11} /> TAMPERED
    </span>
  );
  return (
    <span className="status-pill pending">
      <Activity size={11} /> IN_GLORY
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────
export default function MyFiles({ walletAddress, refreshKey }) {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [processing, setProcessing] = useState(null);

  const fetchFiles = useCallback(async () => {
    if (!walletAddress) return;
    
    setLoading(true); 
    setError('');
    
    try {
      const res = await getAllFiles(walletAddress);
      const data = res.files || (Array.isArray(res) ? res : []);
      
      // Filter logic: match wallet or allow orphans
      const currentWallet = walletAddress.toLowerCase();
      const userFiles = data.filter(file => {
        const owner = (file.walletAddress || file.owner || '').toLowerCase();
        return owner === currentWallet || !owner;
      });

      setFiles(userFiles);
    } catch (err) {
      console.error("MyFiles: Fetch Error:", err);
      setError(err.message || 'Failed to sync with forensic vault');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { 
    fetchFiles(); 
  }, [fetchFiles, refreshKey]);

  const handleDownload = async (fileId, name) => {
    setProcessing(fileId);
    try {
      await downloadOriginalFile(fileId, name);
      toast.success(`Download started: ${name}`);
    } catch (err) {
      toast.error(err.message || "Download failed");
    } finally {
      setProcessing(null);
    }
  };

  const handleRestore = async (fileId, name) => {
    if (!window.confirm(`Restore "${name}" to its original blockchain-sealed state? This will overwrite the locally modified version.`)) return;
    setProcessing(fileId);
    try {
      await restoreFile(fileId, walletAddress);
      toast.success(`${name} successfully restored!`);
      await fetchFiles();
    } catch (err) {
      toast.error(err.message || "Restoration failed");
    } finally {
      setProcessing(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter(f =>
      (f.fileName || f.name || f.filename || '').toLowerCase().includes(q) ||
      (f.fileId || f.id || '').toLowerCase().includes(q)
    );
  }, [files, query]);

  return (
    <div className="page-inner">
      <div className="my-files-container">
        
        {/* ── Header ── */}
        <header className="files-header">
          <div className="files-title">
            <h1>
              <Database size={32} color="#14b8a6" /> 
              Forensic Asset Ledger
            </h1>
            <p>Immutable cryptographic inventory of all secured digital evidence</p>
          </div>
          
          <div style={{ display: 'flex', gap: 14 }}>
            <div className="search-wrapper">
              <Search className="search-icon-pos" size={18} />
              <input
                className="search-input-premium"
                placeholder="Search by name or asset hash..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && <X size={14} className="close" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#64748b' }} onClick={() => setQuery('')} />}
            </div>
            
            <button className="ref-btn" onClick={fetchFiles} style={{ height: 44, padding: '0 20px', borderRadius: 14 }}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> 
              <span>Synchronize Vault</span>
            </button>
          </div>
        </header>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="error-box" style={{ marginBottom: 24 }}>
            <AlertTriangle size={18} /> {error}
            <button onClick={fetchFiles} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontSize: 11 }}>Retry Sync</button>
          </motion.div>
        )}

        {/* ── Ledger Card ── */}
        <div className="glass-ledger">
          <table className="ledger-table-premium">
            <thead>
              <tr>
                <th>Digital Asset Identity</th>
                <th>Network Timestamp</th>
                <th>Integrity Status</th>
                <th>Blockchain Proof</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5">
                    <div className="empty-explorer">
                      <RefreshCw size={40} className="spin" color="#14b8a6" style={{ marginBottom: 16, opacity: 0.5 }} />
                      <p>Scanning distributed ledger for asset records...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="empty-explorer">
                      <Database size={40} color="#334155" style={{ marginBottom: 16, opacity: 0.3 }} />
                      <h3>No Assets Detected</h3>
                      <p>{query ? `No records found matching "${query}"` : 'Your forensic vault is currently empty.'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {filtered.map((f, i) => {
                    const fileId = f.fileId || f.id;
                    const name = f.fileName || f.name || f.filename || 'Unknown Metadata';
                    const txHash = f.txHash || '';
                    const isExpired = f.isExpired || (f.expiryDate && new Date(f.expiryDate) < new Date());
                    const isTampered = f.status?.toLowerCase() === 'tampered';

                    return (
                      <motion.tr 
                        key={fileId}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="file-row"
                        onClick={() => navigate(`/files/${fileId}`)}
                      >
                        {/* Filename & Info */}
                        <td style={{ width: '30%' }}>
                          <div className="asset-item">
                            <div className="asset-icon-box" style={{ color: isTampered ? '#ef4444' : '#14b8a6' }}>
                              {isTampered ? <ShieldAlert size={20} /> : <FileText size={20} />}
                            </div>
                            <div className="asset-info">
                              <div className="name">{name}</div>
                              <div className="meta">
                                <span>{f.fileType?.toUpperCase() || f.type?.toUpperCase() || 'DATA'}</span>
                                <span style={{ opacity: 0.3 }}>|</span>
                                <span>{fmtSize(f.fileSize)}</span>
                                {f.ipfsCID && (
                                  <>
                                    <span style={{ opacity: 0.3 }}>|</span>
                                    <span style={{ color: '#818cf8', fontWeight: 600 }}>IPFS: {f.ipfsCID.slice(0, 8)}...</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td style={{ width: '15%', color: '#94a3b8', fontSize: 12 }}>
                          {fmtDate(f.uploadedAt)}
                        </td>

                        {/* Status */}
                        <td style={{ width: '15%' }}>
                          <StatusPill status={f.status} isExpired={isExpired} />
                        </td>

                        {/* Blockchain Proof */}
                        <td style={{ width: '20%' }}>
                          {txHash && txHash.startsWith('0x') ? (
                            <a
                              href={`https://sepolia.etherscan.io/tx/${txHash}`}
                              target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ 
                                display: 'flex', alignItems: 'center', gap: 6,
                                color: '#38bdf8', fontSize: 11, fontFamily: 'monospace',
                                textDecoration: 'none'
                              }}
                            >
                              <Fingerprint size={12} />
                              {txHash.slice(0, 10)}...{txHash.slice(-6)}
                              <ExternalLink size={10} style={{ opacity: 0.5 }} />
                            </a>
                          ) : (
                            <span style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
                              Registry Pending...
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ width: '20%', textAlign: 'right' }}>
                          <div className="action-btn-group" onClick={e => e.stopPropagation()}>
                            <button 
                              className="action-btn verify" 
                              title="Verify Integrity"
                              onClick={() => navigate(`/verify?id=${fileId}`)}
                            >
                              <ShieldCheck size={16} />
                            </button>
                            
                            {isTampered && (
                              <button 
                                className="action-btn restore" 
                                title="Restore from Backup"
                                onClick={() => handleRestore(fileId, name)}
                                disabled={processing === fileId}
                              >
                                <RotateCcw size={16} className={processing === fileId ? "spin" : ""} />
                              </button>
                            )}

                            <button 
                              className="action-btn download" 
                              title="Download Asset"
                              onClick={() => handleDownload(fileId, name)}
                              disabled={processing === fileId}
                            >
                              <DownloadCloud size={16} />
                            </button>
                            
                            <button 
                              className="action-btn" 
                              title="View Details"
                              onClick={() => navigate(`/files/${fileId}`)}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        {!loading && filtered.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 20 }}>
             <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
               TOTAL ASSETS: {files.length}
             </span>
             <span style={{ fontSize: 11, color: '#14b8a6', fontWeight: 600 }}>
               INTEGRITY VERIFIED: {files.filter(f => f.status === 'valid' || f.status === 'secure').length}
             </span>
          </div>
        )}
      </div>
    </div>
  );
}
