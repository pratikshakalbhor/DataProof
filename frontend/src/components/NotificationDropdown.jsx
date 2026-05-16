import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAllFiles } from '../utils/api';

export default function NotificationDropdown({ walletAddress }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // --- Security Audit Logic ---
  const runSecurityAudit = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res   = await getAllFiles(walletAddress);
      const files = res.files || [];
      let alerts  = [];

      files.forEach(f => {
        // ✅ Tamper — CRITICAL
        if (f.status === 'tampered') {
          alerts.push({
            id:    `t-${f.fileId}`,
            type:  'critical',
            title: 'TAMPER DETECTED',
            text:  `"${f.filename}" — hash mismatch on blockchain!`,
            page:  '/verify',
            time:  f.verifiedAt || f.uploadedAt,
          });
        }
        // ✅ Pending seal
        if (f.txHash === 'pending' || f.status === 'pending') {
          alerts.push({
            id:    `p-${f.fileId}`,
            type:  'warning',
            title: 'Blockchain Seal Pending',
            text:  `"${f.filename}" not yet sealed on Ethereum.`,
            page:  '/my-files',
            time:  f.uploadedAt,
          });
        }
        // ✅ Expiry
        if (f.expiryDate && new Date(f.expiryDate) < new Date()) {
          alerts.push({
            id:    `e-${f.fileId}`,
            type:  'info',
            title: 'File Expired',
            text:  `"${f.filename}" is no longer valid.`,
            page:  '/my-files',
            time:  f.expiryDate,
          });
        }
      });

      // ✅ Storage warning
      if (files.length > 40) {
        alerts.push({
          id:    'storage-warn',
          type:  'warning',
          title: 'Storage Warning',
          text:  `Vault at ${files.length} files — clean up recommended.`,
          page:  '/my-files',
          time:  new Date().toISOString(),
        });
      }

      setNotifications(alerts);
    } catch (err) {
      console.error('Security audit failed', err);
    }
  }, [walletAddress]);

  // Initial check + auto-refresh every 2 minutes
  useEffect(() => {
    runSecurityAudit();
    const interval = setInterval(runSecurityAudit, 120000);
    return () => clearInterval(interval);
  }, [runSecurityAudit]);

  // Close on outside click
  useEffect(() => {
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const getIcon = (type) => {
    if (type === 'critical') return <AlertTriangle size={16} style={{ color: '#ef4444' }} />;
    if (type === 'warning')  return <AlertTriangle size={16} style={{ color: '#f59e0b' }} />;
    return <AlertTriangle size={16} style={{ color: '#60a5fa' }} />;
  };

  return (
    <div className="notification-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <div onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer', position: 'relative', padding: '8px' }}>
        <Bell size={20} />
        {notifications.length > 0 && (
          <span style={{
            position: 'absolute', top: '6px', right: '6px',
            background: notifications.some(n => n.type === 'critical')
              ? '#ef4444'   // ← Critical = red
              : '#f59e0b',  // ← Warning = yellow
            width: '10px', height: '10px',
            borderRadius: '50%',
            border: '2px solid var(--bg-navbar)',
            // ✅ Pulse animation critical sathi
            animation: notifications.some(n => n.type === 'critical')
              ? 'pulse 1.5s infinite' : 'none',
          }} />
        )}
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="dropdown-panel" style={{
          position: 'absolute', top: '100%', right: 0, width: '320px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          marginTop: '10px', zIndex: 1000, overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ padding: '15px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>System Security</span>
            <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>
              {notifications.length} Issues Found
            </span>
          </div>

          {/* List */}
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <CheckCircle size={24} style={{ color: '#10b981', opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>System Secure. No threats found.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id}
                  onClick={() => { navigate(n.page); setIsOpen(false); }}
                  style={{ padding: '12px 15px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', gap: '12px', cursor: 'pointer' }}
                >
                  <div style={{ marginTop: '2px' }}>{getIcon(n.type)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600,
                      marginBottom: '2px',
                      color: n.type === 'critical' ? '#ef4444' : 'var(--text-primary)' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '11px',
                      color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {n.text}
                    </div>
                    {/* ✅ Time add kara */}
                    {n.time && (
                      <div style={{ fontSize: '10px',
                        color: 'var(--muted)', marginTop: 4,
                        fontFamily: 'var(--font-mono, monospace)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> {new Date(n.time).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}