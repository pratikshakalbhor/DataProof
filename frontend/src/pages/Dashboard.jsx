import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllFiles, getStats } from '../utils/api';
import {
  Activity, AlertTriangle, Clock, FileText,
  RefreshCw, UploadCloud, Shield, Zap, ArrowRight
} from 'lucide-react';
import {
  Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';

export default function Dashboard({ walletAddress, refreshKey }) {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState({ total: 0, valid: 0, tampered: 0, recentLogs: [], chartData: [] });

  const fetchData = useCallback(async () => {
    try {
      console.log("Dashboard: Requesting stats for:", walletAddress.toLowerCase());
      const [filesRes, statsRes] = await Promise.all([
        getAllFiles(walletAddress),
        getStats(walletAddress),
      ]);
      
      console.log("Dashboard API Response (Files):", filesRes);
      console.log("Dashboard API Response (Stats):", statsRes);

      const filesData = filesRes.files || (Array.isArray(filesRes) ? filesRes : []);
      setFiles(filesData);

      const s = statsRes.stats || statsRes || {};

      // Mock chart data if not provided by backend
      const chartData = s.chartData || [
        { day: 'Mon', count: 4 },
        { day: 'Tue', count: 7 },
        { day: 'Wed', count: 5 },
        { day: 'Thu', count: 12 },
        { day: 'Fri', count: 8 },
        { day: 'Sat', count: 15 },
        { day: 'Sun', count: 10 },
      ];

      setStats({
        total: s.total || 0,
        valid: s.valid || 0,
        tampered: s.tampered || 0,
        recentLogs: statsRes.recentLogs || [],
        chartData
      });
    } catch (err) {
      console.error(err);
    } finally {
      // Done
    }
  }, [walletAddress, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { 
    if (walletAddress) {
      console.log("Dashboard: Fetching for wallet:", walletAddress.toLowerCase());
      fetchData(); 
    }
  }, [fetchData, walletAddress, refreshKey]); // Add refreshKey to dependencies

  const integrityPct = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;
  const securityLevel = integrityPct > 90 ? 'High' : integrityPct > 70 ? 'Moderate' : 'Critical';
  const securityColor = integrityPct > 90 ? '#2DD4BF' : integrityPct > 70 ? '#F59E0B' : '#FB7185';

  return (
    <div className="page">
      <div className="page-inner">
        <header className="ph">
          <div>
            <h1>Security Intelligence</h1>
            <p>Real-time file integrity monitoring & forensic oversight</p>
          </div>
          <button className="ref-btn" onClick={fetchData}>
            <RefreshCw size={14} className={files.length === 0 ? 'spin' : ''} /> 
            <span>Refresh Intelligence</span>
          </button>
        </header>

        <div className="stats-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: 16, 
          marginBottom: 24 
        }}>
          {/* Security Score */}
          <div className="card glass-card" style={{ borderTop: `3px solid ${securityColor}`, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security Score</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: securityColor, marginTop: 4 }}>{integrityPct}%</div>
              </div>
              <Shield size={24} color={securityColor} opacity={0.8} />
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: securityColor }}></div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{securityLevel} Integrity</span>
            </div>
          </div>

          {/* Total Assets */}
          <div className="card glass-card" onClick={() => navigate('/my-files')} style={{ cursor: 'pointer', borderTop: '3px solid var(--accent-cyan)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Assets</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{stats.total}</div>
              </div>
              <FileText size={24} color="var(--accent-cyan)" opacity={0.8} />
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
              Registered on-chain
            </div>
          </div>

          {/* Threats */}
          <div className="card glass-card" onClick={() => navigate('/recovery')} style={{ cursor: 'pointer', borderTop: '3px solid var(--accent-red)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Threats Found</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent-red)', marginTop: 4 }}>{stats.tampered}</div>
              </div>
              <AlertTriangle size={24} color="var(--accent-red)" opacity={0.8} />
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
              Integrity violations
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="card glass-card" style={{ borderTop: '3px solid var(--accent-purple)', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
            <button className="btn btn-pu btn-full" onClick={() => navigate('/upload')} style={{ height: '36px', fontSize: 11 }}>
              <UploadCloud size={14} /> <span>New Seal</span>
            </button>
            <button className="btn btn-s btn-full" onClick={() => navigate('/verify')} style={{ height: '36px', fontSize: 11 }}>
              <Zap size={14} /> <span>Forensic Audit</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Chart Section */}
          <div className="card glass-card" style={{ padding: '20px' }}>
            <div className="sec-hdr" style={{ marginBottom: 20 }}>
              <span className="sec-title" style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Activity size={16} color="var(--accent-cyan)" /> 
                <span>Verification Velocity</span>
              </span>
            </div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                    itemStyle={{ color: 'var(--accent-cyan)' }}
                  />
                  <Line type="monotone" dataKey="count" stroke="var(--accent-cyan)" strokeWidth={3} dot={{ fill: 'var(--bg-card)', stroke: 'var(--accent-cyan)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Alerts / Quick Info */}
          <div className="card glass-card" style={{ padding: '20px' }}>
            <div className="sec-hdr" style={{ marginBottom: 20 }}>
              <span className="sec-title" style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Zap size={16} color="var(--accent-purple)" /> 
                <span>System Status</span>
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nodes Connected</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="dot" style={{ width: 6, height: 6 }}></div>
                  Ethereum Sepolia Gateway
                </div>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Forensic Storage</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: 'var(--accent-teal)' }}>Pinata IPFS - ACTIVE</div>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Last Scan</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                  {stats.recentLogs?.[0]?.verifiedAt ? new Date(stats.recentLogs[0].verifiedAt).toLocaleTimeString() : 'No recent activity'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="card glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="sec-hdr" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <span className="sec-title" style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Clock size={16} color="var(--text-secondary)" /> 
              <span>Forensic Audit Log</span>
            </span>
            <button className="view-all" onClick={() => navigate('/my-files')}>View Full Ledger <ArrowRight size={14} /></button>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 24px' }}>Timestamp</th>
                  <th>Operation</th>
                  <th>Digital Asset</th>
                  <th style={{ textAlign: 'right', paddingRight: '24px' }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLogs.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Initial vault synchronization required.</td></tr>
                ) : (
                  stats.recentLogs.slice(0, 6).map((log, i) => (
                    <tr key={i} className="tr-click" onClick={() => navigate(`/files/${log.fileId}`)}>
                      <td style={{ padding: '12px 24px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(log.verifiedAt || log.uploadedAt).toLocaleString()}
                      </td>
                      <td>
                        <span style={{ 
                          fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: '4px', 
                          background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
                          border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                          {log.verifiedAt ? 'AUDIT' : 'SEAL'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <FileText size={14} color="var(--accent-cyan)" opacity={0.6} />
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{log.fileName || log.filename || log.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                        <span style={{
                          color: log.status === 'valid' ? 'var(--accent-teal)' : log.status === 'tampered' ? 'var(--accent-red)' : 'var(--accent-orange)',
                          fontWeight: 800,
                          fontSize: 11,
                          letterSpacing: '0.02em'
                        }}>
                          {log.status?.toUpperCase() || 'PROCESSED'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}