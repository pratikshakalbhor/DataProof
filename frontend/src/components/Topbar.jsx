import { useState, useRef, useEffect } from 'react';
import { Settings, ExternalLink, ShieldCheck, Cpu, LogOut, Copy, Check, Menu } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';

export default function Topbar({ pageTitle, walletAddress, onDisconnect, onMenuClick }) {
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const settingsRef = useRef(null);

  // Close settings on outside click
  useEffect(() => {
    const handler = e => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  return (
    <header className="topbar" style={{ padding: '0 20px', height: '64px', gap: 12 }}>
      {/* Mobile Toggle */}
      <button 
        className="mobile-menu-btn"
        onClick={onMenuClick}
        style={{
          background: 'transparent', border: 'none', color: 'var(--text-secondary)',
          display: 'none', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 4
        }}
      >
        <Menu size={20} />
      </button>

      {/* Left — Breadcrumb */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div className="topbar-icon" style={{ 
          width: 18, height: 18, 
          overflow: 'hidden', 
          borderRadius: '3px',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ 
            fontSize: 14, 
            fontWeight: 800, 
            color: 'var(--text-primary)', 
            lineHeight: 1,
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {pageTitle}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            DataProof Forensic Node
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        
        {/* Network Badge */}
        <div className="sim-badge" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-teal)', animation: 'pulse 2s infinite' }} />
          Sepolia Testnet
        </div>

        {/* Notifications */}
        <NotificationDropdown walletAddress={walletAddress} />

        {/* Settings Gear */}
        <div style={{ position: 'relative' }} ref={settingsRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              width: 36, height: 36, borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)',
              background: showSettings ? 'rgba(0,212,255,0.08)' : 'transparent',
              color: showSettings ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            <Settings size={18} />
          </button>

          {/* Settings Dropdown */}
          {showSettings && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 12px)', right: 0,
              width: 300, background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(16px)',
              zIndex: 1000, overflow: 'hidden',
              animation: 'slideInDown 0.2s ease-out'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Identity Panel</span>
                <span style={{ fontSize: 10, color: 'var(--accent-teal)', fontWeight: 700 }}>VERIFIED</span>
              </div>

              {/* Wallet Section */}
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Connected Wallet
                </div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all', marginBottom: 10 }}>
                  {walletAddress}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={copyAddress} style={{ 
                    flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--border)', 
                    background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', 
                    fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 
                  }}>
                    {copied ? <Check size={12} color="var(--accent-teal)" /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy Address'}
                  </button>
                  <a href={`https://sepolia.etherscan.io/address/${walletAddress}`} target="_blank" rel="noreferrer" style={{ 
                    flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--border)', 
                    background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', 
                    fontSize: 11, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 
                  }}>
                    <ExternalLink size={12} />
                    Explorer
                  </a>
                </div>
              </div>

              {/* Security Section */}
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Security Layers
                </div>
                {[
                  { label: 'AES-256 Encryption', icon: ShieldCheck },
                  { label: 'SHA-256 Hashing', icon: Cpu },
                  { label: 'Blockchain Seal', icon: ExternalLink }
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                      <item.icon size={12} />
                      {item.label}
                    </div>
                    <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>Active</span>
                  </div>
                ))}
              </div>

              {/* Actions Section */}
              <div style={{ padding: '12px' }}>
                <button
                  onClick={() => { setShowSettings(false); onDisconnect(); }}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 8,
                    background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)',
                    color: '#ff4444', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,68,68,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,68,68,0.1)'}
                >
                  <LogOut size={14} />
                  Disconnect Wallet
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}