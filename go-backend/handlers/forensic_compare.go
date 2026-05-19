package handlers

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"

	"cryptovault/database"
	"cryptovault/models"
	"cryptovault/utils"
)

// sha256Hex returns the lowercase hex-encoded SHA-256 of the given bytes.
func sha256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return fmt.Sprintf("%x", h)
}

// isTextContent returns true when data appears to be valid UTF-8 text.
func isTextContent(data []byte) bool {
	if len(data) == 0 {
		return true
	}
	// Limit sample to first 8 KB for performance
	sample := data
	if len(sample) > 8192 {
		sample = data[:8192]
	}
	return utf8.Valid(sample)
}

// riskScore computes 0-100 based on how different two byte slices are.
// 0 = identical, 100 = completely different.
func riskScore(a, b []byte) int {
	if len(a) == 0 && len(b) == 0 {
		return 0
	}
	if sha256Hex(a) == sha256Hex(b) {
		return 0
	}
	maxLen := len(a)
	if len(b) > maxLen {
		maxLen = len(b)
	}
	minLen := len(a)
	if len(b) < minLen {
		minLen = len(b)
	}

	diffBytes := 0
	for i := 0; i < minLen; i++ {
		if a[i] != b[i] {
			diffBytes++
		}
	}
	diffBytes += (maxLen - minLen)

	score := int(float64(diffBytes) / float64(maxLen) * 100)
	if score < 5 && sha256Hex(a) != sha256Hex(b) {
		score = 5 // minimum non-zero for "tampered"
	}
	if score > 100 {
		score = 100
	}
	return score
}

// riskLevel maps a score 0-100 to a label.
func riskLevel(score int) string {
	switch {
	case score == 0:
		return "SECURE"
	case score <= 20:
		return "LOW"
	case score <= 50:
		return "MEDIUM"
	case score <= 80:
		return "HIGH"
	default:
		return "CRITICAL"
	}
}

// detectMime returns a best-effort MIME type from the file extension.
func detectMime(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	case ".pdf":
		return "application/pdf"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".txt":
		return "text/plain"
	case ".json":
		return "application/json"
	case ".csv":
		return "text/csv"
	case ".md":
		return "text/markdown"
	case ".go":
		return "text/x-go"
	case ".py":
		return "text/x-python"
	default:
		return "application/octet-stream"
	}
}

// extractDocxText extracts plain text from a docx file using standard archive/zip
func extractDocxText(filePath string) (string, error) {
	r, err := zip.OpenReader(filePath)
	if err != nil {
		return "", err
	}
	defer r.Close()
	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			rc, _ := f.Open()
			defer rc.Close()
			data, _ := io.ReadAll(rc)
			re := regexp.MustCompile(`<[^>]+>`)
			text := re.ReplaceAllString(string(data), " ")
			re2 := regexp.MustCompile(`\s+`)
			text = re2.ReplaceAllString(text, " ")
			return strings.TrimSpace(text), nil
		}
	}
	return "", fmt.Errorf("word/document.xml not found in docx")
}

// ForensicCompare — GET /api/file/forensic-compare/:fileId
func ForensicCompare(c *gin.Context) {
	fileId := c.Param("fileId")

	// 1. Find file record from MongoDB by fileId
	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var record models.FileRecord
	err := col.FindOne(ctx, bson.M{"fileId": fileId}).Decode(&record)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "File record not found in MongoDB",
		})
		return
	}

	// 2. Get file extension from filename
	ext := filepath.Ext(record.Filename)
	extLower := strings.ToLower(ext)

	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = "backup"
	}
	vaultDir := os.Getenv("VAULT_DIR")
	if vaultDir == "" {
		vaultDir = "vault"
	}

	// 3. Search backup/ folder for original file
	foundBackup := ""
	if record.BackupPath != "" {
		if _, err := os.Stat(record.BackupPath); err == nil {
			foundBackup = record.BackupPath
		}
	}
	if foundBackup == "" {
		p1 := filepath.Join(backupDir, fileId)
		if _, err := os.Stat(p1); err == nil {
			foundBackup = p1
		}
	}
	if foundBackup == "" {
		p2 := filepath.Join(backupDir, fileId+ext)
		if _, err := os.Stat(p2); err == nil {
			foundBackup = p2
		}
	}
	if foundBackup == "" {
		p3 := filepath.Join(backupDir, fileId+"_original"+ext)
		if _, err := os.Stat(p3); err == nil {
			foundBackup = p3
		}
	}

	// 4. Search vault/ folder for tampered file
	foundVault := ""
	if record.VaultPath != "" {
		if _, err := os.Stat(record.VaultPath); err == nil {
			foundVault = record.VaultPath
		}
	}
	if foundVault == "" {
		p1 := filepath.Join(vaultDir, fileId+ext)
		if _, err := os.Stat(p1); err == nil {
			foundVault = p1
		}
	}
	if foundVault == "" {
		p2 := filepath.Join(vaultDir, fileId+"_tampered"+ext)
		if _, err := os.Stat(p2); err == nil {
			foundVault = p2
		}
	}

	mimeType := record.MimeType
	if mimeType == "" {
		mimeType = detectMime(record.Filename)
	}

	// Add fmt.Println debug logs
	fmt.Println("[ForensicCompare] fileId:", fileId)
	fmt.Println("[ForensicCompare] backupPath found:", foundBackup)
	fmt.Println("[ForensicCompare] vaultPath found:", foundVault)
	fmt.Println("[ForensicCompare] mimeType:", mimeType)

	var backupBytes []byte
	if foundBackup != "" {
		rawBytes, _ := os.ReadFile(foundBackup)
		decrypted, err := utils.DecryptAES(rawBytes)
		if err == nil {
			backupBytes = decrypted
		} else {
			backupBytes = rawBytes
		}
	}

	var vaultBytes []byte
	if foundVault != "" {
		vaultBytes, _ = os.ReadFile(foundVault)
	}

	// ── Determine if a tampered version actually exists ──
	tamperedAvailable := len(vaultBytes) > 0

	var originalContent, modifiedContent string
	var isBinary, isTextComparable bool

	origHash := ""
	if len(backupBytes) > 0 {
		origHash = sha256Hex(backupBytes)
	} else {
		origHash = record.OriginalHash
	}

	// If no tampered file exists — return early with tamperedAvailable: false
	if !tamperedAvailable {
		// Still provide original content for preview
		var origPreview string
		switch extLower {
		case ".docx":
			if record.ExtractedText != "" {
				origPreview = record.ExtractedText
			} else if foundBackup != "" {
				origPreview, _ = extractDocxText(foundBackup)
			}
		case ".txt", ".json", ".csv", ".md", ".go", ".py":
			origPreview = string(backupBytes)
		default:
			if isTextContent(backupBytes) {
				origPreview = string(backupBytes)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"success":            true,
			"tamperedAvailable":  false,
			"tamperedMessage":    "No tampered version available yet. Run Verify using a modified file first.",
			"fileId":             record.FileID,
			"filename":           record.Filename,
			"fileName":           record.Filename,
			"mimeType":           mimeType,
			"original":           origPreview,
			"modified":           "",
			"originalHash":       origHash,
			"modifiedHash":       "",
			"txHash":             record.TxHash,
			"status":             record.Status,
			"riskScore":          0,
			"riskLevel":          "SECURE",
			"isBinary":           false,
			"isTextComparable":   len(origPreview) > 0,
			"walletAddress":      record.WalletAddress,
			"uploadedAt":         record.UploadedAt,
			"fileSize":           record.FileSize,
			"isIdentical":        true,
		})
		return
	}

	// ── Tampered file exists — proceed with full comparison ──
	isBinary = true
	isTextComparable = false

	switch extLower {
	case ".docx":
		origText, errOrig := extractDocxText(foundBackup)
		modText, errMod := extractDocxText(foundVault)
		if errOrig == nil && errMod == nil {
			originalContent = origText
			modifiedContent = modText
			isBinary = false
			isTextComparable = true
		} else {
			// Check if we already have it extracted in DB
			if record.ExtractedText != "" {
				originalContent = record.ExtractedText
				modifiedContent = record.TamperedText
				isBinary = false
				isTextComparable = true
			} else {
				// Fallback to base64 so mammoth can extract in browser
				originalContent = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(backupBytes)
				modifiedContent = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(vaultBytes)
				isBinary = true
				isTextComparable = true
			}
		}
	case ".txt", ".json", ".csv", ".md", ".go", ".py":
		originalContent = string(backupBytes)
		modifiedContent = string(vaultBytes)
		isBinary = false
		isTextComparable = true
	case ".pdf", ".png", ".jpg", ".jpeg":
		originalContent = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(backupBytes)
		modifiedContent = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(vaultBytes)
		isBinary = true
		isTextComparable = false
	default:
		if isTextContent(backupBytes) {
			originalContent = string(backupBytes)
			modifiedContent = string(vaultBytes)
			isBinary = false
			isTextComparable = true
		} else {
			originalContent = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(backupBytes)
			modifiedContent = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(vaultBytes)
			isBinary = true
			isTextComparable = false
		}
	}

	tampHash := sha256Hex(vaultBytes)

	score := riskScore(backupBytes, vaultBytes)
	level := riskLevel(score)

	status := record.Status
	if status == "" || status == "valid" {
		if origHash != tampHash {
			status = "tampered"
		} else {
			status = "valid"
		}
	}

	// 8. Return JSON
	c.JSON(http.StatusOK, gin.H{
		"success":            true,
		"tamperedAvailable":  true,
		"fileId":             record.FileID,
		"filename":           record.Filename,
		"fileName":           record.Filename,
		"mimeType":           mimeType,
		"original":           originalContent,
		"modified":           modifiedContent,
		"originalHash":       origHash,
		"modifiedHash":       tampHash,
		"txHash":             record.TxHash,
		"status":             status,
		"riskScore":          score,
		"riskLevel":          level,
		"isBinary":           isBinary,
		"isTextComparable":   isTextComparable,
		"walletAddress":      record.WalletAddress,
		"uploadedAt":         record.UploadedAt,
		"fileSize":           record.FileSize,
		"isIdentical":        origHash == tampHash,
	})
}

// ForensicCompareWithUpload — POST /api/file/forensic-compare/:fileId
func ForensicCompareWithUpload(c *gin.Context) {
	fileId := c.Param("fileId")

	uploadedFile, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded for comparison"})
		return
	}
	defer uploadedFile.Close()

	tamperedData, err := io.ReadAll(uploadedFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read uploaded file"})
		return
	}

	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var record models.FileRecord
	if err := col.FindOne(ctx, bson.M{"fileId": fileId}).Decode(&record); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File record not found"})
		return
	}

	ext := strings.ToLower(filepath.Ext(record.Filename))
	mimeType := detectMime(record.Filename)

	var backupBytes []byte
	if record.BackupPath != "" {
		rawBytes, _ := os.ReadFile(record.BackupPath)
		decrypted, err := utils.DecryptAES(rawBytes)
		if err == nil {
			backupBytes = decrypted
		} else {
			backupBytes = rawBytes
		}
	}

	if len(backupBytes) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Original backup file not found on disk"})
		return
	}

	origHash := sha256Hex(backupBytes)
	tampHash := sha256Hex(tamperedData)

	score := riskScore(backupBytes, tamperedData)
	level := riskLevel(score)

	var originalContent, modifiedContent string
	var isBinary, isTextComparable bool

	isBinary = true
	isTextComparable = false

	switch ext {
	case ".docx":
		// Save the uploaded tampered file temporarily to do extraction
		vaultDir := os.Getenv("VAULT_DIR")
		if vaultDir == "" {
			vaultDir = "vault"
		}
		os.MkdirAll(vaultDir, os.ModePerm)
		tamperedTempPath := filepath.Join(vaultDir, fileId+"_temp_compare.docx")
		os.WriteFile(tamperedTempPath, tamperedData, 0644)
		defer os.Remove(tamperedTempPath)

		origText, errOrig := extractDocxText(record.BackupPath)
		modText, errMod := extractDocxText(tamperedTempPath)

		if errOrig == nil && errMod == nil {
			originalContent = origText
			modifiedContent = modText
			isBinary = false
			isTextComparable = true
		} else {
			originalContent = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(backupBytes)
			modifiedContent = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(tamperedData)
			isBinary = true
			isTextComparable = true
		}
	case ".txt", ".json", ".csv", ".md", ".go", ".py":
		originalContent = string(backupBytes)
		modifiedContent = string(tamperedData)
		isBinary = false
		isTextComparable = true
	case ".pdf", ".png", ".jpg", ".jpeg":
		originalContent = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(backupBytes)
		modifiedContent = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(tamperedData)
		isBinary = true
		isTextComparable = false
	default:
		if isTextContent(backupBytes) {
			originalContent = string(backupBytes)
			modifiedContent = string(tamperedData)
			isBinary = false
			isTextComparable = true
		} else {
			originalContent = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(backupBytes)
			modifiedContent = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(tamperedData)
			isBinary = true
			isTextComparable = false
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":          true,
		"fileId":           record.FileID,
		"filename":         record.Filename,
		"fileName":         record.Filename,
		"mimeType":         mimeType,
		"original":         originalContent,
		"modified":         modifiedContent,
		"originalHash":     origHash,
		"modifiedHash":     tampHash,
		"txHash":           record.TxHash,
		"status":           "tampered",
		"riskScore":        score,
		"riskLevel":        level,
		"isBinary":         isBinary,
		"isTextComparable": isTextComparable,
		"walletAddress":    record.WalletAddress,
		"uploadedAt":       record.UploadedAt,
		"fileSize":         record.FileSize,
		"isIdentical":      origHash == tampHash,
	})
}

// ForensicRestore — POST /api/restore/:fileId
func ForensicRestore(c *gin.Context) {
	fileId := c.Param("fileId")

	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var record models.FileRecord
	if err := col.FindOne(ctx, bson.M{"fileId": fileId}).Decode(&record); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File record not found"})
		return
	}

	var backupBytes []byte
	if record.BackupPath != "" {
		rawBytes, _ := os.ReadFile(record.BackupPath)
		decrypted, err := utils.DecryptAES(rawBytes)
		if err == nil {
			backupBytes = decrypted
		} else {
			backupBytes = rawBytes
		}
	}

	if len(backupBytes) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Original backup file not found on disk"})
		return
	}

	now := time.Now()
	_, _ = col.UpdateOne(ctx, bson.M{"fileId": fileId}, bson.M{
		"$set": bson.M{
			"status":    "valid",
			"updatedAt": now,
		},
	})

	mimeType := record.MimeType
	if mimeType == "" {
		mimeType = detectMime(record.Filename)
	}

	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="RESTORED_%s"`, record.Filename))
	c.Header("Content-Type", mimeType)
	c.Header("Access-Control-Expose-Headers", "Content-Disposition")
	c.Data(http.StatusOK, mimeType, backupBytes)
}
