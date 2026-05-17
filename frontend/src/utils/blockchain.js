import { ethers } from 'ethers';

// ─── Contract config ────────────────────────────────────────
const CRYPTO_VAULT_ADDRESS = process.env.REACT_APP_CRYPTO_VAULT_ADDRESS;
const FILE_REGISTRY_ADDRESS = process.env.REACT_APP_FILE_REGISTRY_ADDRESS;

// ─── ABI — matches deployed CryptoVault.sol on Sepolia ──────
const ABI = [
  // sealFile(fileId, filename, fileHash, encryptedHash, mongoDbRef, cloudinaryUrl, fileSize)
  "function sealFile(string calldata _fileId, string calldata _filename, string calldata _fileHash, string calldata _encryptedHash, string calldata _mongoDbRef, string calldata _cloudinaryUrl, uint256 _fileSize) external",
  // verifyFile(fileId, currentHash) returns (isMatch)
  "function verifyFile(string calldata _fileId, string calldata _currentHash) external returns (bool isMatch)",
  // getFile(fileId) view
  "function getFile(string calldata _fileId) external view returns (string, string, string, string, uint256, uint256, address, bool)",
  // Events
  "event FileSealed(string indexed fileId, string filename, string fileHash, address owner, uint256 timestamp)",
  "event TamperDetected(string indexed fileId, string expectedHash, string receivedHash, uint256 timestamp)",
];

export const getTxUrl      = (h) => `https://sepolia.etherscan.io/tx/${h}`;
export const getAddressUrl = (a) => `https://sepolia.etherscan.io/address/${a}`;

// ─── Helper: get contract instance ──────────────────────────
const getContract = async (address, needSigner = false) => {
  if (!window.ethereum) throw new Error('MetaMask not found!');
  const provider = new ethers.BrowserProvider(window.ethereum);
  if (needSigner) {
    const signer = await provider.getSigner();
    return new ethers.Contract(address, ABI, signer);
  }
  return new ethers.Contract(address, ABI, provider);
};

// ─── MAIN SEAL FUNCTION ──────────────────────────────────────
// Triggers MetaMask to call sealFile() on the CryptoVault contract.
// Required: fileId, filename, fileHash
export const sealFileOnBlockchain = async (fileData) => {
  if (!window.ethereum) throw new Error('MetaMask not installed!');
  if (!CRYPTO_VAULT_ADDRESS) {
    console.error("CryptoVault address missing");
    throw new Error('Smart contract address missing in .env');
  }

  const fileId        = fileData.fileId || '';
  const filename      = fileData.filename || fileData.fileName || 'unnamed';
  const fileHash      = fileData.fileHash || fileData.hash || '';
  const encryptedHash = fileData.encryptedHash || '';
  const mongoDbRef    = fileData.mongoDbRef || fileId || '';
  const cloudinaryUrl = fileData.cloudinaryUrl || '';
  const fileSize      = Math.floor(Number(fileData.fileSize || 0));

  if (!fileHash || fileHash.length < 32) throw new Error('Invalid file hash');
  if (fileSize <= 0) throw new Error('File size must be greater than 0');

  console.log('[blockchain] Requesting MetaMask — sealFile for:', filename, '| hash:', fileHash.slice(0, 16) + '...');

  // Ensure MetaMask is connected
  await window.ethereum.request({ method: 'eth_requestAccounts' });

  const contract = await getContract(CRYPTO_VAULT_ADDRESS, true);

  try {
    const tx = await contract.sealFile(
      fileId,
      filename,
      fileHash,
      encryptedHash,
      mongoDbRef,
      cloudinaryUrl,
      fileSize,
      { gasLimit: 800000 } // Bypass ethers.js gas estimation issues
    );
    console.log('[blockchain] TX sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('[blockchain] TX confirmed:', receipt.hash, '| block:', receipt.blockNumber);

    return {
      success:     true,
      txHash:      receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed:     receipt.gasUsed?.toString() || '0',
    };
  } catch (err) {
    console.error('[blockchain] Smart contract revert error:', err);
    if (err.data && err.data.message) {
      console.error('[blockchain] Revert reason:', err.data.message);
    } else if (err.reason) {
      console.error('[blockchain] Revert reason:', err.reason);
    }
    throw err;
  }
};

// ─── VERIFY FILE ON CHAIN ────────────────────────────────────
// Calls verifyFile (note: this is non-view / emits event — use carefully)
export const verifyFileOnChain = async (fileId, currentHash) => {
  try {
    if (!FILE_REGISTRY_ADDRESS) {
      console.error("FileRegistry address missing");
      return { success: false, valid: false };
    }
    const contract = await getContract(FILE_REGISTRY_ADDRESS, false);
    // getFile is view — safe to call without gas
    const result = await contract.getFile(fileId);
    // result[2] is fileHash stored on chain
    const storedHash = result[2];
    return {
      success: true,
      valid:   storedHash?.toLowerCase() === currentHash?.toLowerCase(),
      owner:   result[6],
      timestamp: Number(result[4]) > 0
        ? new Date(Number(result[4]) * 1000).toLocaleString()
        : null,
    };
  } catch (e) {
    console.warn('[blockchain] verifyFileOnChain error:', e.message);
    return { success: false, valid: false };
  }
};