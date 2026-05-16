import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllFiles } from '../utils/api';
import {
  Activity, AlertTriangle, CheckCircle, ExternalLink,
  FileText, RefreshCw, Search, ShieldCheck, X, Archive
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Helpers ──────────────────────────────────────────────────────────
const fmtSize = b =>
  !b ? '—' : b < 1024 ? b + ' B' : b < 1048576
    ? (b / 1024).toFixed(1) + ' KB'
    : (b / 1048576).toFixed(2) + ' MB';

const fmtDate = dt =>
  dt ? new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';


function StatusBadge({ status, isExpired }) {
  const s = (status || '').toLowerCase();
  if (isExpired) return (
    <span className="badge" style={{ background: 'rgba(252,165,165,0.1)', color: '#fca5a5', border: '1px solid rgba(252,165,165,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <AlertTriangle size={11} /> EXPIRED
    </span>
  );
  if (s === 'valid') return (
    <span className="badge" style={{ background: 'rgba(0,200,150,0.1)', color: 'var(--accent-teal)', border: '1px solid rgba(0,200,150,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <CheckCircle size={11} /> VALID
    </span>
  );
  if (s === 'tampered') return (
    <span className="badge" style={{ background: 'rgba(255,68,68,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <AlertTriangle size={11} /> TAMPERED
    </span>
  );
  return (
    <span className="badge" style={{ background: 'rgba(255,140,66,0.1)', color: 'var(--accent-orange)', border: '1px solid rgba(255,140,66,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <Activity size={11} /> NOT_SYNCED
    </span>
  );
}


// ── Component ────────────────────────────────────────────────────────
export default function MyFiles({ walletAddress }) {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [processing, setProcessing] = useState(null);

  const fetchFiles = useCallback(async () => {
    if (!walletAddress) return;
    
    setLoading(true); 
    setError('');
    
    try {
      console.log("MyFiles: Requesting files for wallet:", walletAddress.toLowerCase());
      const res = await getAllFiles(walletAddress);
      
      // DEBUG: Log the full response
      console.log("MyFiles: API Response:", res);

      // Extract files array from response (handle both object/array cases)
      const data = res.files || (Array.isArray(res) ? res : []);
      
      // Double check wallet matching client-side (Optional but requested)
      const currentWallet = walletAddress.toLowerCase();
      const userFiles = data.filter(file => {
        const owner = (file.walletAddress || file.owner || '').toLowerCase();
        return owner === currentWallet || owner === ''; // Allow if no owner or matches
      });

      setFiles(userFiles);
    } catch (err) {
      console.error("MyFiles: Fetch Error:", err);
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { 
    fetchFiles(); 
  }, [fetchFiles]);

  const handleArchiveFile = async (fileId) => {
    if (!window.confirm("Move this asset to forensic archive?")) return;
    setProcessing(fileId);
    try {
      const { archiveFile } = await import('../utils/api');
      await archiveFile(fileId, walletAddress);
      toast.success("Asset moved to forensic archive");
      await fetchFiles();
    } catch (err) {
      toast.error(err.message || "Failed to archive asset");
    } finally {
      setProcessing(null);
    }
  };

  const handleRestore = async (fileId, name) => {
    if (!window.confirm("Restore this file from blockchain backup?")) return;
    setProcessing(fileId);
    try {
      const { restoreFile } = await import('../utils/api');
      await restoreFile(fileId, walletAddress);
      toast.success(`${name} has been restored in the vault.`);
      await fetchFiles();
    } catch (err) {
      toast.error(err.message || "Restoration failed");
    } finally {
      setProcessing(null);
    }
  };

  // ── Filter ──
  const q = query.trim().toLowerCase();
  const filtered = files.filter(f =>
    (f.fileName || f.name || f.filename || '').toLowerCase().includes(q)
  );

  return (
    <div className="page">
      <div className="page-inner">
        {/* Header */}
        <header className="ph">
          <div>
            <h1>Forensic Ledger</h1>
            <p>Immutable cryptographic records of all registered assets</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ref-btn" onClick={() => navigate('/archive')} style={{ background: 'rgba(148,163,184,0.08)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              <Archive size={14} /> <span>Forensic Archive</span>
            </button>
            <button className="ref-btn" onClick={fetchFiles}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> <span>Sync Ledger</span>
            </button>
          </div>
        </header>

        {error && <div className="card" style={{ padding: '12px 16px', background: 'rgba(255,62,62,0.08)', color: 'var(--accent-red)', border: '1px solid rgba(255,62,62,0.2)', marginBottom: 16, fontSize: 13, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} /> {error}
        </div>}

        {/* ── Search Bar ── */}
        <div className="search-bar" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 14, padding: '12px 20px',
          marginBottom: 16, transition: 'all 0.2s',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            placeholder="Search assets by filename or identifier..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 14, color: 'var(--text-primary)',
              fontFamily: 'var(--font-main)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', padding: 4 }}
            >
              <X size={16} />
            </button>
          )}
        </div>

      {/* Ledger Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-center"><div className="spin-ring" />Loading files...</div>
        ) : filtered.length === 0 ? (
          /* ── Empty / No-results state ── */
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: 16,
            }}>
              <Search size={24} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              {q ? 'No records matching your search' : 'No uploaded files found'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {q
                ? `We couldn't find any files matching "${query}". Try a different name.`
                : 'Upload your first file to get started.'}
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Filename</th>
                <th>Date</th>
                <th>Status</th>
                <th>TX Hash</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const fileId = f.fileId || f.id;
                const name = f.fileName || f.name || f.filename || 'Unknown';
                const txHash = f.txHash || '';
                const isExpired = f.isExpired || (f.expiryDate && new Date(f.expiryDate) < new Date());

                return (
                  <tr key={fileId} className="tr-click" onClick={() => navigate(`/files/${fileId}`)}>
                    {/* Filename */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FileText size={15} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                        <div>
                          <div className="fname">{name.length > 28 ? name.slice(0, 25) + '...' : name}</div>
                          <div className="ftype" style={{ fontSize: 10 }}>
                            {f.fileType || f.type || '—'} · {fmtSize(f.fileSize)}
                            {f.ipfsCID && <span style={{ marginLeft: 8, opacity: 0.7, color: 'var(--accent-purple)' }}>CID: {f.ipfsCID.slice(0, 8)}...</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Date */}
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {fmtDate(f.uploadedAt)}
                    </td>

                    {/* Status Badge */}
                    <td><StatusBadge status={f.status} isExpired={isExpired} /></td>

                    {/* TX Hash — clickable Etherscan link */}
                    <td>
                      {txHash && txHash.length === 66 ? ( 
                        <a
                          href={`https://sepolia.etherscan.io/tx/${txHash}`}
                          target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-purple)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          {txHash.slice(0, 8)}...{txHash.slice(-6)}
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{txHash ? 'Invalid/Pending' : '—'}</span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        {/* Verify Button */}
                        <button
                          className="btn btn-g"
                          style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={e => { 
                            e.stopPropagation(); 
                            navigate(`/verify?id=${f.fileId}`); 
                          }}
                          title="Verify this file"
                        >
                          <ShieldCheck size={13} /> Verify
                        </button>

                        {/* Restore Button (Forensic Logic) */}
                        {(f.status === 'tampered' || f.status === 'corrupted' || f.status === 'UNDER_INVESTIGATION') ? (
                          <button
                            className="btn btn-teal"
                            style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={e => { e.stopPropagation(); handleRestore(fileId, name); }}
                            disabled={processing === fileId}
                            title="Restore integrity from forensic backup"
                          >
                            <RefreshCw size={13} className={processing === fileId ? "spin" : ""} /> Restore
                          </button>
                        ) : (
                          <div style={{ width: 75 }} />
                        )}

                        {/* Blockchain Proof Button */}
                        {txHash ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${txHash}`}
                            target="_blank" rel="noreferrer"
                            className="btn btn-purple"
                            style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink size={13} /> Proof
                          </a>
                        ) : (
                          <div style={{ width: 68 }} />
                        )}

                        {/* Archive Button */}
                        <button
                          className="btn btn-g"
                          style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#64748b' }}
                          onClick={e => { e.stopPropagation(); handleArchiveFile(fileId); }}
                          disabled={processing === fileId}
                          title="Move to Archive"
                        >
                          {processing === fileId ? <RefreshCw size={13} className="spin" /> : <Archive size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>
          Showing {filtered.length} of {files.length} file{files.length !== 1 ? 's' : ''}
        </p>
      )}
      </div>
    </div>
  );
}
