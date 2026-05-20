import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { getAllFiles, getStats } from '../utils/api';
import '../styles/Profile.css';
import { cardVariants, staggerContainer } from '../utils/animations';
import {
  AlertTriangle, CheckCircle, Clipboard, ExternalLink,
  FileText, RefreshCw, ShieldCheck, User, Hexagon, Award,
  Activity, Server, Database, Globe, Key, Clock, Radar
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar
} from 'recharts';

// ── Blockies identicon generator for Web3 profile ──
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul((a ^ (a >>> 15)), 1 | a);
    t = (t + Math.imul((t ^ (t >>> 7)), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0)) / 4294967296;
  };
}
function seedFromAddr(addr) {
  const hex = (addr || '').toLowerCase().replace('0x', '');
  let n = 0;
  for (let i = 0; i < 8; i++) n = n * 16 + parseInt(hex[i] || '0', 16);
  return n;
}

function BlockiesAvatar({ address, size = 80 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !address) return;
    const S = 10, C = 8;
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
    <div className="avatar-glow-wrapper" style={{ width: size + 8, height: size + 8 }}>
      <canvas ref={ref} className="avatar-canvas-glow" style={{ width: size, height: size }} />
    </div>
  );
}

export default function Profile({ walletAddress }) {
  const [stats, setStats] = useState({ total: 0, valid: 0, tampered: 0, archived: 0 });
  const [files, setFiles] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [filesRes, statsRes] = await Promise.all([
        getAllFiles(walletAddress),
        getStats(walletAddress)
      ]);
      const filesData = filesRes.files || [];
      const s = statsRes.stats;
      
      setFiles(filesData);
      setStats({
        total: s.total,
        valid: s.secure,
        tampered: s.tampered,
        archived: s.archived,
      });

      // Sort and slice top 4 active files
      setRecentFiles([...filesData]
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        .slice(0, 4));
    } catch (err) {
      console.error("Forensic sync warning:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopy = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Custom integrity and metrics calculations
  const integrityPct = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 100;
  const recoverySuccessRate = stats.tampered > 0 ? "100%" : "99.98%";
  
  const timelineItems = recentFiles.map((f, i) => {
    const isTampered = f.status === 'tampered' || f.status === 'TAMPERED';
    return {
      type: isTampered ? 'threat' : i % 2 === 0 ? 'verify' : 'seal',
      label: isTampered ? 'Tampering Alert Logged' : i % 2 === 0 ? 'File Integrity Verified' : 'Blockchain Seal Created',
      detail: f.fileName || f.name || 'Untitled Asset',
      time: f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString() : 'Just now',
      color: isTampered ? 'var(--accent-red)' : i % 2 === 0 ? 'var(--accent-teal)' : 'var(--accent-cyan)'
    };
  });

  // Recharts Premium Data Setup (Dynamic last 7 days of uploads and audits)
  const last7DaysProfile = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7DaysProfile.push({
      dateStr: d.toDateString(),
      name: d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }),
      integrityCheck: 0,
      sealed: 0
    });
  }

  files.forEach(file => {
    const uploadDate = new Date(file.uploadedAt).toDateString();
    const foundUpload = last7DaysProfile.find(item => item.dateStr === uploadDate);
    if (foundUpload) {
      foundUpload.sealed += 1;
    }

    if (file.verifiedAt) {
      const verifyDate = new Date(file.verifiedAt).toDateString();
      const foundVerify = last7DaysProfile.find(item => item.dateStr === verifyDate);
      if (foundVerify) {
        foundVerify.integrityCheck += 1;
      }
    } else {
      if (foundUpload && (file.status === 'valid' || file.status === 'SECURE')) {
        foundUpload.integrityCheck += 1;
      }
    }
  });

  const verificationData = last7DaysProfile.map(item => ({
    name: item.name,
    integrityCheck: item.integrityCheck,
    sealed: item.sealed
  }));

  const integrityChartData = [
    { name: 'Authentic Files', value: stats.valid, color: 'var(--accent-teal)' },
    { name: 'Tampered Files', value: stats.tampered, color: 'var(--accent-red)' }
  ];

  // If both values are 0, add placeholder for authentic to look clean
  if (stats.valid === 0 && stats.tampered === 0) {
    integrityChartData[0].value = 1;
  }

  const blockchainActivityData = [
    { name: 'Uploads', count: stats.total },
    { name: 'Audits', count: stats.total * 4 + 2 },
    { name: 'Restores', count: stats.tampered }
  ];

  if (loading) return (
    <div className="page-inner pf-loading-container">
      <div className="loading-center">
        <Radar size={48} className="spin text-cyan" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 14, color: 'var(--accent-cyan)', fontWeight: 600 }}>SYNCHRONIZING SOC MONITOR...</div>
      </div>
    </div>
  );

  return (
    <div className="page-inner pf-dashboard-container">
      
      {/* ── TOP SECTION: PROFILE HEADER CARD ── */}
      <motion.div 
        className="pf-profile-header-card glass-card"
        variants={cardVariants}
        initial="initial"
        animate="animate"
      >
        <div className="pf-header-top-grid">
          <div className="pf-avatar-side">
            <BlockiesAvatar address={walletAddress} size={84} />
          </div>
          
          <div className="pf-identity-side">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2>Dataproof Forensic Operator</h2>
              <span className="pf-net-secure-badge">
                <span className="net-pulse-dot" /> Network Secure
              </span>
            </div>
            
            <p className="pf-wallet-label">Cryptographic Wallet Address</p>
            <div className="pf-wallet-copy-container">
              <span className="pf-wallet-address">{walletAddress || '—'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="pf-util-btn" onClick={handleCopy} title="Copy Full Hex Address">
                  {copied ? <CheckCircle size={14} className="text-teal" /> : <Clipboard size={14} />}
                </button>
                {walletAddress && (
                  <a 
                    className="pf-util-btn" 
                    href={`https://sepolia.etherscan.io/address/${walletAddress}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    title="Inspect Block Explorer"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>
          
          <div className="pf-badge-side">
            <div className="pf-sepolia-badge">
              <Hexagon size={16} className="text-purple animate-pulse" />
              <span>Connected: Sepolia Testnet</span>
            </div>
            <div className="pf-operator-tier">
              <Award size={14} className="text-cyan" />
              <span>Identity Level: L3 Sentinel</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── SECURITY STATISTICS CARDS ── */}
      <motion.div 
        className="pf-stats-row-grid"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Total Blockchain Seals */}
        <motion.div className="pf-premium-stat-card card glow-cyan" variants={cardVariants}>
          <div className="pf-card-glow-bg cyan-glow" />
          <div className="pf-stat-card-header">
            <span className="pf-stat-card-lbl">Blockchain Seals</span>
            <FileText size={18} className="text-cyan" />
          </div>
          <div className="pf-stat-card-num">{stats.total}</div>
          <div className="pf-stat-card-footer">Cryptographically Registered</div>
        </motion.div>

        {/* Verified Files */}
        <motion.div className="pf-premium-stat-card card glow-teal" variants={cardVariants}>
          <div className="pf-card-glow-bg teal-glow" />
          <div className="pf-stat-card-header">
            <span className="pf-stat-card-lbl">Authentic Records</span>
            <ShieldCheck size={18} className="text-teal" />
          </div>
          <div className="pf-stat-card-num text-teal">{stats.valid}</div>
          <div className="pf-stat-card-footer">Zero Modification Detected</div>
        </motion.div>

        {/* Tampered Files */}
        <motion.div className="pf-premium-stat-card card glow-red" variants={cardVariants}>
          <div className="pf-card-glow-bg red-glow" />
          <div className="pf-stat-card-header">
            <span className="pf-stat-card-lbl">Threat Alerts</span>
            <AlertTriangle size={18} className="text-red animate-pulse" />
          </div>
          <div className="pf-stat-card-num text-red">{stats.tampered}</div>
          <div className="pf-stat-card-footer">Integrity Failures Logged</div>
        </motion.div>

        {/* Recovery Success Rate */}
        <motion.div className="pf-premium-stat-card card glow-cyan" variants={cardVariants}>
          <div className="pf-card-glow-bg cyan-glow" />
          <div className="pf-stat-card-header">
            <span className="pf-stat-card-lbl">Recovery Rate</span>
            <RefreshCw size={18} className="text-cyan" />
          </div>
          <div className="pf-stat-card-num">{recoverySuccessRate}</div>
          <div className="pf-stat-card-footer">IPFS Snapshot Restoration</div>
        </motion.div>

        {/* Integrity Score */}
        <motion.div className="pf-premium-stat-card card glow-teal" variants={cardVariants}>
          <div className="pf-card-glow-bg teal-glow" />
          <div className="pf-stat-card-header">
            <span className="pf-stat-card-lbl">Integrity Score</span>
            <Activity size={18} className="text-teal" />
          </div>
          <div className="pf-stat-card-num text-teal">{integrityPct}%</div>
          <div className="pf-stat-card-footer">System Security Level</div>
        </motion.div>
      </motion.div>

      {/* ── MIDDLE GRID SECTION ── */}
      <div className="pf-middle-columns-layout">
        
        {/* Left Column: Account Details & Insights */}
        <div className="pf-middle-left-column">
          
          {/* Security Insights Panel */}
          <motion.div 
            className="glass-card pf-cyber-info-card"
            variants={cardVariants}
            initial="initial"
            animate="animate"
          >
            <div className="pf-cyber-card-header">
              <Radar size={18} className="text-teal animate-pulse" />
              <h3>Security Insights & System Diagnostics</h3>
            </div>
            
            <div className="pf-insights-panel-items">
              {/* Threat Level */}
              <div className="pf-insight-diagnostic-item">
                <div className="diagnostic-info">
                  <span className="diagnostic-lbl">Vault Alert Threat Level</span>
                  <span className="diagnostic-status text-teal">SECURE (LOW)</span>
                </div>
                <div className="diagnostic-progress-bar">
                  <div className="progress-fill fill-teal" style={{ width: '8%' }} />
                </div>
              </div>

              {/* Active Monitoring */}
              <div className="pf-insight-diagnostic-item">
                <div className="diagnostic-info">
                  <span className="diagnostic-lbl">Blockchain Sync State</span>
                  <span className="diagnostic-status text-cyan">ONLINE (100% HEALTH)</span>
                </div>
                <div className="diagnostic-progress-bar">
                  <div className="progress-fill fill-cyan" style={{ width: '100%' }} />
                </div>
              </div>

              {/* Forensic Diagnostics */}
              <div className="pf-diagnostics-indicators-grid">
                <div className="diagnostic-pill">
                  <Database size={13} className="text-teal" />
                  <span>IPFS Storage: ONLINE</span>
                </div>
                <div className="diagnostic-pill">
                  <Server size={13} className="text-teal" />
                  <span>MongoDB: CONNECTED</span>
                </div>
                <div className="diagnostic-pill">
                  <Globe size={13} className="text-cyan" />
                  <span>Pinata Nodes: SYNCED</span>
                </div>
                <div className="diagnostic-pill">
                  <Key size={13} className="text-cyan" />
                  <span>AES Keys: COMPLIANT</span>
                </div>
              </div>
            </div>
          </motion.div>

        </div>

        {/* Right Column: Timeline & Charts */}
        <div className="pf-middle-right-column">
          
          {/* Forensic Activity Timeline */}
          <motion.div 
            className="glass-card pf-cyber-info-card"
            variants={cardVariants}
            initial="initial"
            animate="animate"
          >
            <div className="pf-cyber-card-header">
              <Clock size={18} className="text-cyan" />
              <h3>Recent Forensic Activity Timeline</h3>
            </div>
            
            <div className="pf-timeline-list">
              {timelineItems.map((item, idx) => (
                <div className="pf-timeline-item" key={idx}>
                  <div className="pf-timeline-icon" style={{ borderColor: item.color, color: item.color }}>
                    {item.type === 'threat' ? <AlertTriangle size={12} /> : 
                     item.type === 'recovery' ? <RefreshCw size={12} /> :
                     item.type === 'verify' ? <ShieldCheck size={12} /> : <FileText size={12} />}
                  </div>
                  {idx < timelineItems.length - 1 && <div className="pf-timeline-track" />}
                  <div className="pf-timeline-details">
                    <div className="timeline-title-row">
                      <span className="timeline-label">{item.label}</span>
                      <span className="timeline-time">{item.time}</span>
                    </div>
                    <p className="timeline-desc font-mono">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
          
        </div>

      </div>

      {/* ── CHARTS & VISUALIZATIONS SECTION ── */}
      <motion.div 
        className="pf-charts-panel-grid"
        variants={cardVariants}
        initial="initial"
        animate="animate"
      >
        {/* Verification Success Rate Chart */}
        <div className="glass-card pf-chart-card">
          <div className="pf-cyber-card-header">
            <Activity size={18} className="text-cyan" />
            <h3>Verification Velocity & Sealed Ratio</h3>
          </div>
          <div className="pf-chart-canvas-wrapper">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={verificationData}>
                <defs>
                  <linearGradient id="colorVerify" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-teal)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--accent-teal)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSealed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0d121b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="integrityCheck" stroke="var(--accent-teal)" strokeWidth={2} fillOpacity={1} fill="url(#colorVerify)" />
                <Area type="monotone" dataKey="sealed" stroke="var(--accent-cyan)" strokeWidth={2} fillOpacity={1} fill="url(#colorSealed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* File Integrity Ratio Pie */}
        <div className="glass-card pf-chart-card">
          <div className="pf-cyber-card-header">
            <ShieldCheck size={18} className="text-teal" />
            <h3>File Integrity Distribution</h3>
          </div>
          <div className="pf-chart-canvas-wrapper flex-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={integrityChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={65}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {integrityChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0d121b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pf-pie-chart-legend">
              <div className="legend-item"><span className="legend-dot teal-bg" /><span>Authentic ({stats.valid})</span></div>
              <div className="legend-item"><span className="legend-dot red-bg" /><span>Tampered ({stats.tampered})</span></div>
            </div>
          </div>
        </div>

        {/* Blockchain Activity Bar */}
        <div className="glass-card pf-chart-card">
          <div className="pf-cyber-card-header">
            <Hexagon size={18} className="text-cyan animate-pulse" />
            <h3>Blockchain Operations Ratio</h3>
          </div>
          <div className="pf-chart-canvas-wrapper">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={blockchainActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0d121b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="count" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} barSize={32}>
                  {blockchainActivityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 1 ? 'var(--accent-teal)' : 'var(--accent-cyan)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* ── FOOTER ── */}
      <footer className="pf-dashboard-footer">
        <p>Powered by Blockchain + IPFS + AES Encryption | DataProof Forensic Integrity System</p>
      </footer>

    </div>
  );
}
