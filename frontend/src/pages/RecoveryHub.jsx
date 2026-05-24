import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2 as CheckCircle, AlertTriangle, Clock, Lock, 
  Search, RefreshCw, Microscope, ChevronDown, 
  ExternalLink, Link
} from 'lucide-react';
import ForensicModal from '../components/ForensicModal';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');
const API = `${API_URL}/api`;

const cardV = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const STATUS_CONFIG = {
  valid:    { color: '#14b8a6', bg: 'rgba(20,184,166,0.1)',
              border: 'rgba(20,184,166,0.3)', label: 'VALID',    icon: <CheckCircle size={20} /> },
  tampered: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',
              border: 'rgba(239,68,68,0.3)',  label: 'TAMPERED', icon: <AlertTriangle size={20} /> },
  pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',
              border: 'rgba(245,158,11,0.3)', label: 'PENDING',  icon: <Clock size={20} /> },
  revoked:  { color: '#64748b', bg: 'rgba(100,116,139,0.1)',
              border: 'rgba(100,116,139,0.3)',label: 'REVOKED',  icon: <Lock size={20} /> },
};

export default function RecoveryHub({ walletAddress, onNotify }) {
  const navigate = useNavigate();
  const [files,      setFiles]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [recovering, setRecovering] = useState('');
  const [filter,     setFilter]     = useState('tampered');
  const [search,     setSearch]     = useState('');
  const [selected,   setSelected]   = useState(null);
  const [forensicFile, setForensicFile] = useState(null);

  /* ── Fetch files ── */
  const fetchFiles = useCallback(async (isInitial = false, signal = null) => {
    if (!walletAddress) {
      setFiles([]);
      setLoading(false);
      return;
    }

    try {
      if (isInitial || files.length === 0) setLoading(true);
      
      const res = await fetch(`${API}/files?wallet=${walletAddress}`, { signal });
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

      const data = await res.json();
      const normalizedFiles = (data.files || []).map(f => ({
        ...f,
        status: f.status || 'pending'
      }));
      
      setFiles(normalizedFiles);
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error("RecoveryHub Fetch Error:", e.message);
      }
    } finally {
      if (isInitial || files.length === 0) setLoading(false);
    }
  }, [walletAddress, files.length]);

  useEffect(() => { 
    const controller = new AbortController();
    fetchFiles(true, controller.signal); 
    return () => controller.abort();
  }, [walletAddress, fetchFiles]);

  /* ── Download / Restore ── */
  const handleRestore = async (file) => {
    setRecovering(file.fileId);
    try {
      const { restoreFile } = await import('../utils/api');
      await restoreFile(file.fileId);
      onNotify?.('File integrity restored directly in vault!', 'success');
      fetchFiles();
    } catch (e) {
      onNotify?.('❌ Restore failed: ' + e.message, 'error');
    } finally {
      setRecovering('');
    }
  };

  /* ── Filtered list ── */
  const filtered = files.filter(f => {
    const fStatus = f.status || 'pending';
    const matchStatus = filter === 'all' || fStatus === filter;
    const matchSearch = !search ||
      f.fileName?.toLowerCase().includes(search.toLowerCase()) ||
      f.filename?.toLowerCase().includes(search.toLowerCase()) ||
      f.fileId?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const tamperedCount = files.filter(f => (f.status || 'pending') === 'tampered').length;

  /* ── Styles ── */
  const S = {
    card:  { background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 14, padding: '20px 22px', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: 800,
              color: 'var(--text, #e2e8f0)', marginBottom: 4 },
    sub:   { fontSize: 13, color: 'var(--muted, #64748b)', marginBottom: 24 },
    tab:   (active) => ({
      padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      background: active
        ? 'rgba(20,184,166,0.2)' : 'transparent',
      color: active ? '#14b8a6' : 'var(--muted, #64748b)',
      transition: 'all 0.2s',
    }),
    input: {
      background: 'var(--surface, #111820)',
      border: '1px solid var(--border, #1e2d3d)',
      borderRadius: 8, padding: '8px 14px', fontSize: 13,
      color: 'var(--text, #e2e8f0)', fontFamily: 'inherit',
      width: '100%', outline: 'none',
    },
    fileRow: (status) => {
      const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
      return {
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', borderRadius: 10, marginBottom: 10,
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        cursor: 'pointer', transition: 'transform 0.15s',
      };
    },
    btnRestore: {
      background: 'rgba(20,184,166,0.15)',
      border: '1px solid rgba(20,184,166,0.4)',
      color: '#14b8a6', borderRadius: 8, padding: '6px 16px',
      fontSize: 12, fontWeight: 700, cursor: 'pointer',
      fontFamily: 'inherit', whiteSpace: 'nowrap',
      transition: 'all 0.2s',
    },
    mono: { fontFamily: 'var(--font-mono, monospace)', fontSize: 11 },
  };

  return (
    <div className="page-inner">
      {/* Header */}
      <div style={S.title}><RefreshCw size={24} style={{ verticalAlign: 'middle', marginRight: 10 }} className="icon-spin-hover" /> Recovery Hub</div>
      <div style={S.sub}>
        Detect, audit, and restore tampered or compromised files
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20,
        flexWrap: 'wrap' }}>
        {[
          { label: 'Total Files',   value: files.length,
            color: '#00d4ff' },
          { label: 'Tampered',      value: tamperedCount,
            color: '#ef4444' },
          { label: 'Valid',
            value: files.filter(f => f.status === 'valid').length,
            color: '#14b8a6' },
          { label: 'Pending',
            value: files.filter(f => f.status === 'pending').length,
            color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <motion.div key={label}
            variants={cardV} initial="initial" animate="animate"
            style={{ ...S.card, flex: '1 1 120px',
              minWidth: 110, marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color }}>
              {loading ? '--' : value}
            </div>
            <div style={{ fontSize: 11,
              color: 'var(--muted, #64748b)', marginTop: 2 }}>
              {label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Filter + Search ── */}
      <motion.div style={{ ...S.card, marginBottom: 16 }}
        variants={cardV} initial="initial" animate="animate">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap',
          marginBottom: 14 }}>
          {['all', 'tampered', 'valid', 'pending', 'revoked'].map(f => (
            <button key={f} style={S.tab(filter === f)}
              onClick={() => setFilter(f)}>
              {f === 'tampered' && tamperedCount > 0
                ? <><AlertTriangle size={14} style={{ marginRight: 6 }} /> Tampered ({tamperedCount})</>
                : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              style={{ ...S.input, paddingLeft: 36 }}
              placeholder="Search by filename or file ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
      </motion.div>

      {/* ── File List ── */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: 40,
              color: 'var(--muted)' }}>
            Loading files...
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ ...S.card, textAlign: 'center',
              padding: 40, color: 'var(--muted)' }}>
            {filter === 'tampered'
              ? 'No tampered files found!'
              : 'No files match your filter.'}
          </motion.div>
        ) : (
          <motion.div key="list"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {filtered.map((file, i) => {
              const cfg = STATUS_CONFIG[file.status]
                       || STATUS_CONFIG.pending;
              const isSelected = selected === file.fileId;
              return (
                <motion.div key={file.fileId}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ scale: 1.005 }}>

                  {/* ── File Row ── */}
                  <div style={S.fileRow(file.status)}
                    onClick={() =>
                      setSelected(isSelected ? null : file.fileId)}>
                    {/* Icon */}
                    <span style={{ fontSize: 22, flexShrink: 0 }}>
                      {cfg.icon}
                    </span>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/files/${file.fileId}`);
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap' }}>
                        {file.fileName || file.filename || file.fileId || 'Unknown file'}
                      </div>
                      <div style={{ ...S.mono,
                        color: 'var(--muted)', marginTop: 2 }}>
                        {file.fileId} ·{' '}
                        {file.uploadedAt
                          ? new Date(file.uploadedAt)
                              .toLocaleDateString()
                          : '--'}
                      </div>
                    </div>

                    {/* Status badge */}
                    <span style={{
                      background: cfg.bg, color: cfg.color,
                      border: `1px solid ${cfg.border}`,
                      borderRadius: 20, padding: '2px 10px',
                      fontSize: 10, fontWeight: 800,
                      flexShrink: 0,
                    }}>
                      {cfg.label}
                    </span>

                    {/* Restore button — tampered/corrupted only */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          style={{
                            ...S.btnRestore,
                            background: 'rgba(0,212,255,0.1)',
                            border: '1px solid rgba(0,212,255,0.4)',
                            color: '#00d4ff',
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            setForensicFile(file);
                          }}>
                          <Microscope size={14} /> Forensic
                        </button>
                        {(file.status === 'tampered' || file.status === 'corrupted' || file.status === 'under_investigation') && (
                          <button
                            style={S.btnRestore}
                            disabled={recovering === file.fileId}
                            onClick={e => {
                              e.stopPropagation();
                              handleRestore(file);
                            }}>
                            {recovering === file.fileId
                              ? <Clock size={14} className="spin" style={{ marginRight: 6 }} />
                              : <RefreshCw size={14} style={{ marginRight: 6 }} />}
                            {recovering === file.fileId
                              ? 'Restoring...'
                              : 'Restore'}
                          </button>
                        )}
                      </div>

                    {/* Expand arrow */}
                    <span style={{
                      color: 'var(--muted)', display: 'flex',
                      flexShrink: 0,
                      transform: isSelected
                        ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}><ChevronDown size={14} /></span>
                  </div>

                  {/* ── Expanded Detail ── */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}>
                        <div style={{
                          ...S.card, marginTop: -6,
                          marginBottom: 10,
                          borderTopLeftRadius: 0,
                          borderTopRightRadius: 0,
                        }}>
                          {[
                            { label: 'File Hash',
                              val: file.originalHash },
                            { label: 'TX Hash',
                              val: file.txHash },
                            { label: 'File Size',
                              val: file.fileSize
                                ? `${(file.fileSize/1024).toFixed(1)} KB`
                                : '--' },
                            { label: 'Wallet',
                              val: file.walletAddress },
                          ].map(({ label, val }) => (
                            <div key={label} style={{
                              display: 'flex', gap: 12,
                              padding: '8px 0',
                              borderBottom:
                                '1px solid var(--border, #1e2d3d)',
                            }}>
                              <span style={{
                                fontSize: 11, width: 80,
                                flexShrink: 0,
                                color: 'var(--muted)',
                              }}>{label}</span>
                              <span style={{
                                ...S.mono, wordBreak: 'break-all',
                                color: 'var(--text)',
                              }}>
                                {val
                                  ? (val.startsWith('0x')
                                    ? `${val.slice(0,16)}...`
                                    : val)
                                  : '--'}
                              </span>
                            </div>
                          ))}

                          {/* TX link */}
                          {file.txHash &&
                           file.txHash !== 'pending' &&
                           file.txHash.startsWith('0x') && (
                            <div style={{ marginTop: 12 }}>
                              <a
                                href={`https://sepolia.etherscan.io/tx/${file.txHash}`}
                                target="_blank" rel="noreferrer"
                                style={{
                                  fontSize: 12, color: '#00d4ff',
                                  textDecoration: 'none',
                                }}>
                                <Link size={12} style={{ marginRight: 6 }} /> View on Etherscan <ExternalLink size={10} style={{ marginLeft: 4 }} />
                              </a>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: */}
      {forensicFile && (
        <ForensicModal
          fileId={forensicFile.fileId}
          filename={forensicFile.fileName || forensicFile.filename}
          onClose={() => setForensicFile(null)}
          onRestored={() => fetchFiles()}
        />
      )}
    </div>
  );
}
