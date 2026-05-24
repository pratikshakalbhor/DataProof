/**
 * ForensicModal.jsx — Word-level diff highlighting
 * Handles docx word-level changes (not just line-level)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Microscope, AlertTriangle, RefreshCw,
  FileText, X, Link, ExternalLink,
  FileSearch, Activity, ShieldCheck, ShieldAlert, RotateCcw
} from 'lucide-react';
import '../styles/ForensicModal.css';

const API = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api')
  .replace(/\/api\/?$/, '') + '/api';

// ── Risk Ring ─────────────────────────────────────────────────
function RiskRing({ score, level }) {
  const r    = 36;
  const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  const colors = {
    SECURE:'#14b8a6', LOW:'#f59e0b', MEDIUM:'#f97316',
    HIGH:'#ef4444', CRITICAL:'#dc2626',
  };
  const color = colors[level] || colors.SECURE;
  return (
    <div className="risk-ring-wrap">
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={r} fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth={7}/>
        <circle cx={45} cy={45} r={r} fill="none" stroke={color}
          strokeWidth={7} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={fill}
          transform="rotate(-90 45 45)"
          style={{transition:'stroke-dashoffset 1s ease'}}/>
        <text x={45} y={49} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={16} fontWeight={800}
          fontFamily="monospace">{score}</text>
      </svg>
      <span className="risk-ring-label" style={{color}}>{level}</span>
    </div>
  );
}

// ── Word-level diff algorithm ─────────────────────────────────
function computeWordDiff(oldStr, newStr) {
  const oldWords = oldStr.split(/(\s+)/);
  const newWords = newStr.split(/(\s+)/);

  // LCS-based word diff
  const m = oldWords.length;
  const n = newWords.length;

  // Build LCS table
  const dp = Array.from({length: m + 1}, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i-1] === newWords[j-1]) {
        dp[i][j] = dp[i-1][j-1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
      }
    }
  }

  // Backtrack to get diff
  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i-1] === newWords[j-1]) {
      result.unshift({type: 'same', word: oldWords[i-1]});
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      result.unshift({type: 'added', word: newWords[j-1]});
      j--;
    } else {
      result.unshift({type: 'removed', word: oldWords[i-1]});
      i--;
    }
  }
  return result;
}

// ── Render text with word highlights ─────────────────────────
function HighlightedText({ text, otherText, side }) {
  if (!text || !otherText) {
    return <span style={{color: '#94a3b8'}}>{text}</span>;
  }

  // We always want to compare orig vs tamp
  // computeWordDiff(orig, tamp)
  const wordDiff = computeWordDiff(
    side === 'orig' ? text : otherText,
    side === 'orig' ? otherText : text,
  );

  return (
    <>
      {wordDiff.map((item, idx) => {
        // Unchanged text looks the same on both sides
        if (item.type === 'same') {
          return <span key={idx} style={{color:'#cbd5e1'}}>{item.word}</span>;
        }

        // LEFT PANEL (Original): Highlight words that were removed/changed
        if (side === 'orig' && item.type === 'removed') {
          return (
            <span key={idx} style={{
              background: 'rgba(245, 158, 11, 0.2)', // Soft Amber
              color: '#fcd34d', 
              borderRadius: 3,
              padding: '1px 3px',
              fontWeight: 700,
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}>
              {item.word}
            </span>
          );
        }

        // RIGHT PANEL (Tampered): Highlight words that were added/modified
        if (side === 'tamp' && item.type === 'added') {
          return (
            <span key={idx} style={{
              background: 'rgba(20, 184, 166, 0.2)', // Soft Green
              color: '#6ee7b7', 
              borderRadius: 3,
              padding: '1px 3px',
              fontWeight: 700,
              border: '1px solid rgba(20, 184, 166, 0.3)',
            }}>
              {item.word}
            </span>
          );
        }

        // Hide words that don't belong to the respective side
        if (side === 'orig' && item.type === 'added') return null;
        if (side === 'tamp' && item.type === 'removed') return null;

        return <span key={idx} style={{color:'#cbd5e1'}}>{item.word}</span>;
      })}
    </>
  );
}

// ── Line-by-line diff with word highlighting ─────────────────
function LineDiffWithWordHighlight({ origText, tampText, changes, origName, tampName }) {
  const [viewMode, setViewMode] = useState('side'); // side | lines | summary

  const origLines = origText?.split('\n') || [];
  const tampLines = tampText?.split('\n') || [];

  const maxLen = Math.max(origLines.length, tampLines.length);

  // Determine which lines differ
  const diffLines = [];
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i] ?? '';
    const t = tampLines[i] ?? '';
    if (o !== t) {
      const type = !o ? 'added' : !t ? 'removed' : 'modified';
      diffLines.push({ lineNum: i+1, orig: o, tamp: t, type });
    }
  }

  return (
    <div>
      {/* Summary banner */}
      <div style={{
        background:'rgba(234,179,8,.08)',
        border:'1px solid rgba(234,179,8,.25)',
        borderRadius:10, padding:'12px 16px', marginBottom:14,
      }}>
        <div style={{fontSize:11, fontWeight:800, color:'#facc15',
          textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6}}>
          ⚠️ Forensic Analysis Summary
        </div>
        <p style={{color:'#cbd5e1', fontSize:12, lineHeight:1.7, margin:0}}>
          Blockchain integrity check <strong style={{color:'#f87171'}}>failed</strong>.{' '}
          <strong style={{color:'#f87171', background:'rgba(239,68,68,.2)',
            padding:'1px 5px', borderRadius:3}}>Red strikethrough</strong> = removed words,{' '}
          <strong style={{color:'#6ee7b7', background:'rgba(20,184,166,.2)',
            padding:'1px 5px', borderRadius:3}}>Green highlight</strong> = added/changed words.
        </p>
      </div>

      {/* Stats */}
      <div style={{display:'flex', gap:10, marginBottom:12, flexWrap:'wrap', alignItems:'center'}}>
        <span style={{fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
          background:'rgba(239,68,68,.15)', color:'#f87171',
          border:'1px solid rgba(239,68,68,.3)'}}>
          {diffLines.length} line{diffLines.length!==1?'s':''} changed
        </span>
        <span style={{fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
          background:'rgba(20,184,166,.1)', color:'#14b8a6',
          border:'1px solid rgba(20,184,166,.3)'}}>
          {origLines.length} → {tampLines.length} lines total
        </span>

        {/* View toggle */}
        <div style={{marginLeft:'auto', display:'flex', gap:4}}>
          {[
            {key:'side',    label:'Side by Side'},
            {key:'lines',   label:`Changed Lines (${diffLines.length})`},
          ].map(t => (
            <button key={t.key} onClick={()=>setViewMode(t.key)} style={{
              padding:'4px 12px', borderRadius:7, border:'none', cursor:'pointer',
              background: viewMode===t.key ? 'rgba(255,255,255,.1)' : 'transparent',
              color: viewMode===t.key ? '#e2e8f0' : '#64748b',
              fontSize:11, fontWeight:600, fontFamily:'inherit',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── SIDE BY SIDE VIEW ── */}
      {viewMode === 'side' && (
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr',
          gap:0, border:'1px solid #1e293b', borderRadius:10, overflow:'hidden',
        }}>
          {/* Original header */}
          <div style={{
            padding:'8px 14px',
            background:'rgba(20,184,166,.08)',
            borderBottom:'1px solid rgba(20,184,166,.2)',
            borderRight:'1px solid #1e293b',
          }}>
            <div style={{fontSize:10, fontWeight:800, color:'#14b8a6',
              textTransform:'uppercase', letterSpacing:'.08em'}}>
              ✅ Original (Blockchain Sealed)
            </div>
            <div style={{fontSize:9, color:'#475569', fontFamily:'monospace', marginTop:2}}>
              {origName}
            </div>
          </div>

          {/* Tampered header */}
          <div style={{
            padding:'8px 14px',
            background:'rgba(239,68,68,.06)',
            borderBottom:'1px solid rgba(239,68,68,.2)',
          }}>
            <div style={{fontSize:10, fontWeight:800, color:'#ef4444',
              textTransform:'uppercase', letterSpacing:'.08em'}}>
              🔴 Tampered (Modified)
            </div>
            <div style={{fontSize:9, color:'#475569', fontFamily:'monospace', marginTop:2}}>
              {tampName}
            </div>
          </div>

          {/* Line rows */}
          {Array.from({length: maxLen}, (_, i) => {
            const o = origLines[i] ?? '';
            const t = tampLines[i] ?? '';
            const changed = o !== t;
            const rowBg = changed
              ? 'rgba(234,179,8,.04)'
              : 'transparent';

            return (
              <React.Fragment key={i}>
                {/* Orig line */}
                <div style={{
                  padding:'3px 14px 3px 10px',
                  borderBottom:'1px solid #0f1f2e',
                  borderRight:'1px solid #1e293b',
                  background: changed ? 'rgba(239,68,68,.05)' : rowBg,
                  display:'flex', gap:8, alignItems:'flex-start',
                  minHeight:24,
                }}>
                  <span style={{
                    fontSize:9, color:'#334155', fontFamily:'monospace',
                    minWidth:24, paddingTop:1, flexShrink:0, userSelect:'none',
                  }}>{i+1}</span>
                  <span style={{
                    fontSize:12, fontFamily:'monospace', lineHeight:1.6,
                    wordBreak:'break-word', flex:1,
                  }}>
                    {changed ? (
                      <HighlightedText text={o} otherText={t} side="orig"/>
                    ) : (
                      <span style={{color:'#94a3b8'}}>{o}</span>
                    )}
                  </span>
                </div>

                {/* Tamp line */}
                <div key={`t${i}`} style={{
                  padding:'3px 14px 3px 10px',
                  borderBottom:'1px solid #0f1f2e',
                  background: changed ? 'rgba(20,184,166,.04)' : rowBg,
                  display:'flex', gap:8, alignItems:'flex-start',
                  minHeight:24,
                }}>
                  <span style={{
                    fontSize:9, color:'#334155', fontFamily:'monospace',
                    minWidth:24, paddingTop:1, flexShrink:0, userSelect:'none',
                  }}>{i+1}</span>
                  <span style={{
                    fontSize:12, fontFamily:'monospace', lineHeight:1.6,
                    wordBreak:'break-word', flex:1,
                  }}>
                    {changed ? (
                      <HighlightedText text={t} otherText={o} side="tamp"/>
                    ) : (
                      <span style={{color:'#94a3b8'}}>{t}</span>
                    )}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ── CHANGED LINES VIEW ── */}
      {viewMode === 'lines' && (
        <div style={{display:'flex', flexDirection:'column', gap:8, maxHeight:420, overflowY:'auto'}}>
          {diffLines.length === 0 ? (
            <div style={{textAlign:'center', padding:24, color:'#64748b', fontSize:12}}>
              No line-level differences detected
            </div>
          ) : diffLines.map((dl, i) => (
            <motion.div key={i}
              initial={{opacity:0, x:-8}} animate={{opacity:1, x:0}}
              transition={{delay:i*0.03}}
              style={{
                border:'1px solid rgba(234,179,8,.25)',
                borderLeft:'4px solid #facc15',
                borderRadius:8, overflow:'hidden',
                background:'rgba(234,179,8,.04)',
              }}>
              {/* Line number */}
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'5px 12px',
                borderBottom:'1px solid rgba(234,179,8,.15)',
              }}>
                <span style={{
                  fontSize:9, fontWeight:800, padding:'1px 8px', borderRadius:20,
                  background: dl.type === 'added' ? 'rgba(20,184,166,.15)'
                    : dl.type === 'removed' ? 'rgba(239,68,68,.15)'
                    : 'rgba(234,179,8,.15)',
                  color: dl.type === 'added' ? '#14b8a6'
                    : dl.type === 'removed' ? '#ef4444'
                    : '#facc15',
                  border: `1px solid ${dl.type === 'added' ? 'rgba(20,184,166,.3)'
                    : dl.type === 'removed' ? 'rgba(239,68,68,.3)'
                    : 'rgba(234,179,8,.3)'}`,
                  textTransform:'uppercase',
                }}>{dl.type.toUpperCase()}</span>
                <span style={{fontSize:10, color:'#64748b', fontFamily:'monospace'}}>
                  Line {dl.lineNum}
                </span>
              </div>

              {/* Original line with removed words struck */}
              {dl.orig !== undefined && (
                <div style={{
                  display:'flex', gap:8, padding:'6px 12px',
                  background:'rgba(239,68,68,.06)',
                  borderBottom:'1px solid rgba(239,68,68,.1)',
                }}>
                  <span style={{
                    color:'#ef4444', fontWeight:800, fontSize:14,
                    fontFamily:'monospace', flexShrink:0,
                  }}>−</span>
                  <code style={{
                    fontSize:12, fontFamily:'monospace', wordBreak:'break-all',
                    lineHeight:1.6, flex:1,
                  }}>
                    <HighlightedText text={dl.orig} otherText={dl.tamp} side="orig"/>
                  </code>
                </div>
              )}

              {/* Tampered line with added words highlighted */}
              {dl.tamp !== undefined && (
                <div style={{
                  display:'flex', gap:8, padding:'6px 12px',
                  background:'rgba(20,184,166,.05)',
                }}>
                  <span style={{
                    color:'#14b8a6', fontWeight:800, fontSize:14,
                    fontFamily:'monospace', flexShrink:0,
                  }}>+</span>
                  <code style={{
                    fontSize:12, fontFamily:'monospace', wordBreak:'break-all',
                    lineHeight:1.6, flex:1,
                  }}>
                    <HighlightedText text={dl.tamp} otherText={dl.orig} side="tamp"/>
                  </code>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}



// ── Main Modal ────────────────────────────────────────────────
export default function ForensicModal({ fileId, filename, onClose, onRestored }) {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [tab,       setTab]       = useState('diff');
  const [restoring, setRestoring] = useState(false);
  const [restored,  setRestored]  = useState(false);

  const fetchData = useCallback(async () => {
    if (!fileId) { setError('No file ID'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(
        `${API}/file/forensic-compare/${encodeURIComponent(fileId)}`
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); msg = j.error || msg; } catch(_) {}
        throw new Error(msg);
      }
      const json = await res.json();
      console.log('[ForensicModal] API Response:', {
        tamperedAvailable: json.tamperedAvailable,
        origTextLen: json.originalText?.length,
        tampTextLen: json.tamperedText?.length,
        origHash: json.originalHash?.slice(0,16),
        tampHash: json.modifiedHash?.slice(0,16),
        isIdentical: json.isIdentical,
        changesCount: json.changes?.length,
        sameContent: json.originalText === json.tamperedText,
      });
      setData(json);
      setTab(json.isBinary && !json.isTextComparable ? 'preview' : 'diff');
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await fetch(
        `${API}/restore/${encodeURIComponent(fileId)}`,
        { method: 'POST' }
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); msg = j.error || msg; } catch(_){}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `RESTORED_${data?.fileName || filename}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      setRestored(true); onRestored?.(); await fetchData();
    } catch(e) {
      setError('Restore failed: ' + e.message);
    } finally {
      setRestoring(false);
    }
  };



  // Resolve clean text
  const origText  = data?.originalText || data?.original || '';
  const tampText  = data?.tamperedText  || data?.modified  || '';
  const origClean = origText?.startsWith('data:') ? '' : origText;
  const tampClean = tampText?.startsWith('data:') ? '' : tampText;

  const changes          = data?.changes || data?.diff || [];
  const isCritical        = data?.riskLevel === 'CRITICAL' || data?.riskLevel === 'HIGH';
  const canRestore        = (data?.status === 'tampered' || !data?.isIdentical)
                            && !restored && data?.tamperedAvailable !== false;
  const origName  = data?.fileName || filename || fileId;
  const tampName  = `${origName} (modified)`;

  return (
    <AnimatePresence>
      <motion.div className="forensic-overlay"
        initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        onClick={e => e.target===e.currentTarget && onClose()}>

        <motion.div
          className={`forensic-modal ${isCritical?'critical':''}`}
          initial={{opacity:0, scale:0.94, y:30}}
          animate={{opacity:1, scale:1, y:0}}
          exit={{opacity:0, scale:0.96}}
          transition={{duration:0.25}}>

          {/* Header */}
          <div className={`forensic-header ${isCritical?'critical':''}`}>
            {data && !loading && (
              <RiskRing score={data.riskScore} level={data.riskLevel}/>
            )}
            <div className="forensic-title-block">
              <div className="forensic-title">
                <h2>
                  <Microscope size={18} style={{verticalAlign:'middle',marginRight:8}}/>
                  Forensic Audit Report
                </h2>
                {isCritical && !loading && (
                  <motion.span animate={{opacity:[1,.5,1]}}
                    transition={{duration:1.2, repeat:Infinity}}
                    className="badge badge-critical">
                    <ShieldAlert size={11} style={{marginRight:4}}/>TAMPER DETECTED
                  </motion.span>
                )}
                {data?.isIdentical && !loading && (
                  <span className="badge badge-valid">
                    <ShieldCheck size={11} style={{marginRight:4}}/>VERIFIED
                  </span>
                )}
                {restored && (
                  <span className="badge badge-restored">
                    <RotateCcw size={11} style={{marginRight:4}}/>RESTORED
                  </span>
                )}
                {data && !loading && (
                  <span className={`badge badge-risk-${(data.riskLevel||'SECURE').toLowerCase()}`}>
                    RISK: {data.riskLevel}
                  </span>
                )}
              </div>
              <div className="forensic-subtitle">
                {origName}
                {data?.txHash && data.txHash !== 'pending' && (
                  <> · TX: {data.txHash.slice(0,16)}...</>
                )}
              </div>
            </div>

            <div className="forensic-tabs">
              {[
                {key:'diff',    label:<><Activity size={13} style={{verticalAlign:'middle',marginRight:4}}/>Diff</>},
                {key:'preview', label:<><FileSearch size={13} style={{verticalAlign:'middle',marginRight:4}}/>Preview</>},
                {key:'info',    label:<><FileText size={13} style={{verticalAlign:'middle',marginRight:4}}/>Info</>},
              ].map(({key, label}) => (
                <button key={key}
                  className={`forensic-tab ${tab===key?'active':''}`}
                  onClick={()=>setTab(key)}>
                  {label}
                </button>
              ))}
            </div>

            <button onClick={onClose} className="forensic-close">
              <X size={20}/>
            </button>
          </div>

          {/* Restore success banner */}
          {restored && (
            <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
              style={{
                padding:'12px 18px', background:'rgba(20,184,166,.08)',
                border:'1px solid rgba(20,184,166,.3)',
                display:'flex', alignItems:'center', gap:10, flexShrink:0,
              }}>
              <ShieldCheck size={18} color="#14b8a6"/>
              <div>
                <div style={{fontSize:13, fontWeight:800, color:'#14b8a6'}}>
                  Original file restored
                </div>
                <div style={{fontSize:11, color:'#94a3b8', marginTop:2}}>
                  RESTORED_{origName} downloaded to your computer
                </div>
              </div>
            </motion.div>
          )}

          {/* Body */}
          <div className="forensic-body">

            {loading && (
              <div className="forensic-loading">
                <div className="forensic-spinner"/>
                Generating forensic comparison...
              </div>
            )}

            {!loading && error && (
              <div className="forensic-error">
                <div className="forensic-error-icon">
                  <AlertTriangle size={32}/>
                </div>
                <div className="forensic-error-message">{error}</div>
                <button className="forensic-retry-btn" onClick={fetchData}>
                  <RefreshCw size={14} style={{marginRight:6}}/>Retry
                </button>
                <div className="forensic-error-hint">
                  <strong>Possible causes:</strong>
                  <ul>
                    <li>File not saved locally during upload</li>
                    <li>Tampered file not saved to vault during Verify</li>
                    <li>Backend server not running</li>
                    <li>Route /api/file/forensic-compare/:fileId missing</li>
                  </ul>
                </div>
              </div>
            )}

            {!loading && !error && data && (
              <>
                {/* DIFF TAB */}
                {tab === 'diff' && (
                  <div className="forensic-diff-wrap">
                    {!data.tamperedAvailable ? (
                      <div style={{textAlign:'center', padding:40}}>
                        <div style={{
                          width:56, height:56, borderRadius:'50%',
                          background:'rgba(245,158,11,.12)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          margin:'0 auto 16px',
                        }}>
                          <AlertTriangle size={28} color="#f59e0b"/>
                        </div>
                        <h3 style={{color:'#f59e0b', fontSize:15, fontWeight:700, marginBottom:8}}>
                          No Tampered Version Available
                        </h3>
                        <p style={{color:'#94a3b8', fontSize:12, lineHeight:1.7,
                          maxWidth:420, margin:'0 auto'}}>
                          {data.tamperedMessage ||
                            'Go to Verify page and upload a modified copy of this file.'}
                        </p>
                      </div>
                    ) : origClean && tampClean ? (
                      <LineDiffWithWordHighlight
                        origText={origClean}
                        tampText={tampClean}
                        changes={changes}
                        origName={origName}
                        tampName={tampName}
                      />
                    ) : (
                      <div style={{textAlign:'center', padding:40, color:'#64748b', fontSize:12}}>
                        📄 Text extraction unavailable. Use Preview tab.
                      </div>
                    )}
                  </div>
                )}

                {/* PREVIEW TAB */}
                {tab === 'preview' && (
                  <div className="forensic-preview-wrap">
                    <div className="forensic-preview-pane original">
                      <div className="forensic-preview-label">
                        <span className="forensic-preview-dot"/>
                        <span className="forensic-preview-label-text">ORIGINAL SECURED FILE</span>
                        <span style={{marginLeft:'auto', fontSize:9, fontWeight:800,
                          background:'rgba(20,184,166,.15)', color:'#14b8a6',
                          padding:'2px 8px', borderRadius:4}}>
                          ✅ BLOCKCHAIN SEALED
                        </span>
                      </div>
                      <div className="forensic-preview-content">
                        {origClean
                          ? <pre>{origClean}</pre>
                          : <div className="binary-evidence-card">
                              <Shield size={24} color="#38bdf8" style={{marginBottom:10}}/>
                              <div style={{fontSize:12, color:'#94a3b8'}}>
                                Text unavailable — use Diff tab
                              </div>
                            </div>
                        }
                      </div>
                    </div>

                    <div style={{width:1, background:'rgba(239,68,68,.2)',
                      margin:'0 4px', flexShrink:0}}/>

                    <div className="forensic-preview-pane modified">
                      <div className="forensic-preview-label">
                        <span className="forensic-preview-dot"/>
                        <span className="forensic-preview-label-text">TAMPERED FILE</span>
                        {!data.tamperedAvailable
                          ? <span style={{marginLeft:'auto', fontSize:9, fontWeight:800,
                              color:'#f59e0b'}}>NOT YET AVAILABLE</span>
                          : <span style={{marginLeft:'auto', fontSize:9, fontWeight:800,
                              background:'rgba(239,68,68,.15)', color:'#ef4444',
                              padding:'2px 8px', borderRadius:4}}>
                              🔴 MODIFIED
                            </span>
                        }
                      </div>
                      <div className="forensic-preview-content">
                        {!data.tamperedAvailable
                          ? <div style={{display:'flex', alignItems:'center',
                              justifyContent:'center', minHeight:200,
                              color:'#64748b', flexDirection:'column', gap:8}}>
                              <AlertTriangle size={24} color="#f59e0b"/>
                              <div style={{fontSize:12, textAlign:'center', lineHeight:1.6}}>
                                No tampered version yet.<br/>
                                Use <strong style={{color:'#e2e8f0'}}>Verify</strong> with modified file.
                              </div>
                            </div>
                          : tampClean
                            ? <pre>{tampClean}</pre>
                            : <div className="binary-evidence-card">
                                <Shield size={24} color="#ef4444" style={{marginBottom:10}}/>
                                <div style={{fontSize:12, color:'#94a3b8'}}>
                                  Text unavailable — use Diff tab
                                </div>
                              </div>
                        }
                      </div>
                    </div>
                  </div>
                )}

                {/* INFO TAB */}
                {tab === 'info' && (
                  <div className="forensic-info-wrap">
                    <div className="forensic-info-title">
                      <FileText size={16} style={{verticalAlign:'middle', marginRight:8}}/>
                      File Intelligence Report
                    </div>
                    {[
                      {label:'File ID',       val: data.fileId},
                      {label:'Filename',      val: data.fileName},
                      {label:'MIME Type',     val: data.mimeType},
                      {label:'File Size',     val: data.fileSize
                        ? `${(data.fileSize/1024).toFixed(1)} KB` : '--'},
                      {label:'Status',        val: data.status?.toUpperCase()},
                      {label:'Risk Score',    val: `${data.riskScore}/100 — ${data.riskLevel}`},
                      {label:'Integrity',     val: data.isIdentical
                        ? '✅ Identical' : '❌ Tampered'},
                      {label:'Original Hash', val: data.originalHash},
                      {label:'Modified Hash', val: data.modifiedHash},
                      {label:'TX Hash',       val: data.txHash},
                      {label:'Wallet',        val: data.walletAddress},
                      {label:'Uploaded',      val: data.uploadedAt
                        ? new Date(data.uploadedAt).toLocaleString() : '--'},
                    ].map(({label, val}) => (
                      <div key={label} className="forensic-info-row">
                        <span className="forensic-info-label">{label}</span>
                        <span className="forensic-info-value">{val||'--'}</span>
                      </div>
                    ))}
                    {data.txHash && data.txHash!=='pending' && data.txHash.startsWith('0x') && (
                      <a href={`https://sepolia.etherscan.io/tx/${data.txHash}`}
                        target="_blank" rel="noreferrer"
                        className="forensic-etherscan-link">
                        <Link size={13} style={{marginRight:6}}/>
                        View Blockchain Proof on Etherscan
                        <ExternalLink size={11} style={{marginLeft:4}}/>
                      </a>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!loading && !error && data && (
            <div className="forensic-footer">
              <div className="forensic-footer-left">
                <span className="forensic-footer-filename">
                  {data.fileName || filename}
                </span>
                <span className={`badge badge-${data.status||'pending'}`}>
                  {data.status?.toUpperCase()}
                </span>
              </div>
              <div className="forensic-footer-actions">

                {data.txHash && data.txHash!=='pending' && data.txHash.startsWith('0x') && (
                  <motion.a whileHover={{scale:1.03}} whileTap={{scale:0.97}}
                    href={`https://sepolia.etherscan.io/tx/${data.txHash}`}
                    target="_blank" rel="noreferrer" className="btn-blockchain">
                    <Link size={14} style={{marginRight:6}}/>Blockchain Proof
                  </motion.a>
                )}
                {canRestore && (
                  <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
                    disabled={restoring} onClick={handleRestore} className="btn-restore">
                    {restoring
                      ? <><RefreshCw size={14} style={{marginRight:6,
                          animation:'spin 1s linear infinite'}}/>Restoring...</>
                      : <><RotateCcw size={14} style={{marginRight:6}}/>Restore Original</>
                    }
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
