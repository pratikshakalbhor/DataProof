package handlers

import (
	"context"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"

	"cryptovault/database"
	"cryptovault/models"
	"cryptovault/utils"
)

// UploadFile — POST /api/upload
func UploadFile(c *gin.Context) {
	// ── 1. Receive file ─────────────────────────────────────────────────────
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File not found in request"})
		return
	}
	defer file.Close()

	wallet := strings.ToLower(c.PostForm("wallet"))
	if wallet == "" {
		wallet = strings.ToLower(c.Request.FormValue("walletAddress"))
	}
	if wallet == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Wallet address required"})
		return
	}

	signature := c.PostForm("signature")
	message := c.PostForm("message")
	clientFileHash := c.PostForm("fileHash")
	parentFileId := c.PostForm("parentFileId")

	// ── 2. Hash raw bytes ────────────────────────────────────────────────────
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		log.Printf("❌ Failed to read uploaded file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "File read error"})
		return
	}

	// Hash stored WITHOUT 0x prefix for consistency
	fileHash := strings.ToLower(utils.GenerateSHA256FromBytes(fileBytes))

	if clientFileHash != "" && !strings.EqualFold(strings.TrimPrefix(clientFileHash, "0x"), fileHash) {
		log.Printf("❌ Hash mismatch: Client(%s) != Server(%s)", clientFileHash, fileHash)
		c.JSON(http.StatusBadRequest, gin.H{"error": "File integrity check failed — hash mismatch"})
		return
	}

	collection := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// ── 3. Duplicate prevention ───────────────────────────────────────────────
	var existing models.FileRecord
	if err := collection.FindOne(ctx, bson.M{"$or": []bson.M{
		{"originalHash": fileHash},
		{"originalHash": "0x" + fileHash},
	}}).Decode(&existing); err == nil {
		log.Printf("⚠️  Duplicate file detected in DB: %s", existing.FileID)
		c.JSON(http.StatusOK, gin.H{
			"success":  true,
			"fileId":   existing.FileID,
			"publicId": existing.PublicID,
			"fileHash": fileHash,
			"filename": existing.Filename,
			"txHash":   existing.TxHash,
			"ipfsCID":  existing.IpfsCID,
			"ipfsURL":  existing.EncryptedURL,
			"message":  "File already registered",
			"existing": true,
		})
		return
	}

	// ── 4. Signature verification ─────────────────────────────────────────────
	if signature != "" {
		if message == "" {
			message = fmt.Sprintf("Verify file ownership: %s", clientFileHash)
		}
		recoveredAddr, err := utils.RecoverSigner(message, signature)
		if err != nil {
			log.Printf("❌ Signature recovery failed: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Invalid digital signature"})
			return
		}
		if !strings.EqualFold(recoveredAddr, wallet) {
			log.Printf("❌ Signer mismatch: %s != %s", recoveredAddr, wallet)
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Wallet signature mismatch"})
			return
		}
		log.Printf("✅ Digital signature verified for: %s", recoveredAddr)
	}

	// ── 5. AES-GCM encryption ─────────────────────────────────────────────────
	encryptedBytes, err := utils.EncryptAES(fileBytes)
	if err != nil {
		log.Printf("❌ Encryption failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "File encryption failed"})
		return
	}

	// ── 6. Upload to Pinata/IPFS (PRIMARY storage) ────────────────────────────
	ipfsURL, ipfsCID, err := utils.UploadToPinata(encryptedBytes, header.Filename)
	if err != nil {
		log.Printf("❌ Pinata upload FAILED: %v", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":  "IPFS upload failed — file cannot be stored permanently",
			"detail": err.Error(),
		})
		return
	}
	log.Printf("📦 [UPLOAD] File uploaded to IPFS — CID: %s | URL: %s", ipfsCID, ipfsURL)

	// Allow frontend override URL
	if frontendURL := c.PostForm("encryptedUrl"); frontendURL != "" {
		ipfsURL = frontendURL
	} else if cloudURL := c.PostForm("cloudinaryUrl"); cloudURL != "" {
		ipfsURL = cloudURL
	}

	// ── 7. Parse optional metadata ───────────────────────────────────────────
	fileID := fmt.Sprintf("FILE-%d", time.Now().Unix())
	publicID := randomString(10)
	txHash := ""

	expiryStr := c.PostForm("expiryDate")
	var expiryDate *time.Time
	if expiryStr != "" {
		if t, e := time.Parse(time.RFC3339, expiryStr); e == nil {
			expiryDate = &t
		} else if t, e := time.Parse("2006-01-02T15:04:05", expiryStr); e == nil {
			expiryDate = &t
		} else if t, e := time.Parse("2006-01-02", expiryStr); e == nil {
			expiryDate = &t
		} else {
			log.Printf("⚠️  Could not parse expiry date: %s", expiryStr)
		}
	}

	// ── 7.5 Local Forensic Cache (Demo/Recovery) ─────────────────────────────
	// Note: Local folders are temporary on Render/Vercel.
	// IPFS + MongoDB are the permanent storage layers.
	// backup/ and vault/ are used for local forensic recovery and audit evidence.
	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = "backup"
	}
	vaultDir := os.Getenv("VAULT_DIR")
	if vaultDir == "" {
		vaultDir = "vault"
	}
	os.MkdirAll(backupDir, os.ModePerm)
	os.MkdirAll(vaultDir, os.ModePerm)

	// ── 8. Version update or new record ──────────────────────────────────────
	if parentFileId != "" {
		// ── VERSION UPDATE PATH ────────────────────────────────────────────
		var parent models.FileRecord
		if err := collection.FindOne(ctx, bson.M{"fileId": parentFileId}).Decode(&parent); err == nil {
			newVersion := parent.Version + 1
			ext := filepath.Ext(header.Filename)

			vaultPath := filepath.Join(vaultDir, header.Filename)
			if err := os.WriteFile(vaultPath, fileBytes, 0644); err != nil {
				log.Printf("❌ Failed to write raw file to vault: %v", err)
			}

			backupPath := filepath.Join(backupDir, parentFileId)
			if err := os.WriteFile(backupPath, encryptedBytes, 0644); err != nil {
				log.Printf("❌ Failed to write encrypted backup: %v", err)
			}

			log.Println("File uploaded:", header.Filename)
			log.Println("Backup created:", backupPath)
			log.Println("Stored in vault:", vaultPath)

			var extractedText string
			if strings.ToLower(ext) == ".docx" {
				text, err := extractDocxText(vaultPath)
				if err == nil {
					extractedText = text
					txtPath := filepath.Join(backupDir, parentFileId+"_text.txt")
					os.WriteFile(txtPath, []byte(text), 0644)
				}
			}

			_, _ = collection.UpdateOne(ctx,
				bson.M{"fileId": parentFileId},
				bson.M{
					"$set": bson.M{
						"originalHash":  fileHash,
						"ipfsCID":       ipfsCID,
						"encryptedUrl":  ipfsURL,
						"txHash":        txHash,
						"fileSize":      header.Size,
						"mimeType":      header.Header.Get("Content-Type"),
						"version":       newVersion,
						"uploadedAt":    time.Now(),
						"backupPath":    backupPath,
						"vaultPath":     vaultPath,
						"extractedText": extractedText,
					},
					"$push": bson.M{
						"versions": models.VersionRecord{
							Version:   newVersion,
							Hash:      ipfsCID,
							TxHash:    txHash,
							Timestamp: time.Now(),
						},
					},
				},
			)
			fileID = parentFileId
			publicID = parent.PublicID
			log.Printf("✅ Version %d saved for fileId=%s | CID=%s", newVersion, fileID, ipfsCID)
		}
	} else {
		// ── NEW FILE PATH ──────────────────────────────────────────────────
		clientTxHash := c.PostForm("txHash")
		if clientTxHash != "" {
			if !strings.HasPrefix(clientTxHash, "0x") || len(clientTxHash) != 66 {
				log.Printf("❌ Invalid txHash: %s", clientTxHash)
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction hash format"})
				return
			}
			txHash = clientTxHash
		}

		ext := filepath.Ext(header.Filename)

		vaultPath := filepath.Join(vaultDir, header.Filename)
		if err := os.WriteFile(vaultPath, fileBytes, 0644); err != nil {
			log.Printf("❌ Failed to write raw file to vault: %v", err)
		}

		backupPath := filepath.Join(backupDir, fileID)
		if err := os.WriteFile(backupPath, encryptedBytes, 0644); err != nil {
			log.Printf("❌ Failed to write encrypted backup: %v", err)
		}

		log.Println("File uploaded:", header.Filename)
		log.Println("Backup created:", backupPath)
		log.Println("Stored in vault:", vaultPath)

		var extractedText string
		if strings.ToLower(ext) == ".docx" {
			text, err := extractDocxText(vaultPath)
			if err == nil {
				extractedText = text
				txtPath := filepath.Join(backupDir, fileID+"_text.txt")
				os.WriteFile(txtPath, []byte(text), 0644)
			}
		}

		// Build MongoDB record
		record := models.FileRecord{
			FileID:        fileID,
			PublicID:      publicID,
			Filename:      header.Filename,
			FileExtension: ext,
			OriginalHash:  fileHash,
			EncryptedURL:  ipfsURL,
			IpfsCID:       ipfsCID,
			FileSize:      header.Size,
			MimeType:      header.Header.Get("Content-Type"),
			WalletAddress: wallet,
			TxHash:        txHash,
			Status:        "valid",
			BackupPath:    backupPath,
			VaultPath:     vaultPath,
			ExtractedText: extractedText,
			TamperedText:  "",
			ExpiryDate:    expiryDate,
			UploadedAt:    time.Now(),
			Version:       1,
		}

		log.Printf("💾 Saving record — fileId: %s | hash: %s | CID: %s", record.FileID, record.OriginalHash, record.IpfsCID)

		result, err := collection.InsertOne(ctx, record)
		if err != nil {
			log.Printf("❌ MongoDB INSERT ERROR: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database save failed: " + err.Error()})
			return
		}
		log.Printf("✅ [MONGODB] Metadata stored: fileId=%s, _id=%v", record.FileID, result.InsertedID)
	}

	// ── 9. Notifications & audit ─────────────────────────────────────────────
	NotifyUpload(wallet, header.Filename, fileID)
	LogAudit(wallet, fileID, header.Filename, "FILE_UPLOADED", txHash, 0,
		"File encrypted and stored on IPFS (CID: "+ipfsCID+")")
	log.Printf("🔗 [BLOCKCHAIN] Hash ready to seal on blockchain for file: %s", fileID)

	// ── 10. Response ─────────────────────────────────────────────────────────
	c.JSON(http.StatusCreated, gin.H{
		"success":      true,
		"fileId":       fileID,
		"publicId":     publicID,
		"filename":     header.Filename,
		"fileHash":     fileHash,
		"ipfsCID":      ipfsCID,
		"ipfsURL":      ipfsURL,
		"encryptedUrl": ipfsURL, // alias for frontend compatibility
		"fileSize":     header.Size,
		"txHash":       txHash,
		"message":      "File uploaded to IPFS and registered. Seal on blockchain.",
	})
}

func randomString(n int) string {
	letters := []rune("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
	s := make([]rune, n)
	for i := range s {
		s[i] = letters[rand.Intn(len(letters))]
	}
	return string(s)
}
