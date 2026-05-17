/**
 * ForensicModal.jsx — Enterprise Forensic Audit Platform
 * Forensic comparison modal with professional diff, restore workflow,
 * and clear ORIGINAL / TAMPERED labeling.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Microscope, CheckCircle2, AlertTriangle, RefreshCw,
  FileText, Lock, X, Link, ExternalLink, Download, Clock,
  FileSearch, Activity, ShieldCheck, ShieldAlert, RotateCcw
} from 'lucide-react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import '../styles/ForensicModal.css';

const API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '') + '/api';

/* ─── Risk Score Ring ─────────────────────────────────────── */
function RiskRing({ score, level }) {
  const r    = 36;
  const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  const colors = {
    SECURE: '#14b8a6', LOW: '#f59e0b',
    MEDIUM: '#f97316', HIGH: '#ef4444', CRITICAL: '#dc2626',
  };
  const color = colors[level] || colors.SECURE;
  return (
    <div className="risk-ring-wrap">
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
        <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={fill}
          transform="rotate(-90 45 45)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <text x={45} y={49} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={16} fontWeight={800} fontFamily="monospace">{score}</text>
      </svg>
      <span className="risk-ring-label" style={{ color }}>{level}</span>
    </div>
  );
}

/* ─── Text Preview Pane ───────────────────────────────────── */
function TextPreviewPane({ content, label, side }) {
  // Never show base64 / binary data — only readable text
  const isBinaryOrEncoded =
    !content ||
    content.startsWith('data:') ||
    content.startsWith('UEsDB') || // DOCX zip magic in b64
    content.length > 200000;

  const isTampered = side === 'tampered';

  return (
    <div className={`forensic-preview-pane ${isTampered ? 'modified' : 'original'}`}>
      {/* Label bar */}
      <div className="forensic-preview-label">
        <span className="forensic-preview-dot" />
        <span className="forensic-preview-label-text">{label}</span>
        {!isTampered && (
          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800,
            color: '#14b8a6', letterSpacing: '0.08em' }}>
            BLOCKCHAIN SEALED
          </span>
        )}
        {isTampered && (
          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800,
            color: '#ef4444', letterSpacing: '0.08em' }}>
            SUSPICIOUS COPY
          </span>
        )}
      </div>

      <div className="forensic-preview-content">
        {isBinaryOrEncoded ? (
          <div className="binary-evidence-card">
            <Shield size={28} style={{ color: '#38bdf8', marginBottom: 12 }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
              Binary Forensic Comparison Unavailable
            </div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.7 }}>
              Text preview is not available for this file type.<br />
              Use the <strong style={{ color: '#94a3b8' }}>Diff</strong> tab for extracted text comparison.
            </div>
          </div>
        ) : (
          <pre>{content || '(empty)'}</pre>
        )}
      </div>
    </div>
  );
}

/* ─── Restore Success Banner ──────────────────────────────── */
function RestoreBanner({ fileName }) {
  return (
    <motion.div
      className="restore-success-banner"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <ShieldCheck size={20} style={{ color: '#14b8a6', flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#14b8a6' }}>
          Original blockchain backup restored successfully
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
          RESTORED_{fileName} — downloaded from blockchain vault
        </div>
      </div>
      <span className="badge badge-restored" style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <ShieldCheck size={10} style={{ marginRight: 4 }} />
        RESTORED FROM BLOCKCHAIN
      </span>
    </motion.div>
  );
}

/* ─── Main Modal ──────────────────────────────────────────── */
export default function ForensicModal({ fileId, filename, onClose, onRestored }) {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [tab,       setTab]       = useState('diff');
  const [restoring, setRestoring] = useState(false);
  const [restored,  setRestored]  = useState(false);

  /* ── Fetch forensic comparison data ── */
  const fetchData = useCallback(async () => {
    if (!fileId) { setError('No file ID provided'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/file/forensic-compare/${encodeURIComponent(fileId)}`);
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); msg = j.error || j.message || msg; } catch (_) {}
        throw new Error(msg);
      }
      const json = await res.json();
      setData(json);
      // Binary files — go to preview tab; text files — diff tab
      if (json.isBinary) setTab('preview');
    } catch (e) {
      setError(e.message || 'Failed to load forensic data');
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Restore: overwrite vault with backup, then download RESTORED_ file ── */
  const handleRestore = async () => {
    setRestoring(true);
    try {
      // 1. Tell backend to restore vault copy from backup
      const res = await fetch(`${API}/restore/${encodeURIComponent(fileId)}`, { method: 'POST' });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
        throw new Error(msg);
      }

      // 2. Download the restored original — named RESTORED_<filename>
      const originalName = data?.fileName || filename || 'file';
      const downloadName = `RESTORED_${originalName}`;

      const dlRes = await fetch(`${API}/files/${encodeURIComponent(fileId)}/download-original`);
      if (dlRes.ok) {
        const blob = await dlRes.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setRestored(true);
      onRestored?.();
      await fetchData();
    } catch (e) {
      setError('Restore failed: ' + e.message);
    } finally {
      setRestoring(false);
    }
  };

  /* ── Download Evidence Report (JSON, no binary content) ── */
  const handleDownloadEvidence = () => {
    if (!data) return;
    const report = {
      generatedAt:   new Date().toISOString(),
      platform:      'ChainSeal Forensic Vault',
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
      changes:       data.changes || [],
      changeSummary: data.changeSummary,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `forensic-report-${data.fileId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Diff viewer theme ── */
  const diffStyles = {
    variables: {
      dark: {
        diffViewerBackground:      '#0a0e17',
        diffViewerColor:           '#e2e8f0',
        addedBackground:           'rgba(20,184,166,0.12)',
        addedColor:                '#d1fae5',
        removedBackground:         'rgba(239,68,68,0.12)',
        removedColor:              '#fecaca',
        wordAddedBackground:       'rgba(20,184,166,0.38)',
        wordRemovedBackground:     'rgba(239,68,68,0.38)',
        addedGutterBackground:     'rgba(20,184,166,0.2)',
        removedGutterBackground:   'rgba(239,68,68,0.2)',
        gutterBackground:          '#070b12',
        gutterColor:               '#475569',
        codeFoldBackground:        '#0f1623',
        codeFoldGutterBackground:  '#0f1623',
        codeFoldContentColor:      '#64748b',
        emptyLineBackground:       '#070b12',
        highlightBackground:       'rgba(245,158,11,0.12)',
        highlightGutterBackground: 'rgba(245,158,11,0.2)',
      },
    },
    line:   { fontFamily: 'monospace', fontSize: '12px' },
    gutter: { minWidth: '40px' },
  };

  const isCritical  = data?.riskLevel === 'CRITICAL' || data?.riskLevel === 'HIGH';
  const isBinary    = data?.isBinary;
  const canRestore  = (data?.status === 'tampered' || !data?.isIdentical) && !restored;
  const origName    = data?.fileName || filename || fileId;

  return (
    <AnimatePresence>
      <motion.div
        className="forensic-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
            {data && !loading && <RiskRing score={data.riskScore} level={data.riskLevel} />}

            <div className="forensic-title-block">
              <div className="forensic-title">
                <h2><Microscope size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />Forensic Audit Report</h2>

                {/* Status badges */}
                {isCritical && !loading && (
                  <motion.span animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="badge badge-critical">
                    <ShieldAlert size={11} style={{ marginRight: 4 }} />TAMPER DETECTED
                  </motion.span>
                )}
                {data?.isIdentical && !loading && (
                  <span className="badge badge-valid">
                    <ShieldCheck size={11} style={{ marginRight: 4 }} />VERIFIED
                  </span>
                )}
                {restored && (
                  <span className="badge badge-restored">
                    <RotateCcw size={11} style={{ marginRight: 4 }} />RESTORED
                  </span>
                )}

                {/* Risk Level pill */}
                {data && !loading && (
                  <span className={`badge badge-risk-${(data.riskLevel || 'SECURE').toLowerCase()}`}>
                    RISK: {data.riskLevel}
                  </span>
                )}
              </div>
              <div className="forensic-subtitle">
                {origName}
                {data?.txHash && data.txHash !== 'pending' && (
                  <> &middot; TX: {data.txHash.slice(0, 16)}...</>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="forensic-tabs">
              {[
                { key: 'diff',    label: <span><Activity size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Diff</span>,    hidden: isBinary },
                { key: 'preview', label: <span><FileSearch size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Preview</span> },
                { key: 'info',    label: <span><FileText size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Info</span> },
              ].filter(t => !t.hidden).map(({ key, label }) => (
                <button key={key} className={`forensic-tab ${tab === key ? 'active' : ''}`}
                  onClick={() => setTab(key)}>{label}</button>
              ))}
            </div>

            <button onClick={onClose} className="forensic-close"><X size={20} /></button>
          </div>

          {/* ── Restore Success Banner ── */}
          {restored && (
            <RestoreBanner fileName={origName} />
          )}

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
                  <RefreshCw size={14} style={{ marginRight: 6 }} />Retry
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
                        <h3>Binary Forensic Comparison Unavailable</h3>
                        <p>Text diff is not available for <code>{data.mimeType}</code> files. Use the <strong>Preview</strong> tab.</p>
                      </div>
                    ) : data.isIdentical ? (
                      <div className="forensic-no-diff forensic-identical">
                        <div className="forensic-no-diff-icon"><CheckCircle2 size={32} /></div>
                        <h3>Files Are Identical</h3>
                        <p>The current file matches the original blockchain-sealed version. No tampering detected.</p>
                      </div>
                    ) : (
                      <>
                        {/* Changes Summary Card */}
                        {data.changes?.length > 0 && (
                          <div className="forensic-changes-summary">
                            <div className="forensic-changes-header">
                              <AlertTriangle size={15} style={{ color: '#ef4444' }} />
                              <span>Exact Changes Detected ({data.changes.length})</span>
                            </div>
                            <div className="forensic-changes-list">
                              {data.changes.map((ch, i) => (
                                <div key={i} className={`forensic-change-item change-${ch.type}`}>
                                  <div className="forensic-change-meta">
                                    <span className={`change-type-badge type-${ch.type}`}>{ch.type}</span>
                                    <span className="change-line-num">Line {ch.line}</span>
                                  </div>
                                  {ch.before && (
                                    <div className="change-line removed-line">
                                      <span className="diff-glyph">−</span>
                                      <code>{ch.before}</code>
                                    </div>
                                  )}
                                  {ch.after && (
                                    <div className="change-line added-line">
                                      <span className="diff-glyph">+</span>
                                      <code>{ch.after}</code>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Side-by-side diff viewer with clear labels */}
                        <ReactDiffViewer
                          oldValue={data.original || ''}
                          newValue={data.modified || ''}
                          splitView={true}
                          compareMethod={DiffMethod.WORDS}
                          useDarkTheme={true}
                          styles={diffStyles}
                          leftTitle={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Lock size={13} style={{ color: '#14b8a6' }} />
                              <span style={{ color: '#14b8a6', fontWeight: 800 }}>ORIGINAL SECURED FILE</span>
                              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>— Blockchain Verified</span>
                            </span>
                          }
                          rightTitle={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <AlertTriangle size={13} style={{ color: '#ef4444' }} />
                              <span style={{ color: '#ef4444', fontWeight: 800 }}>TAMPERED FILE</span>
                              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>— Suspicious Copy</span>
                            </span>
                          }
                          hideLineNumbers={false}
                        />
                      </>
                    )}
                  </div>
                )}

                {/* ── PREVIEW TAB ── */}
                {tab === 'preview' && (
                  <div className="forensic-preview-wrap">
                    <TextPreviewPane
                      content={data.original}
                      label="ORIGINAL SECURED FILE"
                      side="original"
                    />
                    <TextPreviewPane
                      content={data.modified}
                      label="TAMPERED FILE"
                      side="tampered"
                    />
                  </div>
                )}

                {/* ── INFO TAB ── */}
                {tab === 'info' && (
                  <div className="forensic-info-wrap">
                    <div className="forensic-info-title">
                      <FileText size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                      File Intelligence Report
                    </div>

                    {[
                      { label: 'File ID',        val: data.fileId },
                      { label: 'Filename',       val: data.fileName },
                      { label: 'MIME Type',      val: data.mimeType },
                      { label: 'File Size',      val: data.fileSize ? `${(data.fileSize / 1024).toFixed(1)} KB` : '--' },
                      { label: 'Status',         val: data.status?.toUpperCase() },
                      { label: 'Risk Score',     val: `${data.riskScore}/100 — ${data.riskLevel}` },
                      { label: 'Integrity',      val: data.isIdentical
                          ? <span style={{ color: '#14b8a6' }}><CheckCircle2 size={12} /> Identical — No tampering</span>
                          : <span style={{ color: '#ef4444' }}><X size={12} /> Modified — Tampering detected</span> },
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

                    {data.txHash && data.txHash !== 'pending' && data.txHash.startsWith('0x') && (
                      <a href={`https://sepolia.etherscan.io/tx/${data.txHash}`}
                        target="_blank" rel="noreferrer" className="forensic-etherscan-link">
                        <Link size={14} style={{ marginRight: 6 }} />
                        View Blockchain Proof on Etherscan
                        <ExternalLink size={12} style={{ marginLeft: 4 }} />
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
              <div className="forensic-footer-left">
                <span className="forensic-footer-filename">{data.fileName || filename}</span>
                <span className={`badge badge-${data.status || 'pending'}`}>
                  {data.status?.toUpperCase()}
                </span>
              </div>

              <div className="forensic-footer-actions">
                {/* Download Evidence JSON */}
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={handleDownloadEvidence} className="btn-evidence">
                  <Download size={15} style={{ marginRight: 7 }} />Download Evidence
                </motion.button>

                {/* Etherscan */}
                {data.txHash && data.txHash !== 'pending' && data.txHash.startsWith('0x') && (
                  <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    href={`https://sepolia.etherscan.io/tx/${data.txHash}`}
                    target="_blank" rel="noreferrer" className="btn-blockchain">
                    <Link size={15} style={{ marginRight: 7 }} />Blockchain Proof
                  </motion.a>
                )}

                {/* Restore — only for tampered files, not after restore done */}
                {canRestore && (
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    disabled={restoring} onClick={handleRestore} className="btn-restore">
                    {restoring
                      ? <Clock size={15} className="spin" style={{ marginRight: 7 }} />
                      : <RotateCcw size={15} style={{ marginRight: 7 }} />}
                    {restoring ? 'Restoring...' : 'Restore Original'}
                  </motion.button>
                )}

                <button onClick={onClose} className="btn-close-modal">Close</button>
              </div>
            </div>
          )}

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
