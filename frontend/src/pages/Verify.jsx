import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, ShieldCheck, ShieldAlert, AlertTriangle, 
  Check, X, FlaskConical, Lock, 
  RefreshCw, FileText
} from 'lucide-react';
import { pageVariants, cardVariants } from '../utils/animations';
import { verifyFileOnChain } from '../utils/blockchain';
import '../styles/Verify.css';

const API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api$/, '') + '/api';

const AUDIT_STEPS = [
  'Reading file bytes...',
  'Generating SHA-256 fingerprint...',
  'Fetching vault record...',
  'Comparing hashes...',
  'Verifying blockchain seal...',
];

const riskColor = (score) => {
  if (score >= 80) return 'var(--accent-red)';
  if (score >= 50) return 'var(--accent-orange)';
  return 'var(--accent-teal)';
};

export default function Verify({ walletAddress, onNotify }) {
  const [vaultFiles,    setVaultFiles]    = useState([]);
  const [showVaultPick, setShowVaultPick] = useState(false);
  const [vaultFile,     setVaultFile]     = useState(null);

  const [suspiciousFile, setSuspiciousFile] = useState(null);
  const fileRef = useRef();

  const [auditing,   setAuditing]   = useState(false);
  const [auditStep,  setAuditStep]  = useState(0);
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState('');
  const [restoring,  setRestoring]  = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewMime, setPreviewMime] = useState('');

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  useEffect(() => {
    if (!walletAddress) return;
    fetch(`${API}/files?wallet=${walletAddress}`)
      .then(r => r.json())
      .then(d => setVaultFiles(d.files || []))
      .catch(console.error);
  }, [walletAddress]);

  const runForensicAudit = async () => {
    if (!vaultFile || !suspiciousFile) return;
    setAuditing(true); setError(''); setResult(null);

    try {
      for (let i = 0; i < AUDIT_STEPS.length; i++) {
        setAuditStep(i + 1);
        await delay(700);
      }

      const formData = new FormData();
      formData.append('file', suspiciousFile);
      formData.append('fileId', vaultFile.fileId);

      const res  = await fetch(`${API}/verify`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      if (data.originalHash) {
        const chain = await verifyFileOnChain(data.originalHash);
        data.chainVerified = chain.valid;
        data.chainOwner    = chain.owner;
      }

      setResult(data);
      const isValid = data.status === 'valid' || data.isMatch;
      if (typeof onNotify === 'function') {
        onNotify(
          isValid ? 'Integrity verified — file authentic' : 'TAMPER DETECTED!',
          isValid ? 'success' : 'error'
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAuditing(false); setAuditStep(0);
    }
  };

  const handleRestore = async () => {
    if (!result?.fileId) return;
    setRestoring(true);

    const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

    try {
      // Step 1: Execute restore which now returns the original file directly
      const res = await fetch(`${API}/restore/${result.fileId}`, { method: 'POST' });

      if (res.ok) {
        const blob = await res.blob();
        const url  = window.URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = result.filename || result.fileName || vaultFile?.filename || 'restored_file';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        if (typeof onNotify === 'function') onNotify('✅ File restored successfully!', 'success');
        return;
      }

      // Step 3: IPFS fallback
      if (result.ipfsCID) {
        let cid = result.ipfsCID
          .replace('https://gateway.pinata.cloud/ipfs/', '')
          .replace('https://ipfs.io/ipfs/', '')
          .replace('/ipfs/', '')
          .replace('ipfs/', '');

        window.open(`https://gateway.pinata.cloud/ipfs/${cid}`, '_blank');
        if (typeof onNotify === 'function') onNotify('⬇️ Opening original from IPFS...', 'info');
        return;
      }

      if (typeof onNotify === 'function') onNotify('Original file not available for restore', 'error');

    } catch (err) {
      console.error('Restore error:', err);
      if (typeof onNotify === 'function') onNotify('❌ Restore failed: ' + err.message, 'error');
    } finally {
      setRestoring(false);
    }
  };

  const reset = () => {
    setVaultFile(null); setSuspiciousFile(null);
    setResult(null); setError('');
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setPreviewMime(''); }
  };

  const isValid = result?.status === 'valid' || result?.status === 'VALID' || result?.isMatch === true;
  const riskScore = isValid ? 0 : Math.min(
    100,
    (result?.diff?.summary?.totalChanges || 0) * 5 + (result?.comparison ? 20 : 0) + 40
  );

  return (
    <motion.div className="page" variants={pageVariants} initial="initial" animate="animate">
      <div className="compact-container">
        
        {/* Header Section */}
        <header style={{ textAlign: 'center', marginBottom: 40 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 8, 
              padding: '6px 14px', 
              background: 'rgba(255, 62, 62, 0.05)', 
              border: '1px solid rgba(255, 62, 62, 0.15)', 
              borderRadius: '20px',
              marginBottom: 16
            }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-red)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Forensic Audit Mode
            </span>
          </motion.div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
            Integrity Verification
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8, maxWidth: '500px', margin: '8px auto 0' }}>
            Execute deep-level forensic analysis to detect tampering and verify cryptographic authenticity.
          </p>
        </header>

        <AnimatePresence mode="wait">
          {!auditing && !result && (
            <motion.div key="form" variants={cardVariants} initial="initial" animate="animate" 
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {error && (
                <div className="card" style={{ 
                  padding: '14px 18px', 
                  background: 'rgba(255, 62, 62, 0.08)', 
                  color: 'var(--accent-red)', 
                  border: '1px solid rgba(255, 62, 62, 0.2)', 
                  fontSize: 13,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  <AlertTriangle size={16} /> {error}
                </div>
              )}

              {/* STEP 1: Select Vault File */}
              <div className={`card glass-card ${vaultFile ? 'glow-cyan' : ''}`} 
                style={{ 
                  padding: '24px', 
                  border: vaultFile ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid var(--border)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: vaultFile ? 0 : 0 }}>
                  <div style={{ 
                    width: 36, height: 36, borderRadius: '10px', 
                    background: vaultFile ? 'var(--accent-cyan)' : 'var(--bg-active)',
                    color: vaultFile ? '#000' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, flexShrink: 0
                  }}>
                    {vaultFile ? '✓' : '1'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Select Vault Master</h3>
                    {!vaultFile && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Retrieve original cryptographic record from your vault.</p>}
                  </div>
                  {!vaultFile ? (
                    <button className="btn btn-p" onClick={() => setShowVaultPick(true)} style={{ background: 'var(--accent-cyan)', color: '#000' }}>Browse Vault</button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0, 0, 0, 0.2)', padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(0, 229, 255, 0.1)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-cyan)' }}>{vaultFile.filename}</div>
                      <button onClick={() => setVaultFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 2: Upload Suspicious File */}
              <div style={{ position: 'relative' }}>
                <div className={`card glass-card ${suspiciousFile ? 'glow-teal' : ''}`} 
                  style={{ 
                    padding: '24px', 
                    border: suspiciousFile ? '1px solid rgba(0, 255, 163, 0.3)' : '1px solid var(--border)',
                    opacity: vaultFile ? 1 : 0.4,
                    transition: 'opacity 0.3s ease'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: suspiciousFile ? 0 : 20 }}>
                    <div style={{ 
                      width: 36, height: 36, borderRadius: '10px', 
                      background: suspiciousFile ? 'var(--accent-teal)' : 'var(--bg-active)',
                      color: suspiciousFile ? '#000' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800, flexShrink: 0
                    }}>
                      {suspiciousFile ? <Check size={18} /> : '2'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Upload Forensic Subject</h3>
                      {!suspiciousFile && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Subject for integrity analysis.</p>}
                    </div>
                    {suspiciousFile && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0, 0, 0, 0.2)', padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(0, 255, 163, 0.1)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-teal)' }}>{suspiciousFile.name}</div>
                        <button onClick={() => setSuspiciousFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={14} /></button>
                      </div>
                    )}
                  </div>

                  {!suspiciousFile && (
                    <div className="dz" 
                      onDragOver={e => { if (!vaultFile) return; e.preventDefault(); }} 
                      onDragLeave={() => {}} 
                      onDrop={e => { if (!vaultFile) return; e.preventDefault(); if (e.dataTransfer.files[0]) setSuspiciousFile(e.dataTransfer.files[0]); }} 
                      onClick={() => { if (!vaultFile) return; fileRef.current?.click(); }} 
                      style={{ 
                        padding: '40px 20px', 
                        border: '1.5px dashed var(--border-light)', 
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: 16,
                        cursor: vaultFile ? 'pointer' : 'not-allowed'
                      }}>
                      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files[0] && setSuspiciousFile(e.target.files[0])} />
                      <div style={{ marginBottom: 12, color: 'var(--accent-cyan)' }}><FlaskConical size={32} /></div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Drop Suspect Asset</h4>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyze local copy for tampering</p>
                    </div>
                  )}
                </div>

                {!vaultFile && (
                  <div style={{ 
                    position: 'absolute', inset: 0, 
                    background: 'rgba(10, 14, 20, 0.4)', 
                    backdropFilter: 'blur(4px)', 
                    borderRadius: 16, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10, border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', padding: '10px 20px', borderRadius: '30px', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                      <Lock size={16} color="var(--accent-orange)" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Complete Step 1 First</span>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3: Execute Audit */}
              <div className="card glass-card" style={{ padding: '24px', opacity: vaultFile && suspiciousFile ? 1 : 0.4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <div style={{ 
                    width: 36, height: 36, borderRadius: '10px', 
                    background: vaultFile && suspiciousFile ? 'var(--accent-purple)' : 'var(--bg-active)',
                    color: vaultFile && suspiciousFile ? '#fff' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, flexShrink: 0
                  }}>
                    3
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Execute Forensic Audit</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Run cryptographic comparison engine.</p>
                  </div>
                </div>
                <motion.button 
                  whileHover={vaultFile && suspiciousFile ? { scale: 1.01, boxShadow: '0 0 25px rgba(139, 110, 253, 0.3)' } : {}}
                  whileTap={vaultFile && suspiciousFile ? { scale: 0.99 } : {}}
                  className="btn btn-p btn-full" 
                  disabled={!vaultFile || !suspiciousFile} 
                  onClick={runForensicAudit} 
                  style={{ 
                    height: '54px', 
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    background: vaultFile && suspiciousFile ? 'linear-gradient(135deg, var(--accent-purple), #6366f1)' : 'var(--bg-active)', 
                    color: vaultFile && suspiciousFile ? '#fff' : 'var(--text-muted)',
                    border: 'none'
                  }}>
                  INITIALIZE ANALYSIS SEQUENCE
                </motion.button>
              </div>

            </motion.div>
          )}

          {auditing && (
            <motion.div key="auditing" variants={cardVariants} initial="initial" animate="animate">
              <div className="card glass-card" style={{ padding: '48px 32px', textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 32px' }}>
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(0, 229, 255, 0.1)', borderTopColor: 'var(--accent-cyan)' }} 
                  />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
                    <Shield size={32} />
                  </div>
                </div>
                
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Forensic Engine Active</h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 40 }}>Comparing cryptographic DNA sequences...</p>
                
                <div style={{ width: '100%', maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {AUDIT_STEPS.map((s, i) => (
                    <div key={i} style={{ 
                      display: 'flex', alignItems: 'center', gap: 14, 
                      padding: '14px 20px', borderRadius: 12, 
                      background: auditStep === i + 1 ? 'rgba(0, 229, 255, 0.05)' : 'rgba(255,255,255,0.02)', 
                      border: `1px solid ${auditStep === i + 1 ? 'rgba(0, 229, 255, 0.2)' : 'var(--border)'}`, 
                      opacity: auditStep >= i + 1 ? 1 : 0.2,
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{ 
                        width: 22, height: 22, borderRadius: '6px', fontSize: 10, fontWeight: 800,
                        background: auditStep > i + 1 ? 'var(--accent-teal)' : auditStep === i + 1 ? 'var(--accent-cyan)' : 'transparent', 
                        border: `1px solid ${auditStep > i + 1 ? 'var(--accent-teal)' : auditStep === i + 1 ? 'var(--accent-cyan)' : 'var(--border)'}`,
                        color: auditStep >= i + 1 ? '#000' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {auditStep > i + 1 ? <Check size={14} /> : i + 1}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: auditStep === i + 1 ? 700 : 500, color: auditStep === i + 1 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {result && !auditing && (
            <motion.div key="result" initial="initial" animate="animate" 
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Result Summary Card */}
              <div className="card glass-card" style={{ 
                padding: '40px 32px', 
                textAlign: 'center',
                border: `1px solid ${isValid ? 'rgba(0, 255, 163, 0.2)' : 'rgba(255, 62, 62, 0.2)'}`, 
                background: isValid ? 'rgba(0, 255, 163, 0.02)' : 'rgba(255, 62, 62, 0.02)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  position: 'absolute', top: -20, right: -20, width: 100, height: 100, 
                  background: isValid ? 'var(--accent-teal)' : 'var(--accent-red)', 
                  opacity: 0.05, borderRadius: '50%', filter: 'blur(40px)' 
                }} />

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                  {isValid ? <ShieldCheck size={56} color="var(--accent-teal)" /> : <ShieldAlert size={56} color="var(--accent-red)" />}
                </div>
                <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 10px', color: isValid ? 'var(--accent-teal)' : 'var(--accent-red)', letterSpacing: '-0.02em' }}>
                  {isValid ? 'INTEGRITY VERIFIED' : 'TAMPER DETECTED'}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                  {isValid 
                    ? 'Cryptographic fingerprints match perfectly. Asset is authentic.' 
                    : 'A mismatch has been detected in the cryptographic fingerprints.'}
                </p>
              </div>

              {/* Analysis Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
                
                {/* Fingerprints */}
                <div className="card glass-card" style={{ padding: '24px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 2, background: 'var(--accent-cyan)' }}></span>
                    Cryptographic DNA
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vault Master Hash</div>
                      <div style={{ 
                        fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', wordBreak: 'break-all', 
                        padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px solid rgba(0, 229, 255, 0.1)' 
                      }}>
                        {result.originalHash}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Forensic Subject Hash</div>
                      <div style={{ 
                        fontSize: 11, fontFamily: 'var(--font-mono)', color: isValid ? 'var(--accent-teal)' : 'var(--accent-red)', wordBreak: 'break-all',
                        padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: `1px solid ${isValid ? 'rgba(0, 255, 163, 0.1)' : 'rgba(255, 62, 62, 0.1)'}`
                      }}>
                        {result.currentHash}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Intelligence Stats */}
                <div className="card glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 2, background: 'var(--accent-purple)' }}></span>
                    Audit Intelligence
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Risk Probability</div>
                      <div style={{ fontSize: 36, fontWeight: 800, color: riskColor(riskScore), letterSpacing: '-0.02em' }}>{riskScore}%</div>
                      <div style={{ width: '100%', height: 4, background: 'var(--bg-active)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${riskScore}%` }} style={{ height: '100%', background: riskColor(riskScore) }} />
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                        <span style={{ color: isValid ? 'var(--accent-teal)' : 'var(--accent-red)', fontWeight: 800 }}>{result.status?.toUpperCase()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '8px 0' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Blockchain</span>
                        <span style={{ color: result.chainVerified ? 'var(--accent-teal)' : 'var(--accent-red)', fontWeight: 800 }}>{result.chainVerified ? 'VERIFIED' : 'UNSEALED'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Forensic Diff Section */}
              {!isValid && result.diff?.available && (
                <div className="card glass-card" style={{ padding: '24px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 2, background: 'var(--accent-red)' }}></span>
                    Line-by-Line Forensic Analysis — {result.diff.summary?.total || 0} Changes
                  </div>
                  <div style={{ 
                    maxHeight: 300, overflowY: 'auto', background: '#05070a', 
                    padding: '16px', borderRadius: 12, fontSize: 12, fontFamily: 'var(--font-mono)',
                    border: '1px solid rgba(255,255,255,0.05)', lineHeight: 1.8
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 0, marginBottom: 10, fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>
                      <div style={{ fontWeight: 800 }}>Line</div>
                      <div style={{ fontWeight: 800 }}>Change</div>
                    </div>
                    {result.diff.changes && result.diff.changes.length > 0 ? (
                      result.diff.changes.map((ch, i) => {
                        const bgColor = ch.type === 'added' ? 'rgba(0, 255, 163, 0.08)' : 
                                       ch.type === 'removed' ? 'rgba(255, 62, 62, 0.08)' : 
                                       ch.type === 'modified' ? 'rgba(255, 193, 7, 0.08)' : 'transparent';
                        const textColor = ch.type === 'added' ? 'var(--accent-teal)' : 
                                         ch.type === 'removed' ? 'var(--accent-red)' : 
                                         ch.type === 'modified' ? 'rgba(255, 193, 7, 1)' : 'var(--text-muted)';
                        const icon = ch.type === 'added' ? '+' : ch.type === 'removed' ? '−' : '~';
                        
                        return (
                          <div 
                            key={i} 
                            style={{ 
                              display: 'grid', 
                              gridTemplateColumns: '40px 1fr', 
                              gap: 0,
                              background: bgColor,
                              padding: '4px 8px',
                              borderRadius: 4,
                              marginBottom: 2,
                              borderLeft: `2px solid ${textColor}`,
                              wordBreak: 'break-all'
                            }}>
                            <div style={{ color: textColor, fontWeight: 800, fontSize: 11, minWidth: 30 }}>{icon} {ch.index || i}</div>
                            <div style={{ color: textColor, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {ch.line?.slice(0, 120)}{ch.line?.length > 120 ? '...' : ''}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                        Binary mismatch detected. Line-level diff unavailable for this format.
                      </div>
                    )}
                  </div>
                  {result.diff.summary && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
                      <div style={{ padding: 12, background: 'rgba(0, 255, 163, 0.08)', borderRadius: 8, border: '1px solid rgba(0, 255, 163, 0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Added Lines</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-teal)' }}>{result.diff.summary.added || 0}</div>
                      </div>
                      <div style={{ padding: 12, background: 'rgba(255, 62, 62, 0.08)', borderRadius: 8, border: '1px solid rgba(255, 62, 62, 0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Removed Lines</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-red)' }}>{result.diff.summary.removed || 0}</div>
                      </div>
                      <div style={{ padding: 12, background: 'rgba(255, 193, 7, 0.08)', borderRadius: 8, border: '1px solid rgba(255, 193, 7, 0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Modified Lines</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255, 193, 7, 1)' }}>{result.diff.summary.modified || 0}</div>
                      </div>
                      <div style={{ padding: 12, background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Total Changes</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{result.diff.summary.total || 0}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Footer */}
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <motion.button 
                  whileHover={{ background: 'rgba(255,255,255,0.05)' }}
                  className="btn btn-s" onClick={reset} 
                  style={{ flex: 1, height: 50, borderRadius: 12, fontWeight: 700 }}>
                  New Forensic Audit
                </motion.button>
                {!isValid ? (
                  <motion.button 
                    whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(255, 62, 62, 0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-p" onClick={handleRestore} disabled={restoring} 
                    style={{ flex: 1.5, height: 50, borderRadius: 12, background: 'var(--accent-red)', color: '#fff', fontWeight: 800 }}>
                    {restoring ? <RefreshCw size={16} className="spin" style={{ marginRight: 8 }} /> : <Shield size={16} style={{ marginRight: 8 }} />}
                    {restoring ? 'EXECUTING RESTORATION...' : 'RESTORE VAULT ORIGINAL'}
                  </motion.button>
                ) : (
                  <motion.button 
                    whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(0, 255, 163, 0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-teal" 
                    style={{ flex: 1.5, height: 50, borderRadius: 12, fontWeight: 800 }}>
                    <FileText size={16} style={{ marginRight: 8 }} />
                    GENERATE VALIDITY REPORT
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vault Picker Modal */}
        <AnimatePresence>
          {showVaultPick && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowVaultPick(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>Select Record</h3>
                  <button onClick={() => setShowVaultPick(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                  {vaultFiles.map(f => (
                    <div key={f.fileId} className="card" onClick={() => { setVaultFile(f); setShowVaultPick(false); }} style={{ padding: 12, marginBottom: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName || f.filename}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.fileId}</div>
                      </div>
                      <span className="badge" style={{ background: f.status === 'valid' ? 'rgba(0,255,163,0.1)' : 'rgba(255,62,62,0.1)', color: f.status === 'valid' ? 'var(--accent-teal)' : 'var(--accent-red)' }}>{f.status?.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview Modal */}
        <AnimatePresence>
          {previewUrl && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
              <div style={{ width: '100%', maxWidth: 1000, display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>Restored Asset Preview</h3>
                <button onClick={() => setPreviewUrl(null)} className="btn btn-s">Close</button>
              </div>
              <div style={{ width: '100%', maxWidth: 1000, flex: 1, background: '#000', borderRadius: 16, overflow: 'hidden' }}>
                {previewMime.startsWith('image/') ? <img src={previewUrl} alt="Restored" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Preview" />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}