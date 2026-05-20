package handlers

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
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

// saveFileToDisk saves an uploaded file to a local destination path
func saveFileToDisk(src io.Reader, destPath string) error {
	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, src)
	return err
}

func VerifyFile(c *gin.Context) {

	// ── 1. File receive ──
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File missing"})
		return
	}
	defer file.Close()

	fileId := strings.TrimSpace(c.PostForm("fileId"))
	wallet := strings.ToLower(c.PostForm("wallet"))

	if fileId == "" {
		var body struct {
			FileID string `json:"fileId"`
			Wallet string `json:"wallet"`
		}
		if err := c.ShouldBindJSON(&body); err == nil {
			fileId = body.FileID
			wallet = strings.ToLower(body.Wallet)
		}
	}

	currentSize := header.Size

	// ── 2. SHA-256 hash generate ──
	newHash, err := utils.GenerateSHA256(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Hash generation failed"})
		return
	}
	// Normalize — remove 0x prefix
	newHash = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(newHash), "0x"))
	file.Seek(0, 0)

	// ── 3. MongoDB fetch ──
	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var record models.FileRecord
	dbFound := true

	var dbErr error
	if fileId != "" && fileId != "undefined" && fileId != "null" {
		dbErr = col.FindOne(ctx, bson.M{"fileId": fileId}).Decode(&record)
	} else {
		// Hash search — with and without 0x
		dbErr = col.FindOne(ctx, bson.M{"originalHash": newHash}).Decode(&record)
		if dbErr != nil {
			dbErr = col.FindOne(ctx, bson.M{"originalHash": "0x" + newHash}).Decode(&record)
		}
		if dbErr != nil {
			// Case-insensitive wallet + filename fallback
			dbErr = col.FindOne(ctx, bson.M{
				"filename": header.Filename,
			}).Decode(&record)
		}
	}

	if dbErr != nil {
		dbFound = false
	}

	dbHash := ""
	storedSize := int64(0)
	if dbFound {
		dbHash = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(record.OriginalHash), "0x"))
		storedSize = record.FileSize
		if fileId == "" {
			fileId = record.FileID
		}
	}

	fmt.Println("=== VERIFY DEBUG ===")
	fmt.Printf("FileId:       %s\n", fileId)
	fmt.Printf("DB Hash:      %s\n", dbHash)
	fmt.Printf("Current Hash: %s\n", newHash)
	fmt.Printf("Match:        %v\n", newHash == dbHash)
	fmt.Printf("DB Found:     %v\n", dbFound)
	fmt.Println("===================")

	// ── 4. Decision ──
	var status string
	var message string
	var comparison gin.H

	switch {
	case !dbFound:
		status = "NOT_REGISTERED"
		message = "🚫 File not found in registry. Upload it first."

	case newHash == dbHash:
		// ✅ VALID
		status = "VALID"
		message = "✔ File is authentic — integrity verified"

	default:
		// ❌ TAMPERED
		status = "TAMPERED"
		message = "❌ File has been modified — tampering detected"

		sizeChanged := currentSize != storedSize
		var auditMsg string
		if sizeChanged {
			origKB := float64(storedSize) / 1024
			currKB := float64(currentSize) / 1024
			auditMsg = fmt.Sprintf("File size changed from %.1f KB to %.1f KB", origKB, currKB)
		} else {
			auditMsg = "File content modified (same size, different hash)"
		}

		comparison = gin.H{
			"sizeMatch":        !sizeChanged,
			"originalFileSize": storedSize,
			"currentFileSize":  currentSize,
			"auditMessage":     auditMsg,
		}
	}

	// ── 5. Diff Detection (text files) — fetch original from IPFS ──
	var diffResult gin.H
	if status == "TAMPERED" && record.IpfsCID != "" {
		originalBytes, ipfsErr := utils.FetchFromIPFS(record.IpfsCID)
		if ipfsErr == nil {
			diffResult = generateDiffFromBytes(originalBytes, file, header.Filename)
		} else {
			diffResult = gin.H{
				"available": false,
				"message":   "Original not accessible from IPFS: " + ipfsErr.Error(),
			}
		}
	}

	// ── 6. MongoDB update + Tamper log ──
	now := time.Now()
	if dbFound {
		var tamperedPath string
		var tamperedText string

		if status == "TAMPERED" {
			// ── Local Forensic Cache & Evidence Storage ──────────────────────────
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
			ext := filepath.Ext(header.Filename)
			tamperedPath = filepath.Join(vaultDir, record.FileID+"_tampered"+ext)
			file.Seek(0, 0)
			if err := saveFileToDisk(file, tamperedPath); err == nil {
				fmt.Printf("💾 [BACKUP] Tampered evidence saved locally: %s\n", tamperedPath)
				if strings.ToLower(ext) == ".docx" {
					tamperedText, _ = extractDocxText(tamperedPath)
				}
			} else {
				fmt.Printf("❌ Failed to save tampered file to local vault: %v\n", err)
			}
		}

		updateFields := bson.M{
			"status":     strings.ToLower(status),
			"verifiedAt": now,
		}

		if status == "TAMPERED" {
			updateFields["vaultPath"] = tamperedPath
			updateFields["tamperedText"] = tamperedText
		}

		col.UpdateOne(ctx,
			bson.M{"fileId": record.FileID},
			bson.M{"$set": updateFields},
		)
		fmt.Printf("✅ [MONGODB] Metadata status updated to %s for fileId=%s\n", strings.ToLower(status), record.FileID)

		// Save tamper log
		if status == "TAMPERED" {
			tamperCol := database.GetCollection("tamper_logs")
			tamperDoc := bson.M{
				"fileId":       record.FileID,
				"filename":     record.Filename,
				"owner":        record.WalletAddress,
				"originalHash": dbHash,
				"tamperedHash": newHash,
				"originalSize": storedSize,
				"tamperedSize": currentSize,
				"detectedAt":   now,
			}
			if diffResult != nil {
				tamperDoc["diff"] = diffResult
			}
			tamperCol.InsertOne(ctx, tamperDoc)
			fmt.Printf("🚨 [MONGODB] Tamper evidence log stored for fileId=%s\n", record.FileID)
		}

		// Log Audit
		LogAudit(wallet, record.FileID, record.Filename, "FILE_VERIFIED", record.TxHash, record.BlockNumber, fmt.Sprintf("Result: %s", status))

		// Notifications
		switch status {
		case "VALID":
			NotifyVerifyValid(record.WalletAddress, record.Filename, fileId)
		case "TAMPERED":
			NotifyTamperDetected(record.WalletAddress, record.Filename, fileId)
			LogAudit(wallet, record.FileID, record.Filename, "TAMPER_DETECTED", record.TxHash, record.BlockNumber, "Forensic mismatch detected during verification")
		}
	}

	// ── 7. Response ──
	resp := gin.H{
		"success":       true,
		"status":        status,
		"isMatch":       status == "VALID",
		"dbVerified":    dbFound && newHash == dbHash,
		"chainVerified": false,
		"currentHash":   newHash,
		"originalHash":  dbHash,
		"message":       message,
		"fileId":        fileId,
		"fileName":      record.Filename,
		"txHash":        record.TxHash,
		"walletAddress": record.WalletAddress,
		"uploadedAt":    record.UploadedAt,
		"restoreUrl":    record.EncryptedURL,
		"ipfsCID":       record.IpfsCID,
	}

	if comparison != nil {
		resp["comparison"] = comparison
	}
	if diffResult != nil {
		resp["diff"] = diffResult
	}

	c.JSON(http.StatusOK, resp)
}

// ── Diff Generator (IPFS-based) ──────────────────────────────
func generateDiffFromBytes(originalBytes []byte, currentFile io.ReadSeeker, filename string) gin.H {
	ext := strings.ToLower(filepath.Ext(filename))

	// Supported text types
	textTypes := map[string]bool{
		".txt": true, ".json": true, ".js": true, ".jsx": true,
		".ts": true, ".tsx": true, ".go": true, ".py": true,
		".java": true, ".cpp": true, ".c": true, ".cs": true,
		".html": true, ".css": true, ".md": true, ".csv": true,
		".xml": true, ".yaml": true, ".yml": true, ".env": true,
		".sh": true, ".sql": true, ".php": true, ".rb": true,
	}

	if !textTypes[ext] {
		return gin.H{
			"available": false,
			"message":   fmt.Sprintf("Diff preview not available for %s files", ext),
			"fileType":  ext,
		}
	}

	origLines := strings.Split(string(originalBytes), "\n")
	currentLines := readLines(currentFile)

	// Line-by-line diff
	changes := []gin.H{}
	addedCount := 0
	removedCount := 0
	changedCount := 0

	maxLines := len(origLines)
	if len(currentLines) > maxLines {
		maxLines = len(currentLines)
	}

	for i := 0; i < maxLines; i++ {
		origLine := ""
		currLine := ""
		if i < len(origLines) {
			origLine = origLines[i]
		}
		if i < len(currentLines) {
			currLine = currentLines[i]
		}

		if origLine == currLine {
			continue
		}

		lineNum := i + 1

		switch {
		case origLine == "":
			changes = append(changes, gin.H{
				"line":   lineNum,
				"type":   "added",
				"before": "",
				"after":  currLine,
			})
			addedCount++

		case currLine == "":
			changes = append(changes, gin.H{
				"line":   lineNum,
				"type":   "removed",
				"before": origLine,
				"after":  "",
			})
			removedCount++

		default:
			changes = append(changes, gin.H{
				"line":   lineNum,
				"type":   "modified",
				"before": origLine,
				"after":  currLine,
			})
			changedCount++
		}

		// Limit to 50 changes
		if len(changes) >= 50 {
			changes = append(changes, gin.H{
				"line":    -1,
				"type":    "truncated",
				"message": "Showing first 50 of many changes...",
			})
			break
		}
	}

	return gin.H{
		"available":    true,
		"originalText": strings.Join(origLines, "\n"),
		"currentText":  strings.Join(currentLines, "\n"),
		"changes":      changes,
		"summary": gin.H{
			"totalChanges":  len(changes),
			"addedLines":    addedCount,
			"removedLines":  removedCount,
			"modifiedLines": changedCount,
			"originalLines": len(origLines),
			"currentLines":  len(currentLines),
		},
	}
}

func readLines(r io.Reader) []string {
	var lines []string
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024) // 1MB buffer
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	return lines
}

// ── Restore File (Forensic Recovery via IPFS) ────────────────────────────
func RestoreFile(c *gin.Context) {
	fileId := c.Param("id")

	fmt.Printf("[Restore] Internal Restore request received for fileId: %s\n", fileId)

	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	var record models.FileRecord
	if err := col.FindOne(ctx, bson.M{"fileId": fileId}).Decode(&record); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File record not found in MongoDB"})
		return
	}

	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = "backup"
	}
	vaultDir := os.Getenv("VAULT_DIR")
	if vaultDir == "" {
		vaultDir = "vault"
	}

	backupPath := filepath.Join(backupDir, fileId)
	encryptedBytes, err := os.ReadFile(backupPath)
	if err != nil {
		// Fallback to record.BackupPath if name wasn't matching
		if record.BackupPath != "" {
			backupPath = record.BackupPath
			encryptedBytes, err = os.ReadFile(backupPath)
		}
	}

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Encrypted backup file not found on disk: " + err.Error()})
		return
	}

	originalBytes, err := utils.DecryptAES(encryptedBytes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Decryption failed: " + err.Error()})
		return
	}

	restorePath := filepath.Join(vaultDir, record.Filename)
	if err := os.WriteFile(restorePath, originalBytes, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save restored file into vault: " + err.Error()})
		return
	}

	// ── Log Recovery ──
	log.Println("Recovery completed:", restorePath)

	// Update status and vault path in MongoDB
	_, err = col.UpdateOne(ctx,
		bson.M{"fileId": fileId},
		bson.M{"$set": bson.M{
			"status":     "valid",
			"vaultPath":  restorePath,
			"verifiedAt": time.Now(),
		}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update MongoDB status: " + err.Error()})
		return
	}

	// Create restore notification
	CreateNotification(
		record.WalletAddress,
		"🔄 File '"+record.Filename+"' restored to original version",
		"success",
		fileId,
	)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "File restored successfully",
		"fileId":  fileId,
	})
}

// ── Get Tamper Logs ──────────────────────────────
func GetTamperLogs(c *gin.Context) {
	wallet := c.Query("wallet")

	col := database.GetCollection("tamper_logs")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{}
	if wallet != "" {
		filter["walletAddress"] = bson.M{
			"$regex":   "^" + wallet + "$",
			"$options": "i",
		}
	}

	cursor, err := col.Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "logs": []interface{}{}})
		return
	}
	defer cursor.Close(ctx)

	var logs []bson.M
	cursor.All(ctx, &logs)
	if logs == nil {
		logs = []bson.M{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"logs":    logs,
		"count":   len(logs),
	})
}
