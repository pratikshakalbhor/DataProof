/**
 * ForensicModal.jsx — Enterprise Forensic Audit Platform
 * Forensic comparison modal with professional diff, restore workflow,
 * and clear ORIGINAL / TAMPERED labeling.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Microscope, CheckCircle2, AlertTriangle, RefreshCw,
  FileText, X, Link, ExternalLink, Download, Clock,
  FileSearch, Activity, ShieldCheck, ShieldAlert, RotateCcw
} from 'lucide-react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import mammoth from 'mammoth';
import '../styles/ForensicModal.css';

/**
 * Environment Variable Connection:
 * File: components/ForensicModal.jsx
 * Uses process.env.REACT_APP_API_URL to fetch forensic data.
 * Security Benefit: Avoids hardcoding server IPs, making the UI portable and easier to deploy.
 */
const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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

  const [origText, setOrigText] = useState('');
  const [modText,  setModText]  = useState('');
  const [extracting, setExtracting] = useState(false);

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
      if (json.isBinary && !json.filename?.endsWith('.docx')) setTab('preview');
    } catch (e) {
      setError(e.message || 'Failed to load forensic data');
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── mammoth text extraction ── */
  useEffect(() => {
    if (!data) return;
    
    const isDocx = data.mimeType?.includes('wordprocessingml') ||
                   data.filename?.endsWith('.docx');
    
    if (isDocx && data.isBinary) {
      // Use mammoth to extract text in browser
      setExtracting(true);
      
      const extractText = async (base64DataURL) => {
        if (!base64DataURL) return '';
        // Handle case if data URL doesn't have a comma, or is raw base64
        const parts = base64DataURL.split(',');
        const base64 = parts.length > 1 ? parts[1] : parts[0];
        const binary = atob(base64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const result = await mammoth.extractRawText({
          arrayBuffer: bytes.buffer
        });
        return result.value;
      };
      
      Promise.all([
        extractText(data.original),
        extractText(data.modified),
      ]).then(([orig, mod]) => {
        setOrigText(orig);
        setModText(mod);
        setExtracting(false);
      }).catch(err => {
        console.error('mammoth error:', err);
        setExtracting(false);
      });
    } else {
      // Already plain text
      setOrigText(data.original || '');
      setModText(data.modified  || '');
    }
  }, [data]);

  /* ── Restore: overwrite vault with backup, then download RESTORED_ file ── */
  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await fetch(`${API}/restore/${encodeURIComponent(fileId)}`, { method: 'POST' });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
        throw new Error(msg);
      }

      // Download the restored original — named RESTORED_<filename>
      const originalName = data?.fileName || filename || 'file';
      const downloadName = `RESTORED_${originalName}`;
      
      // Use the blob directly from the restoration response
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

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

  const isDocx = data?.mimeType?.includes('wordprocessingml') ||
                 data?.filename?.endsWith('.docx') ||
                 data?.fileName?.endsWith('.docx');

  const isCritical        = data?.riskLevel === 'CRITICAL' || data?.riskLevel === 'HIGH';
  const isBinary          = data?.isBinary && !isDocx;
  const tamperedAvailable = data?.tamperedAvailable !== false;
  const canRestore        = (data?.status === 'tampered' || !data?.isIdentical) && !restored && tamperedAvailable;
  const origName          = data?.fileName || filename || fileId;
  const hasBothTexts      = origText && modText && origText !== modText;

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
                    {extracting && (
                      <div style={{textAlign:'center', padding:40, color:'#64748b'}}>
                        ⏳ Extracting text from .docx for comparison...
                      </div>
                    )}

                    {/* No tampered version uploaded yet */}
                    {!extracting && !tamperedAvailable && (
                      <div className="forensic-no-diff forensic-no-tampered">
                        <div style={{
                          width: 56, height: 56, borderRadius: '50%',
                          background: 'rgba(245,158,11,0.12)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
                        }}>
                          <AlertTriangle size={28} style={{ color: '#f59e0b' }} />
                        </div>
                        <h3 style={{ color: '#f59e0b', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
                          No Tampered Version Available
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>
                          {data.tamperedMessage || 'No tampered version has been detected yet.'}
                          <br />
                          To see a forensic diff, go to <strong style={{ color: '#e2e8f0' }}>Verify</strong> and
                          upload a modified copy of this file. If tampering is detected, the diff will appear here.
                        </p>
                      </div>
                    )}

                    {/* Non-text file type */}
                    {!extracting && tamperedAvailable && !data.isTextComparable && !isDocx && (
                      <div style={{textAlign:'center', padding:40, color:'#64748b'}}>
                        📄 Diff not available for {data.mimeType}
                        <br />Use Preview tab instead.
                      </div>
                    )}

                    {/* Files are identical */}
                    {!extracting && tamperedAvailable && (data.isTextComparable || isDocx) && data.isIdentical && (
                      <div className="forensic-no-diff forensic-identical">
                        <div className="forensic-no-diff-icon"><CheckCircle2 size={32} /></div>
                        <h3>Files Are Identical</h3>
                        <p>The current file matches the original blockchain-sealed version. No tampering detected.</p>
                      </div>
                    )}

                    {/* Word-level diff viewer — only when both texts exist and differ */}
                    {!extracting && tamperedAvailable && hasBothTexts && (
                      <ReactDiffViewer
                        oldValue={origText}
                        newValue={modText}
                        splitView={true}
                        compareMethod={DiffMethod.WORDS}
                        useDarkTheme={true}
                        leftTitle="🔒 Original (Blockchain Sealed)"
                        rightTitle="⚠️ Tampered Version"
                        styles={{
                          variables: {
                            dark: {
                              diffViewerBackground:    '#0d1117',
                              diffViewerColor:         '#e2e8f0',
                              addedBackground:         'rgba(20,184,166,0.15)',
                              addedColor:              '#d1fae5',
                              removedBackground:       'rgba(239,68,68,0.15)',
                              removedColor:            '#fecaca',
                              wordAddedBackground:     'rgba(20,184,166,0.5)',
                              wordRemovedBackground:   'rgba(239,68,68,0.5)',
                              addedGutterBackground:   'rgba(20,184,166,0.2)',
                              removedGutterBackground: 'rgba(239,68,68,0.2)',
                              gutterBackground:        '#0a0f1a',
                              gutterColor:             '#475569',
                            }
                          },
                          line:   { fontFamily: 'monospace', fontSize: '12px' },
                          gutter: { minWidth: '40px' },
                        }}
                      />
                    )}
                  </div>
                )}

                {/* ── PREVIEW TAB ── */}
                {tab === 'preview' && (
                  <div className="forensic-preview-wrap">
                    <TextPreviewPane
                      content={origText || data.original}
                      label="ORIGINAL SECURED FILE"
                      side="original"
                    />
                    {tamperedAvailable ? (
                      <TextPreviewPane
                        content={modText || data.modified}
                        label="TAMPERED FILE"
                        side="tampered"
                      />
                    ) : (
                      <div className={`forensic-preview-pane modified`}>
                        <div className="forensic-preview-label">
                          <span className="forensic-preview-dot" />
                          <span className="forensic-preview-label-text">TAMPERED FILE</span>
                          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800,
                            color: '#f59e0b', letterSpacing: '0.08em' }}>
                            NOT YET AVAILABLE
                          </span>
                        </div>
                        <div className="forensic-preview-content" style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          minHeight: 200
                        }}>
                          <div style={{ textAlign: 'center', color: '#64748b' }}>
                            <AlertTriangle size={24} style={{ color: '#f59e0b', marginBottom: 8 }} />
                            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                              No tampered version detected yet.<br />
                              Use <strong style={{ color: '#e2e8f0' }}>Verify</strong> with a modified file.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
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
