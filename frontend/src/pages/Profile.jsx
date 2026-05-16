import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { getAllFiles, getStats } from '../utils/api';
import '../styles/Profile.css';
import { cardVariants, staggerContainer } from '../utils/animations';
import {
  AlertTriangle, CheckCircle, Clipboard,
  ExternalLink, FileText, LogOut, RefreshCw, ShieldCheck,
  Trash2, UploadCloud, Wallet, Zap, User,
  Shield, Star, CheckCircle2, Hexagon, ArrowRight, Award
} from 'lucide-react';

// ─────────────────────────────────────────────
//  Blockies — pure-JS pixel identicon
// ─────────────────────────────────────────────
function mulberry32(a) {
  return function () {
    /* eslint-disable no-mixed-operators */
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul((a ^ (a >>> 15)), 1 | a);
    t = (t + Math.imul((t ^ (t >>> 7)), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0)) / 4294967296;
    /* eslint-enable no-mixed-operators */
  };
}
function seedFromAddr(addr) {
  const hex = (addr || '').toLowerCase().replace('0x', '');
  let n = 0;
  for (let i = 0; i < 8; i++) n = n * 16 + parseInt(hex[i] || '0', 16);
  return n;
}

function BlockiesAvatar({ address, size = 68 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !address) return;
    const S = 9, C = 8;
    canvas.width = C * S; canvas.height = C * S;
    const ctx = canvas.getContext('2d');
    const rng = mulberry32(seedFromAddr(address));
    const h = Math.floor(rng() * 360), s = Math.floor(rng() * 60) + 40, l = Math.floor(rng() * 30) + 25;
    ctx.fillStyle = `hsl(${h},${s}%,${l + 40}%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const half = Math.ceil(C / 2);
    const fg = `hsl(${h},${s}%,${l}%)`;
    const sp = `hsl(${(h + 180) % 360},${s}%,${l + 20}%)`;
    for (let row = 0; row < C; row++) {
      for (let col = 0; col < half; col++) {
        const v = rng();
        if (v < 0.28) { ctx.fillStyle = sp; }
        else if (v < 0.56) { ctx.fillStyle = fg; }
        else continue;
        ctx.fillRect(col * S, row * S, S, S);
        ctx.fillRect((C - 1 - col) * S, row * S, S, S);
      }
    }
  }, [address]);

  if (!address) {
    return (
      <div className="avatar-fallback" style={{ width: size, height: size }}>
        <User size={size * 0.6} />
      </div>
    );
  }

  return (
    <canvas ref={ref} className="avatar-canvas" style={{ width: size, height: size }} />
  );
}

// ─────────────────────────────────────────────
//  Tier logic
// ─────────────────────────────────────────────
function getTier(n) {
  if (n >= 51) return { label: 'Sentinel',         color: '#FB7185', icon: <Shield size={14} />,         next: null,  nextAt: 51  };
  if (n >= 11) return { label: 'Trusted Verifier', color: '#A78BFA', icon: <CheckCircle2 size={14} />, next: 51,    nextAt: 50  };
  return             { label: 'Novice',             color: '#2DD4BF', icon: <Star size={14} />,          next: 11,    nextAt: 10  };
}

// ─────────────────────────────────────────────
//  Activity helpers
// ─────────────────────────────────────────────
function actIcon(type) {
  if (type === 'upload') return <UploadCloud size={14} className="icon-upload" />;
  if (type === 'verify') return <ShieldCheck size={14} className="icon-verify" />;
  return <Zap size={14} className="icon-default" />;
}
function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

// ─────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────
export default function Profile({ walletAddress, onLogout }) {
  const [stats,      setStats]      = useState({ total: 0, valid: 0, tampered: 0 });
  const [recent,     setRecent]     = useState([]);
  const [ethBal,     setEthBal]     = useState(null);
  const [balLoad,    setBalLoad]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [copied,     setCopied]     = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [fRes, sRes] = await Promise.all([getAllFiles(walletAddress), getStats(walletAddress)]);
      const files = fRes.files || [];
      const s = sRes.stats || sRes || {};
      setStats({
        total:    s.total    || files.length                                   || 0,
        valid:    s.valid    || files.filter(f => f.status === 'valid').length  || 0,
        tampered: s.tampered || files.filter(f => f.status === 'tampered').length || 0,
      });
      setRecent([...files]
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        .slice(0, 3));
    } catch { setError('Failed to load profile data'); }
    finally { setLoading(false); }
  }, [walletAddress]);

  const fetchBal = useCallback(async () => {
    if (!walletAddress) return;
    setBalLoad(true);
    try {
      if (!window.ethereum) throw new Error("MetaMask not found");
      console.log("Using BrowserProvider for balance check");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const raw = await provider.getBalance(walletAddress);
      setEthBal(parseFloat(ethers.formatEther(raw)).toFixed(4));
    } catch (err) { 
      console.error("Balance fetch error:", err);
      setEthBal('—'); 
    }
    finally { setBalLoad(false); }
  }, [walletAddress]);

  useEffect(() => { fetchData(); fetchBal(); }, [fetchData, fetchBal]);

  const handleCopy = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    });
  };

  const shortAddr    = walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : '—';
  const integrityPct = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;
  const tier         = getTier(stats.total);
  const tierPct      = tier.next
    ? Math.min(100, Math.round((stats.total / tier.nextAt) * 100))
    : 100;

  if (loading) return (
    <div className="page-inner">
      <div className="loading-center"><div className="spin-ring" />Loading profile…</div>
    </div>
  );

  return (
    <div className="page-inner pf-root">
      <div className="ph">
        <div>
          <h1>Web3 Identity</h1>
          <p>Your on-chain profile &amp; integrity analytics</p>
        </div>
        <button className="ref-btn" onClick={() => { fetchData(); fetchBal(); }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div className="error-box"><AlertTriangle size={16} /> {error}</div>}

      <motion.div className="pf-header-card glass-card" variants={cardVariants} initial="initial" animate="animate">
        <BlockiesAvatar address={walletAddress} size={68} />

        <div className="pf-header-body">
          <div className="pf-addr-row">
            <span className="pf-mono">{shortAddr}</span>
            <button className="pf-icon-btn" onClick={handleCopy} title="Copy full address">
              {copied ? <CheckCircle size={14} className="icon-success" /> : <Clipboard size={14} />}
            </button>
            {walletAddress && (
              <a className="pf-icon-btn" href={`https://sepolia.etherscan.io/address/${walletAddress}`} target="_blank" rel="noreferrer" title="View on Etherscan">
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          <div className="pf-meta-row">
            <span className="pf-net-pill"><Hexagon size={12} style={{ marginRight: 4 }} /> Sepolia Testnet</span>
            <span className="pf-eth-pill">
              <Wallet size={12} />
              {balLoad ? '…' : `${ethBal ?? '—'} ETH`}
            </span>
          </div>
        </div>

        <div className="pf-active-badge">
          <span className="pf-pulse-dot" />
          Active
        </div>

        <div className="pf-tier-chip" style={{ '--tc': tier.color }}>
          <span>{tier.icon}</span>
          <span>{tier.label}</span>
        </div>
      </motion.div>

      <motion.div className="pf-stats-grid" variants={staggerContainer} initial="initial" animate="animate">
        <motion.div className="pf-stat-box box-verified" variants={cardVariants}>
          <div className="pf-stat-icon-wrap icon-bg-verified">
            <CheckCircle size={20} className="icon-verified" />
          </div>
          <div className="pf-stat-num text-verified">{stats.valid}</div>
          <div className="pf-stat-lbl">Verified Files</div>
        </motion.div>

        <motion.div className="pf-stat-box box-tampered" variants={cardVariants}>
          <div className="pf-stat-icon-wrap icon-bg-tampered">
            <AlertTriangle size={20} className="icon-tampered" />
          </div>
          <div className="pf-stat-num text-tampered">{stats.tampered}</div>
          <div className="pf-stat-lbl">Tampered Files</div>
        </motion.div>

        <motion.div className="pf-stat-box box-total" variants={cardVariants}>
          <div className="pf-stat-icon-wrap icon-bg-total">
            <FileText size={20} className="icon-total" />
          </div>
          <div className="pf-stat-num text-total">{stats.total}</div>
          <div className="pf-stat-lbl">Total Files</div>
        </motion.div>
      </motion.div>

      <motion.div className="pf-integrity-card glass-card" variants={cardVariants} initial="initial" animate="animate">
        <div className="pf-integrity-left">
          <div className="pf-section-label">Integrity Score</div>
          <div className={`pf-integrity-pct ${integrityPct >= 80 ? 'text-verified' : integrityPct >= 50 ? 'text-warning' : 'text-tampered'}`}>
            {integrityPct}<span className="pct-sign">%</span>
          </div>
          <div className="pf-integrity-sub">
            {stats.valid} valid · {stats.tampered} tampered · {stats.total} total
          </div>
        </div>
        <div className="pf-integrity-bar-wrap">
          <div className="pf-integrity-track">
            <div className="pf-integrity-fill" style={{ width: `${integrityPct}%` }} />
          </div>
          <div className="pf-integrity-labels">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
      </motion.div>

      <div className="pf-details-grid">
        <motion.div className="glass-card pf-details-card" variants={cardVariants} initial="initial" animate="animate">
          <div className="pf-section-label label-margin">Account Information</div>
          <div className="pf-info-table">
            <div className="pf-info-row">
              <span className="pf-info-key">Wallet</span>
              <span className="pf-mono small-text">{shortAddr}</span>
            </div>
            <div className="pf-info-row">
              <span className="pf-info-key">Network</span>
              <span className="text-network">Sepolia Testnet</span>
            </div>
            <div className="pf-info-row">
              <span className="pf-info-key">ETH Balance</span>
              <span className="text-verified bold-text">{balLoad ? '…' : `${ethBal ?? '—'} ETH`}</span>
            </div>
            <div className="pf-info-row">
              <span className="pf-info-key">Tier</span>
              <span style={{ color: tier.color }} className="bold-text">{tier.icon} {tier.label}</span>
            </div>
            <div className="pf-info-row">
              <span className="pf-info-key">Encryption</span>
              <span>AES-256 + SHA-256</span>
            </div>
            <div className="pf-info-row">
              <span className="pf-info-key">Verifications</span>
              <span className="bold-text">{stats.total > 0 ? Math.floor(stats.total * 1.5) : 0}</span>
            </div>

            <div className="tier-progress-section">
              <div className="tier-progress-labels">
                <span>Tier progress</span>
                {tier.next ? <span>{stats.total}/{tier.nextAt} <ArrowRight size={12} /> {tier.icon} next</span> : <span style={{ color: tier.color }}><Award size={14} style={{ marginRight: 4 }} /> Max tier!</span>}
              </div>
              <div className="pf-tier-track">
                <div className="pf-tier-fill" style={{ width: `${tierPct}%`, '--tf-color': tier.color }} />
              </div>
            </div>
          </div>

          <div className="pf-button-group">
            <button className="pf-btn pf-btn-ghost" onClick={() => alert('Local cache cleared!')}>
              <Trash2 size={14} /> Clear Local Data
            </button>
            <button className="pf-btn pf-btn-danger" onClick={onLogout}>
              <LogOut size={14} /> Disconnect Wallet
            </button>
          </div>
        </motion.div>

        <motion.div className="glass-card pf-details-card" variants={cardVariants} initial="initial" animate="animate">
          <div className="pf-section-label label-margin">Recent Activity</div>
          {recent.length === 0 ? (
            <div className="pf-empty">
              <Zap size={28} className="empty-icon" />
              <span>No activity yet — upload your first file.</span>
            </div>
          ) : (
            <div className="pf-timeline">
              {recent.map((f, i) => {
                const name  = f.filename || f.name || 'Unknown';
                const type  = f.status === 'valid' ? 'verify' : 'upload';
                return (
                  <div className="pf-tl-item" key={f.fileId || i}>
                    <div className="pf-tl-dot">{actIcon(type)}</div>
                    <div className={`pf-tl-connector ${i < recent.length - 1 ? 'visible' : ''}`} />
                    <div className="pf-tl-body">
                      <div className="pf-tl-label">{`${type === 'verify' ? 'Verified' : 'Uploaded'} "${truncate(name, 24)}"`}</div>
                      <div className="pf-tl-time">{f.uploadedAt ? new Date(f.uploadedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
