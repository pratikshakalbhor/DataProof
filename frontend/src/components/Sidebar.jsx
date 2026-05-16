import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  ShieldCheck,
  Folder,
  Activity,
  User,
  LogOut,
  Archive,
  RotateCcw,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    group: 'Operational',
    items: [
      { path: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
      { path: '/upload',         label: 'Upload File',    icon: UploadCloud },
      { path: '/my-files',       label: 'My Files',       icon: Folder },
    ]
  },
  {
    group: 'Forensics',
    items: [
      { path: '/verify',         label: 'Verify Integrity', icon: ShieldCheck },
      { path: '/recovery',       label: 'Recovery Hub',    icon: RotateCcw },
    ]
  },
  {
    group: 'Ledger',
    items: [
      { path: '/blockchain-log', label: 'Blockchain Log', icon: Activity },
      { path: '/archive',        label: 'Forensic Archive', icon: Archive },
    ]
  },
  {
    group: 'Account',
    items: [
      { path: '/profile',        label: 'Settings/profile', icon: User },
    ]
  }
];

export default function Sidebar({ onLogout }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path) =>
    pathname === path || (path !== '/dashboard' && pathname.startsWith(path));

  return (
    <aside className="sidebar">
      {/* Logo Area */}
      <div className="logo-area" style={{ 
        padding: '24px 20px', 
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        <img 
          src="/logo.jpg" 
          alt="DataProof Logo" 
          style={{ 
            width: '100%', 
            maxWidth: '50px', 
            height: 'auto', 
            borderRadius: '5px',
            boxShadow: '0 2px 8px rgba(0, 229, 255, 0.05)'
          }} 
        />
      </div>

      {/* Navigation */}
      <nav className="nav" style={{ padding: '20px 12px', gap: 24, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {NAV_GROUPS.map(group => (
          <div key={group.group} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ 
              fontSize: 10, 
              fontWeight: 800, 
              color: 'var(--text-muted)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.1em',
              paddingLeft: 14,
              marginBottom: 4,
              opacity: 0.6
            }}>
              {group.group}
            </div>
            {group.items.map(n => {
              const Icon = n.icon;
              const active = isActive(n.path);
              return (
                <button
                  key={n.path}
                  className={`nav-btn${active ? ' active' : ''}`}
                  onClick={() => navigate(n.path)}
                  style={{
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    background: active ? 'rgba(0, 229, 255, 0.05)' : 'transparent',
                    transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                    position: 'relative'
                  }}
                >
                  {active && (
                    <div style={{ 
                      position: 'absolute', 
                      left: 0, 
                      top: '20%', 
                      bottom: '20%', 
                      width: 3, 
                      background: 'var(--accent-cyan)', 
                      borderRadius: '0 4px 4px 0',
                      boxShadow: '0 0 10px var(--accent-cyan)'
                    }} />
                  )}
                  <Icon size={18} className="nav-icon" style={{ 
                    marginRight: 12, 
                    color: active ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    opacity: active ? 1 : 0.7
                  }} />
                  {n.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer / Connection State */}
      <div className="sidebar-foot" style={{ padding: '20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: 8, 
          padding: '8px 12px', background: 'rgba(0, 255, 163, 0.05)', 
          border: '1px solid rgba(0, 255, 163, 0.1)', borderRadius: '8px',
          fontSize: 10, fontWeight: 700, color: 'var(--accent-teal)',
          marginBottom: 16
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-teal)', animation: 'pulse 2s infinite' }}></div>
          Network Secure
        </div>
        
        {onLogout && (
          <button
            className="logout-btn"
            onClick={onLogout}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px', borderRadius: '8px',
              color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
              background: 'transparent', border: 'none', cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <LogOut size={14} />
            <span>Terminate Session</span>
          </button>
        )}
      </div>
    </aside>
  );
}