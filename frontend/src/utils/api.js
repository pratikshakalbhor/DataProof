// ─────────────────────────────────────────
// api.js — Go Backend API calls
// Base URL: http://localhost:5000
// ─────────────────────────────────────────
import axios from 'axios';

const BASE_URL = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/api\/?$/, '');

// ── Binary Download Helper — URL.createObjectURL ──
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(new Blob([blob]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────
// 1. UPLOAD FILE
// ─────────────────────────────────────────
export const uploadFile = async (file, wallet, expiry, parentId, note, fileHash) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("wallet", (wallet || "").toLowerCase());
  if (expiry) formData.append("expiryDate", expiry);
  if (parentId) formData.append("parentFileId", parentId);
  if (note) formData.append("versionNote", note);
  if (fileHash) formData.append("fileHash", fileHash);

  const res = await axios.post(`${BASE_URL}/api/upload`, formData);
  return res.data;
};

// ─────────────────────────────────────────
// 2. VERIFY FILE
// ─────────────────────────────────────────
export const verifyFile = async (file, fileId, wallet) => {
  const formData = new FormData();
  formData.append("file", file);
  if (fileId) formData.append("fileId", fileId);
  if (wallet) formData.append("wallet", wallet.toLowerCase());

  const res = await axios.post(`${BASE_URL}/api/verify`, formData);
  return res.data;
};

// ─────────────────────────────────────────
// 3. GET ALL FILES
// ─────────────────────────────────────────
export const getAllFiles = async (walletAddress, isBlockchain = false) => {
  if (!walletAddress) return { files: [], count: 0 };
  const wallet = walletAddress.toLowerCase();
  let query = `?wallet=${wallet}`;
  if (isBlockchain) query += "&blockchain=true";
  
  const res = await axios.get(`${BASE_URL}/api/files${query}`);
  return res.data;
};

export const getFileById = async (fileId) => {
  const res = await axios.get(`${BASE_URL}/api/files/${fileId}`);
  return res.data;
};

export const getFileVersions = async (fileId) => {
  const res = await axios.get(`${BASE_URL}/api/files/${fileId}/versions`);
  return res.data;
};

// ─────────────────────────────────────────
// 4. ARCHIVE & RESTORE
// ─────────────────────────────────────────
export const archiveFile = async (fileId, wallet) => {
  const res = await axios.put(`${BASE_URL}/api/files/${fileId}/archive`, { wallet: wallet?.toLowerCase() });
  return res.data;
};

export const getArchivedFiles = async (walletAddress) => {
  const wallet = (walletAddress || "").toLowerCase();
  const query = wallet ? `?wallet=${wallet}` : "";
  const res = await axios.get(`${BASE_URL}/api/files/archive/all${query}`);
  return res.data;
};

export const restoreFromArchive = async (fileId, wallet) => {
  const res = await axios.post(`${BASE_URL}/api/files/${fileId}/restore-archive`, { wallet: wallet?.toLowerCase() });
  return res.data;
};

// ─────────────────────────────────────────
// 5. RESTORE FILE (Internal Backend Override Only)
// ─────────────────────────────────────────
export const restoreFile = async (fileId, wallet) => {
  try {
    const res = await axios.post(`${BASE_URL}/api/restore/${fileId}`, { wallet: wallet?.toLowerCase() });
    return res.data;
  } catch (err) {
    console.error('Restore error:', err);
    throw new Error(err.response?.data?.error || err.message || 'Restoration failed');
  }
};

// ─────────────────────────────────────────
// 6. GET STATS
// ─────────────────────────────────────────
export const getStats = async (walletAddress) => {
  const wallet = (walletAddress || "").toLowerCase();
  const query = wallet ? `?wallet=${wallet}` : "";
  const res = await axios.get(`${BASE_URL}/api/stats${query}`);
  return res.data;
};

// ─────────────────────────────────────────
// 7. EXTRAS
// ─────────────────────────────────────────
export const downloadOriginalFile = async (fileId, filename) => {
  const res = await axios.get(`${BASE_URL}/api/files/${fileId}/download`, { responseType: 'blob' });
  downloadBlob(res.data, filename);
};

export const downloadCertificate = async (fileId) => {
  const res = await axios.get(`${BASE_URL}/api/files/${fileId}/certificate`, { responseType: 'blob' });
  downloadBlob(res.data, `Certificate_${fileId}.pdf`);
};

export const getAuditLogs = async (walletAddress) => {
  const wallet = (walletAddress || "").toLowerCase();
  const query = wallet ? `?wallet=${wallet}` : "";
  const res = await axios.get(`${BASE_URL}/api/audit-logs${query}`);
  return res.data;
};

export const healthCheck = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/`);
    return res.status === 200;
  } catch {
    return false;
  }
};