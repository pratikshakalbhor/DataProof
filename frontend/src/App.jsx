import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Verify from './pages/Verify';
import MyFiles from './pages/MyFiles';
import BlockchainLog from './pages/BlockchainLog';
import FileDetails from './pages/FileDetails';
import Profile from './pages/Profile';
import PublicVerify from './pages/PublicVerify';
import RecoveryHub from './pages/RecoveryHub'; 

// Components
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';

// Create a context for refresh functionality outside of App component
const RefreshContext = React.createContext({ refreshKey: 0, triggerRefresh: () => {} });
const useRefreshContext = () => React.useContext(RefreshContext);

const TITLES = {
  '/dashboard': 'Dashboard',
  '/upload': 'Upload File',
  '/my-files': 'My Files',
  '/verify': 'Verify Integrity',
  '/recovery': 'Recovery Hub',
  '/blockchain-log': 'Blockchain Log',
  '/profile': 'Profile',
};

function usePageTitle() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/files/')) return 'Asset Details';
  return TITLES[pathname] || 'Forensic System';
}

function AppLayout({ walletAddress, onLogout }) {
  const title = usePageTitle();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { refreshKey, triggerRefresh } = useRefreshContext(); // Use context for refresh

  return (
    <div className={`app-container${mobileOpen ? ' mobile-sidebar-open' : ''}`}>
      <Sidebar onLogout={onLogout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="main-layout" onClick={() => mobileOpen && setMobileOpen(false)}>
        <Topbar 
          walletAddress={walletAddress} 
          pageTitle={title} 
          onDisconnect={onLogout} 
          onMenuClick={() => setMobileOpen(!mobileOpen)}
        />
        <main className="content-area">
          <div className="page">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard walletAddress={walletAddress} refreshKey={refreshKey} />} />
              <Route path="/upload" element={<Upload walletAddress={walletAddress} onNavigate={(path) => {
                if (path === 'files') navigate('/my-files');
                else navigate(path);
              }} onRefresh={triggerRefresh} />} />
              <Route path="/verify" element={<Verify walletAddress={walletAddress} onNotify={() => {}} onRefresh={triggerRefresh} />} />
              <Route path="/my-files" element={<MyFiles walletAddress={walletAddress} refreshKey={refreshKey} onRefresh={triggerRefresh} />} />
              <Route path="/archive" element={<Navigate to="/dashboard" replace />} />
              <Route path="/blockchain-log" element={<BlockchainLog walletAddress={walletAddress} />} />
              <Route path="/files/:id" element={<FileDetails walletAddress={walletAddress} />} />
              <Route path="/profile" element={<Profile walletAddress={walletAddress} onLogout={onLogout} />} />
              {RecoveryHub ? <Route path="/recovery" element={<RecoveryHub walletAddress={walletAddress} onNotify={() => {}} />} /> : null}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0); // State to trigger refreshes
  const location = useLocation();

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const isPublicRoute = location.pathname.startsWith('/verify-public/');

  useEffect(() => {
    // Always start with a clean state on fresh startup/page load
    localStorage.removeItem('walletAddress');
    setWalletAddress(null);
    setLoading(false);

    if (window.ethereum) {
      const handleAccounts = (accs) => {
        if (accs.length === 0) {
          localStorage.removeItem('walletAddress');
          setWalletAddress(null);
        } else {
          setWalletAddress(accs[0]);
          localStorage.setItem('walletAddress', accs[0]);
        }
      };

      window.ethereum.on('accountsChanged', handleAccounts);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccounts);
        }
      };
    }
  }, []);

  const handleConnected = (addr) => {
    setWalletAddress(addr);
    localStorage.setItem('walletAddress', addr);
  };

  const handleLogout = () => {
    localStorage.removeItem('walletAddress');
    setWalletAddress(null);
  };

  if (loading) {
    return <div className="loading-screen">Initializing Forensic Vault...</div>;
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{
        // Custom styling for toasts
        // This ensures toasts look good with the dark theme
        // and are easily readable.
        style: { background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
      }} />
      
      {isPublicRoute ? (
        <Routes>
          <Route path="/verify-public/:fileId" element={<PublicVerify />} />
        </Routes>
      ) : !walletAddress ? (
        <Login onConnected={handleConnected} />
      ) : (
        <RefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
          <AppLayout walletAddress={walletAddress} onLogout={handleLogout} />
        </RefreshContext.Provider>
      )}
    </>
  );
}
