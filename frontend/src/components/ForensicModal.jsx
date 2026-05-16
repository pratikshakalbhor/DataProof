/**
 * ForensicModal.jsx
 * Full-screen Forensic Comparison Modal
 * Requires: npm install react-diff-viewer-continued
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Microscope, CheckCircle2, AlertTriangle, RefreshCw, 
  FileText, Lock, X, Link, ExternalLink, Download, Clock,
  FileSearch, Activity
} from 'lucide-react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import toast from 'react-hot-toast';
import '../styles/ForensicModal.css';

const API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '') + '/api';

/* ─── Risk Score Ring ───────────────────────────────────── */
function RiskRing({ score, level }) {
  const r    = 36;
  const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;

  const colors = {
    SECURE:   '#14b8a6',
    LOW:      '#f59e0b',
    MEDIUM:   '#f97316',
    HIGH:     '#ef4444',
    CRITICAL: '#dc2626',
  };
  const color = colors[level] || colors.SECURE;

  return (
    <div className="risk-ring-wrap">
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={r}
          fill="none" stroke="rgba(255,255,255,0.07)"
          strokeWidth={7} />
        <circle cx={45} cy={45} r={r}
          fill="none" stroke={color} strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={fill}
          transform="rotate(-90 45 45)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x={45} y={49}
          textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={16} fontWeight={800}
          fontFamily="monospace">
          {score}
        </text>
      </svg>
      <span className="risk-ring-label" style={{ color }}>
        {level}
      </span>
    </div>
  );
}

/* ─── File Preview ──────────────────────────────────────── */
function FilePreview({ content, mimeType, label, status }) {
  const isImage   = mimeType?.startsWith('image/');
  const isPDF     = mimeType === 'application/pdf';
  const isDataURL = content?.startsWith('data:');

  return (
    <div className={`forensic-preview-pane ${status}`}>
      <div className="forensic-preview-label">
        <span className="forensic-preview-dot" />
        <span className="forensic-preview-label-text">{label}</span>
      </div>

      <div className="forensic-preview-content">
        {isImage && isDataURL ? (
          <img src={content} alt={label} />
        ) : isPDF && isDataURL ? (
          <iframe src={content} title={label} />
        ) : isDataURL ? (
          <div className="binary-evidence-card">
            <h4><Shield size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Binary Evidence Analysis</h4>
            <div className="binary-evidence-details">
              <p><strong>Format:</strong> <code>{mimeType || 'Unknown Binary'}</code></p>
              <p><strong>Status:</strong> {status === 'original' ? 'Blockchain Sealed' : 'Current Snapshot'}</p>
              <p className="binary-hidden-msg">
                Raw binary content hidden for safety and performance.
              </p>
            </div>
          </div>
        ) : content?.startsWith('[') ? (
          <div className="forensic-preview-unavailable">
            {content}
          </div>
        ) : (
          <pre>
            {content || '(empty)'}
          </pre>
        )}
      </div>
    </div>
  );
}

/* ─── Main Modal ────────────────────────────────────────── */
export default function ForensicModal({ fileId, filename, onClose, onRestored }) {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [tab,       setTab]       = useState('diff');  // diff | preview | info
  const [restoring, setRestoring] = useState(false);
  const [restored,  setRestored]  = useState(false);

  /* ── Fetch forensic data ── */
  const fetchData = useCallback(async () => {
    if (!fileId) {
      setError('No file ID provided');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const url = `${API}/file/forensic-compare/${encodeURIComponent(fileId)}`;
      console.log('[ForensicModal] Fetching:', url);

      const res = await fetch(url);

      if (!res.ok) {
        // Try to read backend error message
        let msg = `HTTP ${res.status}`;
        try {
          const json = await res.json();
          msg = json.error || json.message || msg;
        } catch (_) { /* ignore */ }
        throw new Error(msg);
      }

      const json = await res.json();
      console.log('[ForensicModal] Response keys:', Object.keys(json));
      setData(json);

      // Auto-switch to preview tab for binary files
      if (json.isBinary) setTab('preview');

    } catch (e) {
      console.error('[ForensicModal] Fetch error:', e);
      setError(e.message || 'Failed to load forensic data');
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Restore ── */
  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await fetch(`${API}/restore/${encodeURIComponent(fileId)}`,
        { method: 'POST' });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
        throw new Error(msg);
      }
      setRestored(true);
      toast.success('Integrity restored successfully');
      onRestored?.();
      await fetchData(); // refresh comparison after restore
    } catch (e) {
      toast.error('Restore failed: ' + e.message);
    } finally {
      setRestoring(false);
    }
  };

  /* ── Download Evidence ── */
  const handleDownloadEvidence = () => {
    if (!data) return;
    const report = {
      generatedAt:   new Date().toISOString(),
      fileId:        data.fileId,
      fileName:      data.fileName,
      walletAddress: data.walletAddress,
      txHash:        data.txHash,
      status:        data.status,
      riskScore:     data.riskScore,
      riskLevel:     data.riskLevel,
      originalHash:  data.originalHash,
      modifiedHash:  data.modifiedHash,
      isIdentical:   data.isIdentical,
      mimeType:      data.mimeType,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `forensic-report-${data.fileId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Diff viewer styles ── */
  const diffStyles = {
    variables: {
      dark: {
        diffViewerBackground:      '#0d1117',
        diffViewerColor:           '#e2e8f0',
        addedBackground:           'rgba(20,184,166,0.15)',
        addedColor:                '#d1fae5',
        removedBackground:         'rgba(239,68,68,0.15)',
        removedColor:              '#fecaca',
        wordAddedBackground:       'rgba(20,184,166,0.4)',
        wordRemovedBackground:     'rgba(239,68,68,0.4)',
        addedGutterBackground:     'rgba(20,184,166,0.25)',
        removedGutterBackground:   'rgba(239,68,68,0.25)',
        gutterBackground:          '#0a0f1a',
        gutterColor:               '#475569',
        codeFoldBackground:        '#111827',
        codeFoldGutterBackground:  '#111827',
        codeFoldContentColor:      '#64748b',
        emptyLineBackground:       '#0a0f1a',
        highlightBackground:       'rgba(245,158,11,0.15)',
        highlightGutterBackground: 'rgba(245,158,11,0.25)',
      },
    },
    line:   { fontFamily: 'monospace', fontSize: '12px' },
    gutter: { minWidth: '40px' },
  };

  /* ── UI helpers ── */
  const isCritical = data?.riskLevel === 'CRITICAL' || data?.riskLevel === 'HIGH';
  const isBinary   = data?.isBinary;

  return (
    <AnimatePresence>
      <motion.div
        className="forensic-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className={`forensic-modal ${isCritical ? 'critical' : ''}`}
          initial={{ opacity: 0, scale: 0.94, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.25 }}
        >
          {/* ── Header ── */}
          <div className={`forensic-header ${isCritical ? 'critical' : ''}`}>
            {/* Risk ring — only when data is loaded */}
            {data && !loading && (
              <RiskRing score={data.riskScore} level={data.riskLevel} />
            )}

            {/* Title */}
            <div className="forensic-title-block">
              <div className="forensic-title">
                <h2><Microscope size={22} style={{ verticalAlign: 'middle', marginRight: 10 }} /> Forensic Report</h2>
                {isCritical && !loading && (
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="badge badge-critical">
                    <AlertTriangle size={12} style={{ marginRight: 4 }} /> TAMPERING DETECTED
                  </motion.span>
                )}
                {data?.isIdentical && !loading && (
                  <span className="badge badge-valid"><CheckCircle2 size={12} style={{ marginRight: 4 }} /> IDENTICAL</span>
                )}
                {restored && (
                  <span className="badge badge-restored"><CheckCircle2 size={12} style={{ marginRight: 4 }} /> RESTORED</span>
                )}
              </div>
              <div className="forensic-subtitle">
                {data?.fileName || filename || fileId}
                {data?.txHash && data.txHash !== 'pending' && (
                  <> · TX: {data.txHash.slice(0, 16)}...</>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="forensic-tabs">
              {[
                { key: 'diff',    label: <span><Activity size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Diff</span>,    hidden: isBinary },
                { key: 'preview', label: <span><FileSearch size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Preview</span> },
                { key: 'info',    label: <span><FileText size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Info</span> },
              ].filter(t => !t.hidden).map(({ key, label }) => (
                <button key={key}
                  className={`forensic-tab ${tab === key ? 'active' : ''}`}
                  onClick={() => setTab(key)}>
                  {label}
                </button>
              ))}
            </div>

            {/* Close */}
            <button onClick={onClose} className="forensic-close"><X size={20} /></button>
          </div>

          {/* ── Body ── */}
          <div className="forensic-body">

            {/* LOADING */}
            {loading && (
              <div className="forensic-loading">
                <div className="forensic-spinner" />
                Generating forensic comparison...
              </div>
            )}

            {/* ERROR */}
            {!loading && error && (
              <div className="forensic-error">
                <div className="forensic-error-icon"><AlertTriangle size={32} /></div>
                <div className="forensic-error-message">{error}</div>
                <button className="forensic-retry-btn" onClick={fetchData}>
                  <RefreshCw size={14} style={{ marginRight: 6 }} /> Retry
                </button>
                <div className="forensic-error-hint">
                  <strong>Possible causes:</strong>
                  <ul>
                    <li>The file was not saved locally during upload</li>
                    <li>The backend server is not running</li>
                    <li>The fileId is invalid</li>
                  </ul>
                </div>
              </div>
            )}

            {/* CONTENT */}
            {!loading && !error && data && (
              <>
                {/* ── DIFF TAB ── */}
                {tab === 'diff' && (
                  <div className="forensic-diff-wrap">
                    {isBinary ? (
                      <div className="forensic-no-diff">
                        <div className="forensic-no-diff-icon"><FileText size={32} /></div>
                        <h3>Binary forensic comparison unavailable</h3>
                        <p>
                          Text diff is not available for{' '}
                          <code>{data.mimeType}</code> files.
                          Use the <strong>Preview</strong> tab instead.
                        </p>
                      </div>
                    ) : data.isIdentical ? (
                      <div className="forensic-no-diff forensic-identical">
                        <div className="forensic-no-diff-icon"><CheckCircle2 size={32} /></div>
                        <h3>Files Are Identical</h3>
                        <p>
                          The current file matches the original blockchain-sealed version.
                          No tampering detected.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Changes Summary — user la clearly distil */}
                        {!isBinary && !data.isIdentical && data.changes?.length > 0 && (
                          <div style={{
                            background: 'rgba(255,68,68,.06)',
                            border: '1px solid rgba(255,68,68,.2)',
                            borderRadius: 12, padding: '16px 20px', marginBottom: 16,
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#ff4444', marginBottom: 12 }}>
                              🔬 Exact Changes Detected ({data.changes.length})
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                              {data.changes.map((ch, i) => (
                                <div key={i} style={{
                                  padding: '8px 12px', borderRadius: 8,
                                  background: ch.type === 'added'
                                    ? 'rgba(0,200,150,.08)'
                                    : ch.type === 'removed'
                                    ? 'rgba(255,68,68,.08)'
                                    : 'rgba(245,158,11,.08)',
                                  border: `1px solid ${
                                    ch.type === 'added' ? 'rgba(0,200,150,.25)'
                                    : ch.type === 'removed' ? 'rgba(255,68,68,.25)'
                                    : 'rgba(245,158,11,.25)'}`,
                                }}>
                                  {/* Line number + type */}
                                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                                    <span style={{
                                      fontSize: 9, fontWeight: 700, padding: '1px 7px',
                                      borderRadius: 20, textTransform: 'uppercase',
                                      color: ch.type === 'added' ? '#00c896'
                                        : ch.type === 'removed' ? '#ff4444' : '#F59E0B',
                                      background: ch.type === 'added' ? 'rgba(0,200,150,.15)'
                                        : ch.type === 'removed' ? 'rgba(255,68,68,.15)' : 'rgba(245,158,11,.15)',
                                    }}>
                                      {ch.type}
                                    </span>
                                    <span style={{ fontSize: 10, color: '#7a95b0',
                                      fontFamily: 'monospace' }}>
                                      Line {ch.line}
                                    </span>
                                  </div>

                                  {/* Before */}
                                  {ch.before && (
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                                      <span style={{ color: '#ff4444', fontWeight: 700,
                                        fontFamily: 'monospace', flexShrink: 0 }}>−</span>
                                      <code style={{ fontSize: 12, color: '#ff8888',
                                        fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                        {ch.before}
                                      </code>
                                    </div>
                                  )}

                                  {/* After */}
                                  {ch.after && (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                      <span style={{ color: '#00c896', fontWeight: 700,
                                        fontFamily: 'monospace', flexShrink: 0 }}>+</span>
                                      <code style={{ fontSize: 12, color: '#88ffcc',
                                        fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                        {ch.after}
                                      </code>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <ReactDiffViewer
                        oldValue={data.original || ''}
                        newValue={data.modified || ''}
                        splitView={true}
                        compareMethod={DiffMethod.WORDS}
                        useDarkTheme={true}
                        styles={diffStyles}
                        leftTitle={<span><Lock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Original (Blockchain Verified)</span>}
                        rightTitle={<span><AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Current / Modified Version</span>}
                        hideLineNumbers={false}
                      />
                      </>
                    )}
                  </div>
                )}

                {/* ── PREVIEW TAB ── */}
                {tab === 'preview' && (
                  <div className="forensic-preview-wrap">
                    <FilePreview
                      content={data.original}
                      mimeType={data.mimeType}
                      label="Original (Sealed)"
                      status="original"
                      data={data}
                    />
                    <FilePreview
                      content={data.modified}
                      mimeType={data.mimeType}
                      label="Current Version"
                      status="modified"
                      data={data}
                    />
                  </div>
                )}

                {/* ── INFO TAB ── */}
                {tab === 'info' && (
                  <div className="forensic-info-wrap">
                    <div className="forensic-info-title">
                      <FileText size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} /> File Intelligence Report
                    </div>

                    {[
                      { label: 'File ID',        val: data.fileId },
                      { label: 'Filename',       val: data.fileName },
                      { label: 'MIME Type',      val: data.mimeType },
                      { label: 'File Size',      val: data.fileSize ? `${(data.fileSize / 1024).toFixed(1)} KB` : '--' },
                      { label: 'Status',         val: data.status?.toUpperCase() },
                      { label: 'Risk Score',     val: `${data.riskScore}/100 — ${data.riskLevel}` },
                      { label: 'Identical',      val: data.isIdentical ? <span style={{ color: 'var(--accent-teal)' }}><CheckCircle2 size={12} /> Yes — No tampering</span> : <span style={{ color: 'var(--accent-red)' }}><X size={12} /> No — Modified</span> },
                      { label: 'Original Hash',  val: data.originalHash },
                      { label: 'Modified Hash',  val: data.modifiedHash },
                      { label: 'TX Hash',        val: data.txHash },
                      { label: 'Wallet',         val: data.walletAddress },
                      { label: 'Uploaded',       val: data.uploadedAt ? new Date(data.uploadedAt).toLocaleString() : '--' },
                    ].map(({ label, val }) => (
                      <div key={label} className="forensic-info-row">
                        <span className="forensic-info-label">{label}</span>
                        <span className="forensic-info-value">{val || '--'}</span>
                      </div>
                    ))}

                    {/* Etherscan link */}
                    {data.txHash && data.txHash !== 'pending' && data.txHash.startsWith('0x') && (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${data.txHash}`}
                        target="_blank" rel="noreferrer"
                        className="forensic-etherscan-link">
                        <Link size={14} style={{ marginRight: 6 }} /> View Blockchain Proof on Etherscan <ExternalLink size={12} style={{ marginLeft: 4 }} />
                      </a>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Footer ── */}
          {!loading && !error && data && (
            <div className="forensic-footer">
              {/* Status pill */}
              <div className="forensic-footer-left">
                <span className="forensic-footer-filename">
                  {data.fileName || filename}
                </span>
                <span className={`badge badge-${data.status || 'pending'}`}>
                  {data.status?.toUpperCase()}
                </span>
              </div>

              {/* Actions */}
              <div className="forensic-footer-actions">
                {/* Download Evidence */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleDownloadEvidence}
                  className="btn-evidence">
                  <Download size={16} style={{ marginRight: 8 }} /> Download Evidence
                </motion.button>

                {/* Open Blockchain Proof */}
                {data.txHash && data.txHash !== 'pending' && data.txHash.startsWith('0x') && (
                  <motion.a
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    href={`https://sepolia.etherscan.io/tx/${data.txHash}`}
                    target="_blank" rel="noreferrer"
                    className="btn-blockchain">
                    <Link size={16} style={{ marginRight: 8 }} /> Blockchain Proof
                  </motion.a>
                )}

                {/* Restore */}
                {(data.status === 'tampered' || !data.isIdentical) && !restored && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    disabled={restoring}
                    onClick={handleRestore}
                    className="btn-restore">
                    {restoring ? <Clock size={16} className="spin" style={{ marginRight: 8 }} /> : <RefreshCw size={16} style={{ marginRight: 8 }} />}
                    {restoring ? 'Restoring...' : 'Restore Original'}
                  </motion.button>
                )}

                <button onClick={onClose} className="btn-close-modal">
                  Close
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
