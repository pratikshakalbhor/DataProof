import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Login.css';
import { scalePop, cardVariants, staggerContainer, fadeIn } from '../utils/animations';
import { CheckCircle, Lock, AlertTriangle, ArrowRight } from 'lucide-react';

const WALLETS = [
  {
    id: 'metamask',
    name: 'Connect with MetaMask',
    desc: 'Connect using browser extension',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
    popular: true,
  }
];

export default function Login({ onConnected }) {
  const [status,           setStatus]           = useState('idle');
  const [connectingWallet, setConnectingWallet] = useState('');
  const [error,            setError]            = useState('');
  const [address,          setAddress]          = useState('');
  const [isConnecting,     setIsConnecting]     = useState(false);

  const connectMetaMask = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setStatus('connecting');
    setConnectingWallet('MetaMask');
    setError('');

    try {
      if (!window.ethereum) {
        window.alert('MetaMask not found');
        window.open('https://metamask.io/download/', '_blank');
        setIsConnecting(false);
        setStatus('idle');
        return;
      }

      // ✅ Force a fresh connection popup every time
      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch (err) {
        if (err.code === 4001) throw err; 
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts.length) throw new Error('No accounts found. Please unlock MetaMask.');

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0xaa36a7') {
        try {
          await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
        } catch {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia Testnet',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://rpc.sepolia.org'],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            }],
          });
        }
      }

      const walletAddr = accounts[0];
      setAddress(walletAddr);
      setStatus('connected');
      setTimeout(() => onConnected(walletAddr), 1500);
    } catch (err) {
      if (err.code === 4001) {
        setError('Connection rejected. Please approve in MetaMask.');
      } else if (err.code === -32002) {
        setError('MetaMask already processing. Please open MetaMask manually.');
      } else {
        setError(err.message || 'Connection failed');
      }
      setStatus('error');
    } finally {
      setIsConnecting(false);
    }
  };

  const reset = () => { 
    setStatus('idle'); 
    setError(''); 
  };

  return (
    <div className="login-page">
      <motion.div className="login-orb login-orb-1"
        animate={{ y: [0, -30, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div className="login-orb login-orb-2"
        animate={{ y: [0, 30, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
      <motion.div className="login-orb login-orb-3"
        animate={{ y: [0, -20, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      <motion.div className="login-card" variants={cardVariants} initial="initial" animate="animate">

        {/* Logo */}
        <motion.div className="login-logo" variants={fadeIn} initial="initial" animate="animate" style={{ flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <motion.img 
            src="/logo.jpg" 
            alt="DataProof Logo" 
            style={{ 
              width: '80px', 
              height: 'auto', 
              borderRadius: '8px',
              boxShadow: '0 4px 15px rgba(0, 212, 255, 0.08)'
            }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300 }}
          />
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── IDLE ── */}
          {status === 'idle' && (
            <motion.div key="idle" variants={fadeIn} initial="initial" animate="animate" exit={{ opacity: 0, y: -10 }}>
              <div className="login-heading">Connect Wallet</div>
              <div className="login-subheading">
                Connect your wallet to securely use blockchain features
              </div>

              <motion.div className="wallet-options" variants={staggerContainer} initial="initial" animate="animate">
                {WALLETS.map(w => (
                  <motion.button
                    key={w.id}
                    className="wallet-btn"
                    variants={cardVariants}
                    whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,212,255,0.15)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => w.id === 'metamask' ? connectMetaMask() : null}
                  >
                    <span className="wallet-btn-icon">{w.icon}</span>
                    <div className="wallet-btn-info">
                      <div className="wallet-btn-name">
                        {w.name}
                        {w.popular && <span className="popular-badge">Popular</span>}
                      </div>
                      <div className="wallet-btn-desc">{w.desc}</div>
                    </div>
                    <motion.span className="wallet-btn-arrow" whileHover={{ x: 4 }}><ArrowRight size={16} /></motion.span>
                  </motion.button>
                ))}
              </motion.div>

              <motion.div variants={fadeIn} initial="initial" animate="animate" transition={{ delay: 0.4 }}>
                <div className="login-divider">
                  <div className="login-divider-line" />
                  <span className="login-divider-text">Secured by</span>
                  <div className="login-divider-line" />
                </div>
                <div className="security-info">
                  <span className="security-info-icon"><Lock size={16} /></span>
                  <span className="security-info-text">
                    <strong>Non-custodial</strong> — We never store your private keys.{' '}
                    <strong>AES-256</strong> + <strong>Ethereum</strong> blockchain.
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ── CONNECTING ── */}
          {status === 'connecting' && (
            <motion.div key="connecting" variants={scalePop} initial="initial" animate="animate" className="connecting-state">
              <motion.div
                style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', margin: '0 auto 18px' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }}
              />
              <div className="connecting-name">{connectingWallet}</div>
              <div className="connecting-desc">Check your wallet for connection request...</div>
            </motion.div>
          )}

          {/* ── CONNECTED ── */}
          {status === 'connected' && (
            <motion.div key="connected" variants={scalePop} initial="initial" animate="animate" className="connected-state">
              <motion.div
                className="connected-check"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              ><CheckCircle size={48} /></motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-teal)', marginBottom: 8 }}>Connected!</div>
                <div className="connected-address">{address.slice(0, 6)}...{address.slice(-4)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Redirecting to Dashboard...
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {status === 'error' && (
            <motion.div key="error" variants={cardVariants} initial="initial" animate="animate">
              <div className="login-heading">Connection Failed</div>
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                style={{
                  background: 'rgba(255,68,68,.08)', border: '1px solid rgba(255,68,68,.25)',
                  borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 16,
                  fontSize: 12, color: 'var(--accent-red)',
                  fontFamily: 'var(--font-mono)', lineHeight: 1.6,
                }}
              >
                <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> {error}
              </motion.div>
              {error.includes('not installed') && (
                <a
                  href="https://metamask.io/download/"
                  target="_blank" rel="noreferrer"
                  className="btn btn-teal btn-full"
                  style={{ marginBottom: 10, textDecoration: 'none', justifyContent: 'center' }}
                >
                  Install MetaMask
                </a>
              )}
              <motion.button
                className="btn btn-s btn-full"
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={reset}
              >
                ← Try Again
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
