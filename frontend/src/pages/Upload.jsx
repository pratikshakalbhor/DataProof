import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Cloud, CheckCircle2, AlertTriangle, 
  Fingerprint, Shield, X, Check, 
  Clock, Wallet, Hash, Activity, ShieldCheck, ArrowRight
} from 'lucide-react';
import { pageVariants, cardVariants, fadeIn } from '../utils/animations';
import { sealFileOnBlockchain, getTxUrl } from '../utils/blockchain';
import '../styles/Upload.css';

/**
 * Environment Variable Connection:
 * REACT_APP_API_URL is injected here at build time. 
 * This allows the frontend to communicate with the backend across different environments.
 */
const API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api$/, '') + '/api';

const STEPS = [
  { pct: 20,  label: 'Generating SHA-256 Hash...',       icon: <Hash size={14} /> },
  { pct: 40,  label: 'Encrypting File (AES-256)...',     icon: <Lock size={14} /> },
  { pct: 60,  label: 'Uploading to IPFS Backup...',      icon: <Cloud size={14} /> },
  { pct: 80,  label: 'Waiting for MetaMask...',           icon: <Wallet size={14} /> },
  { pct: 90,  label: 'Registering on Blockchain...',     icon: <Activity size={14} /> },
  { pct: 100, label: 'Vault Secured!',                   icon: <CheckCircle2 size={14} /> },
];

export default function Upload({ walletAddress, onNavigate, onRefresh }) {
  const [file,     setFile]     = useState(null);
  const [drag,     setDrag]     = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIdx,  setStepIdx]  = useState(-1);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const step = (i) => { setStepIdx(i); setProgress(STEPS[i].pct); };
  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  const handleUpload = async () => {
    if (!file) return;

    // ── Wallet Check ──
    if (!walletAddress) {
      setError('Connect your MetaMask wallet first.');
      return;
    }

    // ── Pre-flight: Ensure MetaMask is unlocked & connected ──
    // This block now ensures MetaMask is connected AND on the correct Sepolia network
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });

        // Check and switch to Sepolia Testnet if not already on it
        const expectedChainId = '0xaa36a7'; // Sepolia Testnet Chain ID
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });

        if (currentChainId !== expectedChainId) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: expectedChainId }],
            });
          } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (switchError.code === 4902) {
              // Try to add the Sepolia network
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: expectedChainId,
                  chainName: 'Sepolia Testnet',
                  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://rpc.sepolia.org'],
                  blockExplorerUrls: ['https://sepolia.etherscan.io'],
                }],
              });
            } else {
              // User rejected chain switch or other error
              setError('Please switch to the Sepolia Testnet in MetaMask to proceed.');
              return;
            }
          }
        }
      } catch (e) {
        // User rejected account connection or other connection error
        setError('MetaMask connection rejected or failed. Please unlock MetaMask and try again.');
        return;
      }
    } else {
      setError('MetaMask not found! Please install MetaMask browser extension.');
      return;
    }
    setUploading(true); setError(''); setResult(null);

    try {
      // Step 1 — Hash
      step(0); await delay(600);

      // Step 2 — Encrypt
      step(1); await delay(500);

      // Step 3 — IPFS upload via backend
      step(2);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('walletAddress', walletAddress);

      const uploadRes = await fetch(`${API}/upload`, {
        method: 'POST',
        headers: { 'X-Wallet-Address': walletAddress },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      const { fileId, fileHash, filename, fileSize } = uploadData;
      console.log('✅ Backend response:', uploadData);

      // Duplicate hash check — skip blockchain if already exists
      if (uploadData.existing) {
        setResult({
          fileId, fileHash, filename, fileSize,
          txHash:    uploadData.txHash || 'existing',
          duplicate: true,
        });
        onRefresh(); // Trigger global refresh for dashboard/my files
        setUploading(false);
        return;
      }

      // Step 4 — MetaMask popup (always for new files)
      step(3); await delay(200);
      console.log('🦊 Triggering MetaMask for new file:', filename, '| hash:', fileHash?.slice(0, 16) + '...');

      let txHash     = 'pending';
      let blockNumber = 0;

      try {
        const bcResult = await sealFileOnBlockchain({
          fileId,
          filename,
          fileHash,
          ipfsCID:       uploadData.ipfsCID || '',
          encryptedHash: uploadData.encryptedHash || '',
          mongoDbRef:    fileId,
          cloudinaryUrl: uploadData.cloudinaryUrl || '',
          fileSize:      fileSize || file.size || 0,
        });
        txHash      = bcResult.txHash;
        blockNumber = bcResult.blockNumber;
        console.log('✅ Blockchain confirmed! TX:', txHash);
      } catch (bcErr) {
        console.warn('⚠️ Blockchain seal failed:', bcErr.message);
        if (bcErr.message?.includes('user rejected') || bcErr.code === 4001) {
          setError('MetaMask transaction was rejected. File saved to vault but NOT sealed on blockchain.');
        }
        onRefresh(); // Even if rejected, file might be saved to DB, so refresh
      }

      // Step 5 — Save txHash to backend (only if confirmed)
      step(4);
      if (txHash && txHash !== 'pending') {
        try {
          const patchRes = await fetch(`${API}/files/${fileId}/tx`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txHash, blockNumber }),
          });
          if (patchRes.ok) {
            console.log('✅ txHash saved to backend:', txHash);
          } else {
            const patchData = await patchRes.json().catch(() => ({}));
            console.warn('⚠️ txHash save failed:', patchData);
          }
        } catch (patchErr) {
          console.warn('⚠️ txHash PATCH error:', patchErr.message);
        }
      }

      // Step 6 — Done
      step(5); await delay(400);

      setResult({ fileId, fileHash, filename, fileSize, txHash });
      onRefresh(); // Trigger global refresh for dashboard/my files
      setUploading(false);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
      setUploading(false);
      setStepIdx(-1); setProgress(0);
    }
  };

  const reset = () => {
    setFile(null); setProgress(0); setStepIdx(-1);
    setResult(null); setError('');
  };

  return (
    <motion.div className="page"
      variants={pageVariants} initial="initial" animate="animate">

      <div className="compact-container">
        {/* Header Section */}
        <header style={{ textAlign: 'center', marginBottom: 32 }}>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 8, 
              padding: '6px 12px', 
              background: 'rgba(0, 229, 255, 0.05)', 
              border: '1px solid rgba(0, 229, 255, 0.15)', 
              borderRadius: '20px',
              marginBottom: 16
            }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Secure Vault Protocol v2.4
            </span>
          </motion.div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
            Vault Registration
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8, maxWidth: '500px', margin: '8px auto 0' }}>
            Establish immutable blockchain proof for your digital assets using military-grade encryption and SHA-256 fingerprinting.
          </p>
        </header>

        <AnimatePresence mode="wait">

          {/* ── Drop Zone ── */}
          {!file && !uploading && !result && (
            <motion.div key="drop" variants={cardVariants}
              initial="initial" animate="animate" exit={{ opacity: 0 }}>
              
              {/* Compact Upload Card */}
              <div className="card glass-card glow-cyan dz"
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => {
                  e.preventDefault(); setDrag(false);
                  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
                }}
                onClick={() => fileRef.current?.click()}
                style={{
                  maxWidth: '560px',
                  margin: '0 auto',
                  padding: '60px 40px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  border: drag ? '1.5px dashed var(--accent-cyan)' : '1.5px dashed var(--border-light)',
                  background: drag ? 'rgba(0, 229, 255, 0.04)' : 'var(--glass-bg)',
                }}>
                <input ref={fileRef} type="file" style={{ display: 'none' }}
                  onChange={e => e.target.files[0] && setFile(e.target.files[0])} />
                
                <motion.div
                  animate={{ y: [0, -6, 0] }} 
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  style={{ 
                    width: 64, 
                    height: 64, 
                    borderRadius: '16px', 
                    background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.1), rgba(0, 229, 255, 0.05))',
                    border: '1px solid rgba(0, 229, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    color: 'var(--accent-cyan)'
                  }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </motion.div>
                
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Initialize Security Seal</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Drag and drop forensic asset or click to browse</p>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Maximum payload: 50MB · Encrypted at edge</span>
              </div>

              {/* Security Features Row */}
              <div style={{
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16, 
                marginTop: 32,
              }}>
                {[
                  { icon: <Lock size={24} />, title: 'AES-256', desc: 'Enterprise Grade Encryption', color: 'var(--accent-purple)' },
                  { icon: <Fingerprint size={24} />, title: 'SHA-256', desc: 'Cryptographic Fingerprinting', color: 'var(--accent-cyan)' },
                  { icon: <Activity size={24} />, title: 'ETH SEAL', desc: 'Immutable Blockchain Proof', color: 'var(--accent-teal)' },
                ].map((item, i) => (
                  <motion.div 
                    key={i} 
                    whileHover={{ y: -4 }}
                    className="card glass-card"
                    style={{ 
                      padding: '24px 16px', 
                      textAlign: 'center',
                      borderTop: `2px solid ${item.color}`
                    }}>
                    <div style={{ fontSize: 24, marginBottom: 12 }}>{item.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                      {item.desc}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── File selected ── */}
          {file && !uploading && !result && (
            <motion.div key="selected" variants={cardVariants}
              initial="initial" animate="animate"
              style={{ maxWidth: '560px', margin: '0 auto' }}>
              
              {error && (
                <div style={{
                  padding: '12px 16px', borderRadius: 12, marginBottom: 20,
                  background: 'rgba(255, 62, 62, 0.08)',
                  border: '1px solid rgba(255, 62, 62, 0.2)',
                  fontSize: 13, color: 'var(--accent-red)',
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <AlertTriangle size={16} /> {error}
                </div>
              )}

              <div className="card glass-card" style={{ marginBottom: 20, padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 12,
                    background: 'rgba(0, 229, 255, 0.08)',
                    border: '1px solid rgba(0, 229, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: 'var(--accent-cyan)',
                  }}>
                    {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {(file.size / 1024).toFixed(1)} KB · {file.type || 'Binary Data'}
                    </div>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.1, color: 'var(--accent-red)' }}
                    onClick={reset} 
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', display: 'flex', padding: '8px',
                    }}><X size={18} /></motion.button>
                </div>
              </div>

                <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)' }} 
                whileTap={{ scale: 0.98 }}
                onClick={handleUpload}
                className="btn btn-p btn-full"
                style={{
                  height: 56, borderRadius: 14,
                  background: 'var(--accent-cyan)', color: '#000',
                  fontSize: 15, fontWeight: 800, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
                }}>
                <Shield size={18} /> SECURE ON BLOCKCHAIN
              </motion.button>
              
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 16 }}>
                By proceeding, you are creating a permanent cryptographic record on Ethereum Sepolia.
              </p>
            </motion.div>
          )}

          {/* ── Upload Progress ── */}
          {uploading && (
            <motion.div key="progress" variants={fadeIn}
              initial="initial" animate="animate"
              style={{ maxWidth: '560px', margin: '0 auto' }}>
              <div className="card glass-card" style={{ padding: '32px' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                    Securing Digital Asset
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {file?.name}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{
                  height: 8, background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 10, overflow: 'hidden', marginBottom: 12,
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <motion.div
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{
                      height: '100%', 
                      background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))',
                      borderRadius: 10,
                    }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--accent-cyan)', fontWeight: 700,
                  textAlign: 'right', marginBottom: 32, fontFamily: 'var(--font-mono)' }}>
                  {progress}%
                </div>

                {/* Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {STEPS.map((s, i) => {
                    const done   = stepIdx > i;
                    const active = stepIdx === i;
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        opacity: active || done ? 1 : 0.25, 
                        transition: 'all 0.3s ease',
                        transform: active ? 'translateX(4px)' : 'none'
                      }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '8px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: done ? 'rgba(0, 255, 163, 0.1)'
                            : active ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                          border: `1px solid ${done ? 'rgba(0, 255, 163, 0.3)'
                            : active ? 'rgba(0, 229, 255, 0.3)' : 'var(--border)'}`,
                          color: done ? 'var(--accent-teal)' : active ? 'var(--accent-cyan)' : 'var(--text-muted)',
                          fontSize: 12,
                        }}>
                          {done ? <Check size={14} /> : active ? (
                            <motion.div 
                              animate={{ rotate: 360 }} 
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                              </svg>
                            </motion.div>
                          ) : (i + 1)}
                        </div>
                        <span style={{
                          fontSize: 13,
                          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: active ? 700 : 500,
                          letterSpacing: active ? '0.01em' : '0'
                        }}>
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Success ── */}
          {result && !uploading && (
            <motion.div key="success" variants={cardVariants}
              initial="initial" animate="animate"
              style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div className="card glass-card"
                style={{
                  border: '1px solid rgba(0, 255, 163, 0.2)',
                  background: 'rgba(0, 255, 163, 0.02)',
                  padding: '40px 32px',
                }}>

                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    style={{ 
                      width: 80, 
                      height: 80, 
                      borderRadius: '50%', 
                      background: 'rgba(0, 255, 163, 0.1)',
                      border: '1px solid rgba(0, 255, 163, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-teal)',
                      margin: '0 auto 20px',
                      boxShadow: '0 0 30px rgba(0, 255, 163, 0.15)'
                    }}>
                    <ShieldCheck size={40} />
                  </motion.div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-teal)', marginBottom: 8 }}>
                    {result.duplicate
                      ? 'Blockchain Proof Verified'
                      : 'Security Protocol Complete'}
                  </h2>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
                    {result.duplicate
                      ? 'Asset already registered. Existing proof retrieved.'
                      : 'Encrypted, stored on IPFS, and sealed on Ethereum.'}
                  </p>
                </div>

                {/* Details Card */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid var(--border)',
                  borderRadius: 14, padding: '24px',
                  marginBottom: 32,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 800, 
                    color: 'var(--text-primary)', marginBottom: 20,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-teal)' }}></span>
                    Forensic Certificate
                  </div>
                  
                  {[
                    { label: 'SHA-256 Fingerprint', value: result.fileHash, color: 'var(--accent-cyan)' },
                    { label: 'Blockchain Transaction', value: result.txHash, color: 'var(--accent-purple)' },
                    { label: 'Asset Identifier', value: result.fileId, color: 'var(--text-muted)' },
                  ].map((row, i) => (
                    <div key={i} style={{ marginBottom: i < 2 ? 16 : 0 }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)', letterSpacing: 1,
                        textTransform: 'uppercase', marginBottom: 6 }}>
                        {row.label}
                      </div>
                      <div style={{
                        fontSize: 11, fontFamily: 'var(--font-mono)',
                        color: row.color, wordBreak: 'break-all',
                        padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)'
                      }}>
                        {row.value === 'pending'
                          ? <span style={{ color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Clock size={12} className="spin" /> Awaiting block confirmation...
                            </span>
                          : row.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Explorer Link */}
                {result.txHash && result.txHash !== 'pending' && result.txHash !== 'existing' && (
                  <motion.a 
                    whileHover={{ color: 'var(--text-primary)' }}
                    href={getTxUrl(result.txHash)} target="_blank" rel="noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      marginBottom: 32, fontSize: 12, color: 'var(--accent-teal)', textDecoration: 'none',
                      fontWeight: 600
                    }}>
                    Verify on Etherscan ↗
                  </motion.a>
                )}

                {/* Footer Buttons */}
                <div style={{ display: 'flex', gap: 16 }}>
                  <motion.button
                    whileHover={{ background: 'rgba(255, 255, 255, 0.05)' }}
                    onClick={reset}
                    className="btn btn-s"
                    style={{
                      flex: 1, height: 48, borderRadius: 12,
                      fontSize: 13, fontWeight: 700
                    }}>
                    New Registration
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => onNavigate('files')}
                    className="btn btn-p"
                    style={{
                      flex: 1.2, height: 48, borderRadius: 12,
                      background: 'var(--accent-teal)', color: '#000',
                      fontSize: 13, fontWeight: 800
                    }}>
                    View Forensic Vault <ArrowRight size={14} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}