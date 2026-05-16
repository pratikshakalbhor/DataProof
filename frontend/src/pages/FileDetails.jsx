import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFileById, getFileVersions } from '../utils/api';
import { generateCertificate } from '../utils/generateCertificate';
import {
  Activity, AlertTriangle, Award, CheckCircle,
  Clock, DownloadCloud, ExternalLink, FileText,
  Link, Search, ArrowLeft, Copy
} from 'lucide-react';

const fmtSize = b =>
  !b ? '—' : b < 1024 ? b + ' B' : b < 1048576
    ? (b / 1024).toFixed(1) + ' KB'
    : (b / 1048576).toFixed(2) + ' MB';

export default function FileDetails({ walletAddress }) {
  const { id }        = useParams();
  const navigate      = useNavigate();

  const [file,       setFile]       = useState(null);
  const [versions,   setVersions]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [copied,     setCopied]     = useState(false);

  // ── Fetch file by route param :id ──────────────────────────────
  useEffect(() => {
    if (!id) { setError('No file ID in URL'); setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getFileById(id),
      getFileVersions(id).catch(() => ({ versions: [] })),
    ]).then(([fileRes, verRes]) => {
      const f = fileRes.file || fileRes;
      setFile(f);
      if (verRes?.versions) setVersions(verRes.versions);
    }).catch(err => {
      setError(err.message || 'Failed to load file');
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-inner"><div className="loading-center"><div className="spin-ring" />Loading file...</div></div>;
  if (error)   return <div className="page-inner"><div className="error-box"><AlertTriangle size={16} /> {error}</div><button className="btn btn-g" style={{ marginTop: 12 }} onClick={() => navigate('/my-files')}>← Back to My Files</button></div>;
  if (!file)   return null;

  const name       = file.fileName || file.filename || file.name || 'Unknown';
  const hash       = file.hash || file.fileHash || '';
  const txHash     = file.txHash || '';
  const cloudURL   = file.cloudURL || file.ipfsURL || file.storageURL || '';
  const shareURL   = `${window.location.origin}/verify-public/${file.publicId || file.fileId || id}`;
  const isValid    = file.status === 'valid';
  const isTampered = file.status === 'tampered';
  const isExpired  = file.isExpired || (file.expiryDate && new Date(file.expiryDate) < new Date());
  const isImage    = file.fileType?.startsWith('image/') || /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(name);
  const isPdf      = file.fileType === 'application/pdf' || /\.pdf$/i.test(name);

  const handleCopy = () => {
    navigator.clipboard?.writeText(shareURL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCert = () => {
    generateCertificate({
      filename:     name,
      fileId:       file.fileId || id,
      uploadedAt:   file.uploadedAt,
      walletAddress: file.walletAddress || walletAddress,
      originalHash: hash,
      txHash,
    });
  };

  return (
    <div className="page-inner" style={{ maxWidth: 700 }}>
      {/* Back */}
      <button className="btn btn-g" style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => navigate(-1)}>
        <ArrowLeft size={15} /> Back
      </button>

      {/* Expiry warning */}
      {isExpired && (
        <div className="error-box" style={{ marginBottom: 15, background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle size={16} /> Verification expired on {new Date(file.expiryDate).toLocaleString()}
        </div>
      )}

      {/* Status Banner */}
      <div className={`vr ${isValid ? 'valid' : isTampered ? 'tampered' : ''}`} style={{ textAlign: 'center', marginBottom: 20 }}>
        <div className="vr-ico">{isValid ? <CheckCircle size={18} /> : isTampered ? <AlertTriangle size={18} /> : <Activity size={18} />}</div>
        <h2>{isValid ? 'This file is authentic' : isTampered ? 'This file is tampered!' : 'Verification Pending'}</h2>
        <p style={{ marginTop: 5, fontSize: 13 }}>
          {isValid
            ? 'Integrity verified on-chain. The file perfectly matches its original blockchain record.'
            : isTampered
            ? 'Warning: File contents do not match the original blockchain record.'
            : 'Being processed by the blockchain network.'}
        </p>
      </div>

      {/* File Preview */}
      <div className="preview-container" style={{ marginBottom: 20 }}>
        {isImage && cloudURL ? (
          <img src={cloudURL} alt={name} className="preview-img" />
        ) : isPdf && cloudURL ? (
          <embed src={cloudURL} type="application/pdf" width="100%" height="350px" style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }} />
        ) : (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <FileText size={48} style={{ color: 'var(--accent-cyan)', opacity: 0.4 }} />
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtSize(file.fileSize)} · {file.fileType || 'Unknown format'}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
        {cloudURL && (
          <a href={cloudURL} download={name} className="btn btn-teal" style={{ textDecoration: 'none' }}>
            <DownloadCloud size={15} /> Download File
          </a>
        )}
        <button className="btn btn-pu" onClick={handleCert} disabled={!isValid}>
          <Award size={15} /> Download Certificate
        </button>
        <button className="btn btn-g" onClick={handleCopy}>
          <Copy size={15} /> {copied ? 'Copied!' : 'Copy Share Link'}
        </button>
        <button className="btn btn-g" onClick={() => navigate(`/verify?id=${file.fileId || id}`)}>
          <Search size={15} /> Verify File
        </button>
      </div>

      {/* Blockchain Info */}
      <div className="ig">
        <div className="ig-hdr"><span><Link size={16} /></span><h3>Blockchain Audit Trail</h3></div>
        <div className="ig-row">
          <span className="ig-lbl">TX Hash</span>
          {txHash ? (
            <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-purple)', wordBreak: 'break-all', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {txHash} <ExternalLink size={11} />
            </a>
          ) : <span className="ig-val">—</span>}
        </div>
        <div className="ig-row"><span className="ig-lbl">SHA-256 Hash</span><span className="ig-val mono" style={{ wordBreak: 'break-all', fontSize: 10 }}>{hash || '—'}</span></div>
        <div className="ig-row"><span className="ig-lbl">Uploaded At</span><span className="ig-val">{file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : '—'}</span></div>
        <div className="ig-row"><span className="ig-lbl">Network</span><span className="ig-val" style={{ color: 'var(--accent-cyan)' }}>{file.network || 'Sepolia Testnet'}</span></div>
        {file.walletAddress && (
          <div className="ig-row"><span className="ig-lbl">Owner</span><span className="ig-val" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{file.walletAddress}</span></div>
        )}
      </div>

      {/* Version History */}
      {versions?.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3 className="sec-title" style={{ marginBottom: 15 }}><Clock size={16} /> Version History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {versions.map((v, i) => (
              <div key={i} style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent-teal)' }}>Version {v.versionNumber || i + 1}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.timestamp ? new Date(v.timestamp).toLocaleString() : '—'}</span>
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  Hash: {v.hash ? v.hash.slice(0, 24) + '...' : '—'}
                </div>
                {v.note && <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>Note: {v.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
