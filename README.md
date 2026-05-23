

# 🔐 DataProof — ChainLock

### Blockchain-Based Forensic File Vault & Integrity Verification System

> *"If it's on the blockchain, it cannot lie."*

An enterprise-grade, decentralized application that combines **SHA-256 cryptographic hashing**, **Ethereum smart contracts**, and **IPFS decentralized storage** to create an immutable proof of file authenticity — with forensic-grade tamper detection and instant file recovery.

<br/>

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-Vercel-black?style=for-the-badge)](https://file-proof.vercel.app/)
</div>

---

## 📖 What is DataProof?

In an era of deepfakes, ransomware, and silent data corruption, **proving the authenticity of digital files** is critical — especially in healthcare, banking, legal, and academic sectors.

**DataProof** solves this by creating a **cryptographic seal** for every uploaded file:

```
File Uploaded  →  SHA-256 Hash Generated  →  Hash Sealed on Ethereum Blockchain
     ↓
File Re-uploaded  →  New Hash Generated  →  Compared with Blockchain Record
     ↓
  Hash Match   →  ✅ VALID   (File is authentic)
  Hash Differs →  ⚠️ TAMPERED (File has been modified)
     ↓
Tampered?  →  Forensic Audit Report  →  Word-Level Diff  →  One-Click Restore
```

> **Real-World Impact:** The 2023 AIIMS Delhi ransomware attack compromised 40 million patient records. DataProof would have detected the tampering instantly.

---

## ✨ Features

| Feature | Description | Status |
|---------|-------------|--------|
| 🔗 **Blockchain Sealing** | Immutable SHA-256 fingerprint on Ethereum Sepolia | ✅ Live |
| 🔍 **Tamper Detection** | Instant cryptographic mismatch detection | ✅ Live |
| 🔬 **Forensic Diff Engine** | Word-level side-by-side comparison of original vs tampered | ✅ Live |
| 🔐 **AES-256 Encryption** | Military-grade encryption before IPFS upload | ✅ Live |
| 🌐 **Decentralized Storage** | Permanent file storage via Pinata IPFS | ✅ Live |
| 🔄 **One-Click Restore** | Recover original files from backup/IPFS | ✅ Live |
| 🦊 **MetaMask Auth** | Secure Web3 wallet authentication | ✅ Live |
| 📊 **Risk Score** | Animated 0–100 risk probability indicator | ✅ Live |
| 🔔 **Security Alerts** | Real-time tamper notifications with severity levels | ✅ Live |
| 📜 **Blockchain Log** | Full transaction history with Etherscan links | ✅ Live |
| 🗑️ **Trash & Restore** | Soft delete with 30-day recovery window | ✅ Live |
| 📄 **Proof Certificate** | Downloadable PDF integrity certificate | ✅ Live |

---

## 📸 Screenshots
 
<table>
  <tr>
    <td align="center">
      <b>🏠 Dashboard</b><br/>
      <img width="1917" height="890" alt="Dashboard" src="https://github.com/user-attachments/assets/49484eb1-fa1a-41d2-8503-78823edf449e" />
    </td>
    <td align="center">
      <b>⬆️ Upload & Seal</b><br/>
      <img width="1917" height="906" alt="Upload & Seal" src="https://github.com/user-attachments/assets/8a17a392-0337-47d4-84f9-e9f455668b5a" />
    </td>
  </tr>
  <tr>
    <td align="center">
      <b>✅ File Verified</b><br/>
      <img width="1917" height="895" alt="File Verified" src="https://github.com/user-attachments/assets/d8db29bc-499f-4210-bf8a-1d05803e116f" />
    </td>
    <td align="center">
      <b>⚠️ Tamper Detected</b><br/>
      <img width="1917" height="902" alt="Tamper Detected" src="https://github.com/user-attachments/assets/aaac93db-f1ca-49ec-b156-d62db5d0aa83" />
    </td>
  </tr>
  <tr>
    <td align="center">
      <b>🔬 Forensic Audit Report</b><br/>
      <img width="1917" height="897" alt="Forensic Audit Report" src="https://github.com/user-attachments/assets/85319120-79ae-4ac0-b775-3091478312eb" />
    </td>
    <td align="center">
      <b>⛓️ Blockchain Log</b><br/>
      <img width="1917" height="895" alt="Blockchain Log" src="https://github.com/user-attachments/assets/f0b6b607-3007-461b-a182-13510fa87f6e" />
    </td>
  </tr>
</table>


---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React.js 18, Framer Motion | Responsive dark-theme UI with animations |
| **Web3** | ethers.js v6, MetaMask | Blockchain interaction & wallet auth |
| **Backend** | Go (Golang) + Gin Framework | High-performance REST API & forensic engine |
| **Database** | MongoDB Atlas | File metadata & notification storage |
| **Storage** | IPFS via Pinata | Decentralized permanent file storage |
| **Blockchain** | Ethereum Sepolia, Solidity 0.8.19 | Immutable hash sealing & smart contracts |
| **Hashing** | SHA-256 (Go stdlib) | Cryptographic file fingerprinting |
| **Diff Engine** | react-diff-viewer-continued + mammoth.js | Word-level forensic comparison |

---

## 🔗 Smart Contracts

Deployed on **Ethereum Sepolia Testnet**:

```
FileRegistry Contract: 0x0E89b6130955fE7007915D89DC44F2f60291732f
CryptoVault Contract:  0x7D2F8c82Dd4f16725E19987dD5532Ea9e01E247f
```

### FileRegistry.sol — Core Functions

```solidity
// Register a file hash permanently on blockchain
function registerFile(string calldata fileHash) external

// Verify if a file hash is registered
function verifyFile(string calldata fileHash)
    external view
    returns (bool valid, address owner, uint256 timestamp)

// Get all file hashes by wallet owner
function getOwnerFiles(address owner)
    external view returns (string[] memory)

// Check if hash exists
function fileExists(string calldata fileHash)
    external view returns (bool)
```

### Events
```solidity
event FileRegistered(
    string  fileHash,
    address owner,
    uint256 timestamp
);
```

🔍 **View on Etherscan:**
- [FileRegistry Contract](https://sepolia.etherscan.io/address/0x0E89b6130955fE7007915D89DC44F2f60291732f)

---

## 🔄 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                             │
│                                                                 │
│   ┌──────────────────┐         ┌──────────────────────────┐    │
│   │   React.js       │         │   MetaMask Wallet        │    │
│   │   Frontend       │◄───────►│   (Web3 Auth)            │    │
│   │   :3000          │         │                          │    │
│   └────────┬─────────┘         └────────────┬─────────────┘    │
└────────────┼─────────────────────────────────┼─────────────────┘
             │ REST API                         │ ethers.js
             ▼                                 ▼
┌────────────────────────┐     ┌────────────────────────────────┐
│   Go (Gin) Backend     │     │   Ethereum Sepolia Testnet     │
│   :5000                │     │                                │
│                        │     │   FileRegistry.sol             │
│  • SHA-256 Hashing     │     │   registerFile(hash)           │
│  • File Processing     │     │   verifyFile(hash)             │
│  • Forensic Engine     │     │                                │
│  • IPFS Upload         │     │   TX Hash → Etherscan          │
└────────┬───────────────┘     └────────────────────────────────┘
         │
   ┌─────┴──────────────────────┐
   │                            │
   ▼                            ▼
┌──────────────┐     ┌──────────────────────────┐
│ MongoDB Atlas│     │   IPFS via Pinata        │
│              │     │                          │
│ • fileId     │     │ • Encrypted file storage │
│ • filename   │     │ • Content-addressed CID  │
│ • hash       │     │ • Permanent & immutable  │
│ • walletAddr │     │                          │
│ • txHash     │     └──────────────────────────┘
│ • ipfsCID    │
│ • status     │     ┌──────────────────────────┐
│ • backupPath │     │   Local Storage          │
└──────────────┘     │                          │
                     │ backup/ → original files │
                     │ vault/  → tampered files │
                     └──────────────────────────┘
```

---

## 🔬 Forensic Audit System

When tampering is detected, ChainLock activates its **Forensic Audit Engine**:

```
Tampered File Detected
        ↓
Extract Text (mammoth.js for .docx, raw for .txt)
        ↓
Line-by-Line LCS Diff Algorithm
        ↓
Generate Diff Report:
  ✅ Unchanged lines → shown normally
  🔴 Removed lines  → highlighted RED
  🟢 Added lines    → highlighted GREEN
        ↓
Risk Score Calculation (0–100)
        ↓
Side-by-Side Forensic Modal
  [Original Secured] | [Tampered Version]
        ↓
One-Click Restore from backup/IPFS
```

**Supported formats for text diff:**
`.txt` `.json` `.csv` `.md` `.go` `.py` `.js` `.ts` `.html` `.docx`

**Binary files (.pdf, .png, .jpg):** Preview comparison via base64

---

## 📦 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload file → hash → IPFS → blockchain |
| `POST` | `/api/verify` | Verify file integrity against blockchain |
| `GET`  | `/api/files` | Get all files by wallet address |
| `GET`  | `/api/files/:id` | Get single file details |
| `GET`  | `/api/files/:id/download` | Download original file |
| `POST` | `/api/restore/:id` | Restore original + update status |
| `GET`  | `/api/file/forensic-compare/:fileId` | Generate forensic diff report |
| `PUT`  | `/api/files/:id/revoke` | Revoke file access |
| `DELETE`| `/api/files/:id` | Soft delete (trash) |
| `GET`  | `/api/stats` | Dashboard statistics |
| `GET`  | `/api/notifications` | Security alerts |
| `GET`  | `/api/public/verify/:id` | Public verification (no auth) |

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js 18+
- Go 1.21+
- MongoDB Atlas account
- MetaMask browser extension
- Pinata IPFS account
- Sepolia testnet ETH (free from faucet)

### 1. Clone Repository
```bash
git clone https://github.com/pratikshakalbhor/ChainLock.git
cd ChainLock
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm install ethers mammoth react-diff-viewer-continued framer-motion
```

### 3. Backend Setup
```bash
cd go-backend
go mod tidy
mkdir backup vault
```

```
### 4. Run Application

```bash
# Terminal 1 — Backend
cd go-backend
go run main.go
# ✅ MongoDB Connected!
# ✅ Server running on :5000

# Terminal 2 — Frontend
cd frontend
npm start
# ✅ App running on localhost:3000
```

### 5. Connect MetaMask
1. Install [MetaMask](https://metamask.io/download/)
2. Switch to **Sepolia Testnet**
3. Get free test ETH: [sepoliafaucet.com](https://sepoliafaucet.com)
4. Open `localhost:3000` → Click **Connect Wallet**

---

## 📁 Project Structure

```
📦 ChainLock/
 ┣ 📂 frontend/
 ┃ ┣ 📂 src/
 ┃ ┃ ┣ 📂 pages/
 ┃ ┃ ┃ ┣ 📜 Dashboard.jsx      # Stats + file list
 ┃ ┃ ┃ ┣ 📜 Upload.jsx         # File upload + blockchain seal
 ┃ ┃ ┃ ┣ 📜 Verify.jsx         # Integrity verification
 ┃ ┃ ┃ ┣ 📜 MyFiles.jsx        # File management
 ┃ ┃ ┃ ┣ 📜 BlockchainLog.jsx  # TX history
 ┃ ┃ ┃ ┣ 📜 RecoveryHub.jsx    # Tampered file recovery
 ┃ ┃ ┃ ┗ 📜 TamperAlerts.jsx   # Security alerts
 ┃ ┃ ┣ 📂 components/
 ┃ ┃ ┃ ┣ 📜 ForensicModal.jsx  # Full-screen forensic report
 ┃ ┃ ┃ ┣ 📜 Sidebar.jsx        # Navigation
 ┃ ┃ ┃ ┣ 📜 Topbar.jsx         # Header + notifications
 ┃ ┃ ┃ ┗ 📜 NotificationDropdown.jsx
 ┃ ┃ ┣ 📂 utils/
 ┃ ┃ ┃ ┣ 📜 blockchain.js      # ethers.js + MetaMask
 ┃ ┃ ┃ ┗ 📜 api.js             # Backend API calls
 ┃ ┃ ┗ 📂 styles/              # Component CSS files
 ┃ ┗ 📜 .env
 ┃
 ┣ 📂 go-backend/
 ┃ ┣ 📂 handlers/
 ┃ ┃ ┣ 📜 upload.go            # File upload + hashing
 ┃ ┃ ┣ 📜 verify.go            # Integrity checking
 ┃ ┃ ┣ 📜 files.go             # CRUD + download
 ┃ ┃ ┣ 📜 forensic_compare.go  # Diff engine
 ┃ ┃ ┣ 📜 notifications.go     # Alert system
 ┃ ┃ ┗ 📜 certificate.go       # PDF generation
 ┃ ┣ 📂 models/
 ┃ ┃ ┗ 📜 file.go              # MongoDB schema
 ┃ ┣ 📂 database/
 ┃ ┃ ┗ 📜 db.go                # MongoDB connection
 ┃ ┣ 📂 utils/
 ┃ ┃ ┣ 📜 hash.go              # SHA-256 functions
 ┃ ┃ ┣ 📜 hash_test.go         # Unit tests
 ┃ ┃ ┗ 📜 pinata.go            # IPFS upload
 ┃ ┣ 📂 routes/
 ┃ ┃ ┗ 📜 routes.go            # API routing
 ┃ ┣ 📂 backup/                # Original file backups
 ┃ ┣ 📂 vault/                 # Tampered file copies
 ┃ ┣ 📜 main.go                # Entry point
 ┃ ┗ 📜 .env
 ┃
 ┣ 📂 contracts/
 ┃ ┣ 📜 FileRegistry.sol       # Core hash registry
 ┃ ┣ 📜 CryptoVault.sol        # Advanced vault contract
 ┃ ┗ 📂 abi/                   # Compiled ABIs
 ┃
 ┣ 📜 render.yaml              # Render deployment config
 ┗ 📜 README.md
```

---

## 🧪 Testing

### Run Backend Unit Tests
```bash
cd go-backend
go test ./utils/ -v

# Expected output:
# === RUN   TestGenerateSHA256FromBytes  ✅ PASS
# === RUN   TestHashConsistency          ✅ PASS
# === RUN   TestHashUniqueness           ✅ PASS
# === RUN   TestTamperDetection          ✅ PASS
# === RUN   TestEmptyHash                ✅ PASS
# PASS — cryptovault/utils (0.805s)
```

### Functional Testing Results

| Test Case | Expected | Result | Status |
|-----------|----------|--------|--------|
| Upload .docx file | Hash generated + sealed | ✅ Working | PASS |
| Upload .pdf file | Hash generated + sealed | ✅ Working | PASS |
| Verify same file | VALID result | ✅ Working | PASS |
| Verify modified file | TAMPERED detected | ✅ Working | PASS |
| MetaMask TX signing | Popup + confirmation | ✅ Working | PASS |
| Blockchain sealing | TX hash received | ✅ Working | PASS |
| File restore | Original downloaded | ✅ Working | PASS |
| Forensic diff | Word-level diff shown | ✅ Working | PASS |
| Notification alert | Bell badge updates | ✅ Working | PASS |

---

## 🔐 Security Features

- **Zero-Knowledge Storage:** Server never stores unencrypted files
- **Cryptographic Hashing:** SHA-256 produces unique 64-char fingerprint
- **Immutable Audit Trail:** Blockchain records cannot be altered or deleted
- **Decentralized Storage:** IPFS eliminates single points of failure
- **MetaMask Auth:** No username/password — wallet-based identity
- **Hash Normalization:** Consistent `0x` prefix handling prevents false mismatches
- **CORS Protection:** Strict origin headers on all API endpoints

---

## 🚀 Deployment

### Frontend → Vercel
```bash
cd frontend
npm run build

# Vercel Dashboard:
# Framework: Create React App
# Root Directory: frontend
# Environment Variables: Add REACT_APP_* vars
```

### Backend → Render
```yaml
# render.yaml
services:
  - type: web
    name: dataproof-backend
    runtime: go
    rootDir: go-backend
    buildCommand: CGO_ENABLED=0 go build -o main .
    startCommand: ./main
    envVars:
      - key: CGO_ENABLED
        value: 0
      - key: GIN_MODE
        value: release
```

### Smart Contract → Remix IDE
1. Open [remix.ethereum.org](https://remix.ethereum.org)
2. Paste `FileRegistry.sol`
3. Compile with Solidity `0.8.19`
4. Deploy → Injected Provider (MetaMask) → Sepolia
5. Copy deployed address → `.env`

---

## 🌐 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: DataProof CI

on: [push, pull_request]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with: { go-version: '1.21' }
      - run: cd go-backend && go test ./utils/ -v

  frontend-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '18' }
      - run: cd frontend && npm ci && npm run build
```

---

## 📊 Future Improvements

| Feature | Priority | Description |
|---------|----------|-------------|
| 🔗 Multi-Chain Support | High | Polygon, Arbitrum L2 integration |
| 🤖 AI Threat Detection | Medium | ML-based tampering pattern recognition |
| 📱 Mobile App | Medium | React Native cross-platform app |
| 🔑 Multi-Sig Vaults | Medium | Multi-stakeholder file approval |
| 🕵️ zk-SNARKs | Low | Zero-knowledge proof of ownership |
| 🌍 GDPR Module | Low | Compliance & data retention policies |

---

## 📚 References

| Resource | Link |
|----------|------|
| Ethereum Docs | [ethereum.org/developers](https://ethereum.org/en/developers/docs/) |
| Solidity Docs | [docs.soliditylang.org](https://docs.soliditylang.org/en/v0.8.19/) |
| React.js | [react.dev](https://react.dev/) |
| Go Gin | [gin-gonic.com](https://gin-gonic.com/docs/) |
| MongoDB | [mongodb.com/docs](https://www.mongodb.com/docs/manual/) |
| MetaMask | [docs.metamask.io](https://docs.metamask.io/) |
| IPFS | [docs.ipfs.tech](https://docs.ipfs.tech/) |
| Pinata | [docs.pinata.cloud](https://docs.pinata.cloud/) |
| ethers.js v6 | [docs.ethers.org](https://docs.ethers.org/v6/) |

---
