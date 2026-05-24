package handlers

import (
	"bufio"
	"context"
	"fmt"
	"io"
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

func VerifyFile(c *gin.Context) {

	// ── 1. File receive ──
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File missing"})
		return
	}
	defer file.Close()

	fileId  := strings.TrimSpace(c.PostForm("fileId"))
	wallet  := strings.ToLower(c.PostForm("wallet"))
	currentSize := header.Size

	// ── 2. Read file bytes ──
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	// ── 3. SHA-256 hash ──
	newHash := strings.ToLower(utils.GenerateSHA256FromBytes(fileBytes))

	// ── 4. MongoDB fetch ──
	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var record models.FileRecord
	dbFound := true
	var dbErr error

	if fileId != "" && fileId != "undefined" && fileId != "null" {
		dbErr = col.FindOne(ctx, bson.M{"fileId": fileId}).Decode(&record)
	} else {
		dbErr = col.FindOne(ctx, bson.M{"originalHash": newHash}).Decode(&record)
		if dbErr != nil {
			dbErr = col.FindOne(ctx, bson.M{"originalHash": "0x" + newHash}).Decode(&record)
		}
		if dbErr != nil {
			dbErr = col.FindOne(ctx, bson.M{"filename": header.Filename}).Decode(&record)
		}
	}
	if dbErr != nil { dbFound = false }

	dbHash     := ""
	storedSize := int64(0)
	if dbFound {
		dbHash     = strings.ToLower(strings.TrimPrefix(record.OriginalHash, "0x"))
		storedSize = record.FileSize
		if fileId == "" { fileId = record.FileID }
	}

	fmt.Printf("=== VERIFY === fileId=%s dbHash=%s newHash=%s match=%v\n",
		fileId, dbHash[:16], newHash[:16], newHash == dbHash)

	// ── 5. Decision ──
	var status, message string
	var comparison gin.H

	switch {
	case !dbFound:
		status  = "NOT_REGISTERED"
		message = "🚫 File not found in registry"

	case newHash == dbHash:
		status  = "VALID"
		message = "✔ File is authentic — integrity verified"

	default:
		status  = "TAMPERED"
		message = "❌ File has been modified — tampering detected"

		sizeChanged := currentSize != storedSize
		auditMsg := "File content modified (same size, different hash)"
		if sizeChanged {
			origKB := float64(storedSize) / 1024
			currKB := float64(currentSize) / 1024
			auditMsg = fmt.Sprintf("File size changed from %.1f KB to %.1f KB", origKB, currKB)
		}
		comparison = gin.H{
			"sizeMatch":        !sizeChanged,
			"originalFileSize": storedSize,
			"currentFileSize":  currentSize,
			"auditMessage":     auditMsg,
		}
	}

	// ── 6. Save tampered file to tampered/ for forensic comparison ──
	//    Separate from vault (which keeps original) so forensic compare
	//    can always read original vs tampered independently.
	if dbFound && status == "TAMPERED" {
		os.MkdirAll("tampered", 0755)
		cleanName := strings.ReplaceAll(record.Filename, " ", "_")
		tamperedPath := filepath.Join("tampered", record.FileID+"_"+cleanName)
		if writeErr := os.WriteFile(tamperedPath, fileBytes, 0644); writeErr != nil {
			fmt.Printf("⚠️ Could not save tampered file: %v\n", writeErr)
		} else {
			fmt.Printf("✅ Tampered file saved to: %s\n", tamperedPath)
			col.UpdateOne(ctx,
				bson.M{"fileId": record.FileID},
				bson.M{"$set": bson.M{"tamperedPath": tamperedPath}},
			)
		}
	}

	// ── 7. Diff Detection ──
	var diffResult gin.H
	if status == "TAMPERED" && record.BackupPath != "" {
		diffResult = generateFileDiff(record.BackupPath, fileBytes, header.Filename)
	}

	// ── 8. MongoDB update + Tamper log ──
	now := time.Now()
	if dbFound {
		col.UpdateOne(ctx,
			bson.M{"fileId": record.FileID},
			bson.M{"$set": bson.M{
				"status":     strings.ToLower(status),
				"verifiedAt": now,
			}},
		)

		if status == "TAMPERED" {
			// Save tamper log
			tamperCol := database.GetCollection("tamper_logs")
			tamperDoc := bson.M{
				"fileId":        record.FileID,
				"filename":      record.Filename,
				"walletAddress": record.WalletAddress,
				"originalHash":  dbHash,
				"tamperedHash":  newHash,
				"originalSize":  storedSize,
				"tamperedSize":  currentSize,
				"detectedAt":    now,
			}
			if diffResult != nil {
				tamperDoc["diff"] = diffResult
			}
			tamperCol.InsertOne(ctx, tamperDoc)
		}

		// Notifications
		switch status {
		case "VALID":
			NotifyVerifyValid(record.WalletAddress, record.Filename, fileId)
		case "TAMPERED":
			NotifyTamperDetected(record.WalletAddress, record.Filename, fileId)
		}
		LogAudit(wallet, record.FileID, record.Filename, "FILE_VERIFIED",
			record.TxHash, record.BlockNumber, fmt.Sprintf("Result: %s", status))
	}

	// ── 9. Response ──
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
		"filename":      record.Filename,
		"fileName":      record.Filename,
		"txHash":        record.TxHash,
		"walletAddress": record.WalletAddress,
		"uploadedAt":    record.UploadedAt,
		"restoreUrl":    record.EncryptedURL,
		"backupPath":    record.BackupPath,
		"vaultPath":     record.VaultPath,
		"ipfsCID":       record.IpfsCID,
	}
	if comparison != nil { resp["comparison"] = comparison }
	if diffResult != nil { resp["diff"] = diffResult }

	c.JSON(http.StatusOK, resp)
}

// ── generateFileDiff — for inline diff in Verify response ──
func generateFileDiff(backupPath string, currentBytes []byte, filename string) gin.H {
	ext := strings.ToLower(filepath.Ext(filename))
	textTypes := map[string]bool{
		".txt": true, ".json": true, ".js": true, ".jsx": true,
		".ts": true, ".go": true, ".py": true, ".java": true,
		".html": true, ".css": true, ".md": true, ".csv": true,
		".yaml": true, ".yml": true, ".sh": true, ".sql": true,
	}

	if !textTypes[ext] && ext != ".docx" {
		return gin.H{
			"available": false,
			"message":   fmt.Sprintf("Diff not available for %s", ext),
		}
	}

	if backupPath == "" {
		return gin.H{"available": false, "message": "Backup not found"}
	}

	origBytes, err := os.ReadFile(backupPath)
	if err != nil {
		// Try decrypt
		raw, rerr := os.ReadFile(backupPath)
		if rerr != nil {
			return gin.H{"available": false, "message": "Cannot read backup: " + rerr.Error()}
		}
		origBytes = raw
	}

	var origText, currText string

	if ext == ".docx" {
		origText, _ = extractDocxTextBytes(origBytes)
		currText, _ = extractDocxTextBytes(currentBytes)
	} else {
		origText = string(origBytes)
		currText = string(currentBytes)
	}

	origLines := splitTextLines(origText)
	currLines := splitTextLines(currText)

	changes  := []gin.H{}
	added, removed, modified := 0, 0, 0

	maxLines := len(origLines)
	if len(currLines) > maxLines { maxLines = len(currLines) }

	for i := 0; i < maxLines && len(changes) < 50; i++ {
		orig := ""
		curr := ""
		if i < len(origLines) { orig = origLines[i] }
		if i < len(currLines) { curr = currLines[i] }
		if orig == curr { continue }

		lineNum := i + 1
		if orig == "" {
			changes = append(changes, gin.H{"line": lineNum, "type": "added", "before": "", "after": curr})
			added++
		} else if curr == "" {
			changes = append(changes, gin.H{"line": lineNum, "type": "removed", "before": orig, "after": ""})
			removed++
		} else {
			changes = append(changes, gin.H{"line": lineNum, "type": "modified", "before": orig, "after": curr})
			modified++
		}
	}

	return gin.H{
		"available":    true,
		"originalText": origText,
		"currentText":  currText,
		"changes":      changes,
		"summary": gin.H{
			"totalChanges":  len(changes),
			"addedLines":    added,
			"removedLines":  removed,
			"modifiedLines": modified,
			"originalLines": len(origLines),
			"currentLines":  len(currLines),
		},
	}
}

func splitTextLines(text string) []string {
	var lines []string
	scanner := bufio.NewScanner(strings.NewReader(text))
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	return lines
}

func extractDocxTextBytes(data []byte) (string, error) {
	return extractDocxText(data)
}
