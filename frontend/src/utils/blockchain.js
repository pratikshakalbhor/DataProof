import { ethers } from 'ethers';

// ─── Contract config ────────────────────────────────────────
const CRYPTO_VAULT_CONTRACT_ADDRESS = process.env.REACT_APP_CRYPTO_VAULT_ADDRESS;
const FILE_REGISTRY_CONTRACT_ADDRESS = process.env.REACT_APP_FILE_REGISTRY_ADDRESS;
const SEPOLIA_CHAIN_ID = '0xaa36a7'; // Sepolia Testnet Hex ID

// ─── ABIs — extracted from frontend/contracts/abi/ ──────────────────────────
// ABI for CryptoVault.sol (for sealing and getting file details)
const CRYPTO_VAULT_ABI = [
  // sealFile(fileId, filename, fileHash, encryptedHash, mongoDbRef, cloudinaryUrl, fileSize)
  "function sealFile(string calldata _fileId, string calldata _filename, string calldata _fileHash, string calldata _encryptedHash, string calldata _mongoDbRef, string calldata _cloudinaryUrl, uint256 _fileSize) external",
  // getFile(fileId) view
  // Corrected ABI based on CryptoVault.json context: (filename, ipfsCID, encryptedHash, fileSize, uploadedAt, owner, isRevoked)
  "function getFile(string calldata _fileId) external view returns (string, string, string, uint256, uint256, address, bool)",
  // Events
  "event FileSealed(string indexed fileId, string filename, string fileHash, address owner, uint256 timestamp)",
  "event TamperDetected(string indexed fileId, string expectedHash, string receivedHash, uint256 timestamp)",
];

// ABI for FileRegistry.sol (for verifying file existence and basic details)
const FILE_REGISTRY_ABI = [
  // registerFile(fileHash)
  "function registerFile(string calldata fileHash) external",
  // verifyFile(fileHash) external view returns (bool valid, address owner, uint256 ts)
  "function verifyFile(string calldata fileHash) external view returns (bool valid, address owner, uint256 ts)",
  // fileExists(fileHash) external view returns (bool)
  "function fileExists(string calldata fileHash) external view returns (bool)",
  // getOwnerFiles(address user) external view returns (string[] memory)
  "function getOwnerFiles(address user) external view returns (string[] memory)",
  // Events
  "event FileRegistered(string fileHash, address owner, uint256 timestamp)",
];

export const getTxUrl      = (h) => `https://sepolia.etherscan.io/tx/${h}`;
export const getAddressUrl = (a) => `https://sepolia.etherscan.io/address/${a}`;

// ─── Helper: Ensure Sepolia Network ────────────────────────
const ensureSepoliaNetwork = async () => {
  if (!window.ethereum) return;
  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (currentChainId !== SEPOLIA_CHAIN_ID) {
    try {
      // Attempt to switch to Sepolia
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: SEPOLIA_CHAIN_ID,
            chainName: 'Sepolia Testnet',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://rpc.sepolia.org'],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          }],
        });
      }
    }
  }
};

// ─── Helper: get contract instance ──────────────────────────
const getContract = async (address, abi, needSigner = false) => {
  if (!window.ethereum) throw new Error('MetaMask not found!');
  await ensureSepoliaNetwork(); // Force Sepolia check before every call
  
  const provider = new ethers.BrowserProvider(window.ethereum);
  if (needSigner) {
    const signer = await provider.getSigner();
    return new ethers.Contract(address, abi, signer);
  }
  return new ethers.Contract(address, abi, provider);
};

// ─── MAIN SEAL FUNCTION ──────────────────────────────────────
// Triggers MetaMask to call sealFile() on the CryptoVault contract.
// Required: fileId, filename, fileHash
export const sealFileOnBlockchain = async (fileData) => {
  if (!window.ethereum) throw new Error('MetaMask not installed!');
  if (!CRYPTO_VAULT_CONTRACT_ADDRESS) {
    console.error("CryptoVault address missing");
    throw new Error('CryptoVault smart contract address missing in .env');
  }

  const fileId        = fileData.fileId || '';
  const filename      = fileData.filename || fileData.fileName || 'unnamed';
  const fileHash      = fileData.fileHash || fileData.hash || '';
  const encryptedHash = fileData.encryptedHash || '';
  const mongoDbRef    = fileData.mongoDbRef || fileId || '';
  const cloudinaryUrl = fileData.cloudinaryUrl || '';
  const fileSize      = Math.floor(Number(fileData.fileSize || 0));

  if (!fileHash || fileHash.length < 16) throw new Error('Invalid file hash');
  if (fileSize <= 0) throw new Error('File size must be greater than 0');

  console.log('[blockchain] Requesting MetaMask — sealFile for:', filename, '| hash:', fileHash.slice(0, 16) + '...');
  const contract = await getContract(CRYPTO_VAULT_CONTRACT_ADDRESS, CRYPTO_VAULT_ABI, true);

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
export const verifyFileOnChain = async (fileHash) => {
  if (!window.ethereum) {
    console.error("[blockchain] MetaMask not found during verification");
    return { success: false, valid: false, error: 'MetaMask not found' };
  }

  if (!fileHash || typeof fileHash !== 'string' || fileHash.trim() === '') {
    console.error("[blockchain] Invalid or empty fileHash provided:", fileHash);
    return { success: false, valid: false, error: 'Invalid or empty file hash provided' };
  }

  try {
    // Use specific FileRegistry address, fallback to generic CONTRACT_ADDRESS
    const ADDRESS = FILE_REGISTRY_CONTRACT_ADDRESS || process.env.REACT_APP_CONTRACT_ADDRESS;

    if (!ADDRESS || ADDRESS === "0xNEW_ADDRESS_HERE") {
      console.error("[blockchain] FileRegistry contract address missing in .env");
      return { success: false, valid: false, error: 'Smart contract address missing in .env' };
    }

    console.log(`[blockchain] verifyFileOnChain called. Target: ${ADDRESS} | Hash: ${fileHash}`);
    const contract = await getContract(ADDRESS, FILE_REGISTRY_ABI, false); 
    
    // ✅ Hash normalize — ensure no 0x prefix for string comparison
    const hash = fileHash.replace(/^0x/, '').toLowerCase();
    
    // ✅ fileExists check first — no revert risk
    let exists = false;
    try {
      console.log(`[blockchain] Initiating contract.fileExists("${hash}")...`);
      exists = await contract.fileExists(hash);
    } catch (e) {
      console.warn("[blockchain] fileExists call failed. Contract might not be a FileRegistry or wrong network:", e.message);
      return { success: false, valid: false, error: `Blockchain call failed: ${e.message}` };
    }
    
    if (!exists) {
      console.log(`[blockchain] File with hash ${hash} does not exist in registry.`);
      return { success: true, valid: false }; // Call succeeded, but file is not there
    }

    console.log(`[blockchain] File exists. Fetching details via contract.verifyFile("${hash}")...`);
    const [valid, owner, timestamp] = await contract.verifyFile(hash);
    console.log("[blockchain] Raw verify result:", { 
      valid, owner, timestamp: Number(timestamp) 
    });

    return {
      success:   true,
      valid,
      owner,
      timestamp: Number(timestamp) > 0
        ? new Date(Number(timestamp) * 1000).toLocaleString()
        : null,
    };
  } catch (err) {
    // Outer catch for fatal errors (network, missing contract code, etc.)
    console.error('[blockchain] verifyFileOnChain fatal error:', err.message);
    if (err.code === 'CALL_EXCEPTION') {
      console.error('[blockchain] CALL_EXCEPTION: Verify that the contract address in .env is correct and MetaMask is on Sepolia.');
      console.error('[blockchain] Error Details:', err);
    }

    return {
      success: false,
      valid:   false,
      error:   err.message,
    };
  }
};

// ─── GET FILE DETAILS ON CHAIN ────────────────────────────────────
// Calls getFile() on the CryptoVault contract to retrieve file metadata.
export const getFileOnChain = async (fileId) => {
  if (!window.ethereum) {
    console.error("[blockchain] MetaMask not found during getFileOnChain");
    return { success: false, error: 'MetaMask not found' };
  }

  if (!fileId || typeof fileId !== 'string') {
    console.error("[blockchain] Invalid or empty fileId provided:", fileId);
    return { success: false, error: 'Invalid file ID provided.' };
  }

  try {
    if (!CRYPTO_VAULT_CONTRACT_ADDRESS) {
      console.error("[blockchain] CryptoVault address missing");
      return { success: false, error: 'CryptoVault smart contract address missing in .env' };
    }

    console.log(`[blockchain] getFileOnChain called. Target: ${CRYPTO_VAULT_CONTRACT_ADDRESS} | File ID: ${fileId}`);
    const contract = await getContract(CRYPTO_VAULT_CONTRACT_ADDRESS, CRYPTO_VAULT_ABI, false);
    
    const [filename, ipfsCID, encryptedHash, fileSize, uploadedAt, owner, isRevoked] = await contract.getFile(fileId);

    return { success: true, filename, ipfsCID, encryptedHash, fileSize: Number(fileSize), uploadedAt: Number(uploadedAt), owner, isRevoked };
  } catch (err) {
    console.error('[blockchain] getFileOnChain error:', err);
    return { success: false, error: err.message };
  }
};