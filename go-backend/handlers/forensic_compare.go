package handlers

import (
	"archive/zip"
	"bufio"
	"bytes"
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

// ── Helpers ──────────────────────────────────────────────────
func sha256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return fmt.Sprintf("%x", h)
}

func isTextContent(data []byte) bool {
	if len(data) == 0 { return true }
	sample := data
	if len(sample) > 8192 { sample = data[:8192] }
	return utf8.Valid(sample)
}

func riskScore(a, b []byte) int {
	if sha256Hex(a) == sha256Hex(b) { return 0 }
	maxLen := len(a)
	if len(b) > maxLen { maxLen = len(b) }
	minLen := len(a)
	if len(b) < minLen { minLen = len(b) }
	diff := 0
	for i := 0; i < minLen; i++ {
		if a[i] != b[i] { diff++ }
	}
	diff += maxLen - minLen
	score := int(float64(diff) / float64(maxLen) * 100)
	if score < 5 { score = 5 }
	if score > 100 { score = 100 }
	return score
}

func riskLevel(score int) string {
	switch {
	case score == 0:  return "SECURE"
	case score <= 20: return "LOW"
	case score <= 50: return "MEDIUM"
	case score <= 80: return "HIGH"
	default:          return "CRITICAL"
	}
}

func detectMime(filename string) string {
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".pdf":  return "application/pdf"
	case ".png":  return "image/png"
	case ".jpg", ".jpeg": return "image/jpeg"
	case ".txt":  return "text/plain"
	case ".json": return "application/json"
	case ".csv":  return "text/csv"
	case ".md":   return "text/markdown"
	default:      return "application/octet-stream"
	}
}

// extractDocxText extracts plain text from a .docx file and preserves line breaks
func extractDocxText(data []byte) (string, error) {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil { return "", err }
	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			rc, err := f.Open()
			if err != nil { return "", err }
			defer rc.Close()
			raw, _ := io.ReadAll(rc)
			
			// Replace paragraph closing tags with newlines
			text := regexp.MustCompile(`</w:p>`).ReplaceAllString(string(raw), "\n")
			// Strip all other XML tags
			text = regexp.MustCompile(`<[^>]+>`).ReplaceAllString(text, "")
			
			// Unescape common XML entities
			text = strings.ReplaceAll(text, "&amp;", "&")
			text = strings.ReplaceAll(text, "&lt;", "<")
			text = strings.ReplaceAll(text, "&gt;", ">")
			text = strings.ReplaceAll(text, "&quot;", "\"")
			text = strings.ReplaceAll(text, "&apos;", "'")

			// Clean up and return
			lines := strings.Split(text, "\n")
			var clean []string
			for _, l := range lines {
				if t := strings.TrimSpace(l); t != "" {
					clean = append(clean, t)
				}
			}
			return strings.Join(clean, "\n"), nil
		}
	}
	return "", fmt.Errorf("word/document.xml not found")
}

// generateLineDiff produces a diff array from two texts
func generateLineDiff(origText, tampText string) []map[string]interface{} {
	origLines := splitLines(origText)
	tampLines := splitLines(tampText)

	changes := []map[string]interface{}{}
	added, removed, modified := 0, 0, 0

	maxLines := len(origLines)
	if len(tampLines) > maxLines { maxLines = len(tampLines) }

	for i := 0; i < maxLines && len(changes) < 100; i++ {
		orig := ""
		tamp := ""
		if i < len(origLines) { orig = origLines[i] }
		if i < len(tampLines) { tamp = tampLines[i] }

		if orig == tamp { continue }

		lineNum := i + 1
		if orig == "" {
			changes = append(changes, map[string]interface{}{
				"line": lineNum, "type": "added",
				"before": "", "after": tamp,
			})
			added++
		} else if tamp == "" {
			changes = append(changes, map[string]interface{}{
				"line": lineNum, "type": "removed",
				"before": orig, "after": "",
			})
			removed++
		} else {
			changes = append(changes, map[string]interface{}{
				"line": lineNum, "type": "modified",
				"before": orig, "after": tamp,
			})
			modified++
		}
	}

	_ = added
	_ = removed
	_ = modified

	return changes
}

func splitLines(text string) []string {
	var lines []string
	scanner := bufio.NewScanner(strings.NewReader(text))
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	return lines
}

// readOriginalBytes reads backup, tries AES decrypt, falls back to raw
func readOriginalBytes(record models.FileRecord) ([]byte, error) {
	if record.BackupPath == "" {
		return nil, fmt.Errorf("no backup path")
	}
	raw, err := os.ReadFile(record.BackupPath)
	if err != nil { return nil, err }
	decrypted, err := utils.DecryptAES(raw)
	if err == nil { return decrypted, nil }
	return raw, nil
}

// readTamperedBytes reads the tampered file from TamperedPath
// Falls back to VaultPath for backward compatibility with old records
func readTamperedBytes(record models.FileRecord) ([]byte, error) {
	// 1. Try TamperedPath first (new separate tampered storage)
	if record.TamperedPath != "" {
		data, err := os.ReadFile(record.TamperedPath)
		if err == nil && len(data) > 0 {
			fmt.Printf("[readTampered] ✅ Read from TamperedPath: %s (%d bytes)\n",
				record.TamperedPath, len(data))
			return data, nil
		}
	}

	// 2. Fallback: try legacy vault path pattern for old records
	//    But ONLY if vault content differs from backup (original)
	if record.VaultPath != "" {
		vaultData, err := os.ReadFile(record.VaultPath)
		if err == nil && len(vaultData) > 0 {
			// Check if vault actually has different content than original
			origBytes, origErr := readOriginalBytes(record)
			if origErr == nil && sha256Hex(vaultData) != sha256Hex(origBytes) {
				fmt.Printf("[readTampered] ⚠️ Fallback to VaultPath (differs from original): %s\n",
					record.VaultPath)
				return vaultData, nil
			}
			// vault has same content as original — not tampered
			fmt.Printf("[readTampered] ℹ️ VaultPath has same content as original, skipping\n")
		}
	}

	// 3. Try standard tampered path pattern
	cleanName := strings.ReplaceAll(record.Filename, " ", "_")
	tamperedPath := filepath.Join("tampered", record.FileID+"_"+cleanName)
	data, err := os.ReadFile(tamperedPath)
	if err == nil && len(data) > 0 {
		fmt.Printf("[readTampered] ✅ Read from standard tampered path: %s (%d bytes)\n",
			tamperedPath, len(data))
		return data, nil
	}

	return nil, fmt.Errorf("no tampered file found")
}

// ════════════════════════════════════════════════════════════
// ForensicCompare — GET /api/file/forensic-compare/:fileId
// ════════════════════════════════════════════════════════════
func ForensicCompare(c *gin.Context) {
	fileId := c.Param("fileId")

	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var record models.FileRecord
	if err := col.FindOne(ctx, bson.M{"fileId": fileId}).Decode(&record); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File record not found"})
		return
	}

	mimeType := record.MimeType
	if mimeType == "" { mimeType = detectMime(record.Filename) }
	ext := strings.ToLower(filepath.Ext(record.Filename))

	// ── Read ORIGINAL from backup (immutable source of truth) ──
	origBytes, err := readOriginalBytes(record)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Original backup not found: " + err.Error(),
			"hint":  "File may not have been saved locally during upload",
		})
		return
	}

	// ── Read TAMPERED from tampered/ directory (separate from original) ──
	tampBytes, tampErr := readTamperedBytes(record)
	tamperedAvailable := tampErr == nil && len(tampBytes) > 0

	origHash := sha256Hex(origBytes)
	origText := extractTextByType(origBytes, ext)

	fmt.Printf("[ForensicCompare] fileId=%s orig=%d bytes tamp=%d bytes available=%v origHash=%s\n",
		fileId, len(origBytes), len(tampBytes), tamperedAvailable, origHash[:16])

	// ── No tampered version ──
	if !tamperedAvailable {
		c.JSON(http.StatusOK, gin.H{
			"success":           true,
			"tamperedAvailable": false,
			"tamperedMessage":   "No tampered version yet. Go to Verify page and upload a modified copy of this file.",
			"fileId":            record.FileID,
			"fileName":          record.Filename,
			"mimeType":          mimeType,
			"originalText":      origText,
			"original":          origText,
			"modified":          "",
			"tamperedText":      "",
			"originalHash":      origHash,
			"modifiedHash":      "",
			"txHash":            record.TxHash,
			"status":            record.Status,
			"riskScore":         0,
			"riskLevel":         "SECURE",
			"isBinary":          !isTextContent(origBytes),
			"isTextComparable":  origText != "",
			"isIdentical":       true,
			"walletAddress":     record.WalletAddress,
			"uploadedAt":        record.UploadedAt,
			"fileSize":          record.FileSize,
			"diff":              []interface{}{},
			"changes":           []interface{}{},
		})
		return
	}

	// ── Full comparison: original (backup) vs tampered ──
	tampHash := sha256Hex(tampBytes)
	tampText := extractTextByType(tampBytes, ext)

	fmt.Printf("[ForensicCompare] tampHash=%s origText=%d chars tampText=%d chars\n",
		tampHash[:16], len(origText), len(tampText))

	score  := riskScore(origBytes, tampBytes)
	level  := riskLevel(score)
	status := record.Status
	if origHash != tampHash { status = "tampered" } else { status = "valid" }

	// Line diff
	changes := generateLineDiff(origText, tampText)

	isBin := !isTextContent(origBytes) && ext != ".docx"

	// Base64 for binary preview
	origB64 := ""
	tampB64 := ""
	if isBin {
		origB64 = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(origBytes)
		tampB64 = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(tampBytes)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":           true,
		"tamperedAvailable": true,
		"fileId":            record.FileID,
		"fileName":          record.Filename,
		"mimeType":          mimeType,
		// Text content for diff viewer — ALWAYS original vs tampered
		"originalText":      origText,
		"tamperedText":      tampText,
		// Also send as original/modified for backward compat
		"original":          func() string { if isBin { return origB64 }; return origText }(),
		"modified":          func() string { if isBin { return tampB64 }; return tampText }(),
		// Hashes
		"originalHash":      origHash,
		"modifiedHash":      tampHash,
		// Blockchain
		"txHash":            record.TxHash,
		// Status & risk
		"status":            status,
		"riskScore":         score,
		"riskLevel":         level,
		// Flags
		"isBinary":          isBin,
		"isTextComparable":  origText != "",
		"isIdentical":       origHash == tampHash,
		// Diff
		"diff":              changes,
		"changes":           changes,
		"changeSummary": map[string]interface{}{
			"totalChanges": len(changes),
			"hasChanges":   len(changes) > 0,
		},
		// Meta
		"walletAddress":     record.WalletAddress,
		"uploadedAt":        record.UploadedAt,
		"fileSize":          record.FileSize,
	})
}

// ════════════════════════════════════════════════════════════
// ForensicRestore — POST /api/restore/:fileId
// ════════════════════════════════════════════════════════════
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

	origBytes, err := readOriginalBytes(record)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found: " + err.Error()})
		return
	}

	// Update DB status to valid, but do NOT overwrite vault or tampered paths
	// The tampered file stays in tampered/ for future forensic reference
	now := time.Now()
	col.UpdateOne(ctx, bson.M{"fileId": fileId}, bson.M{
		"$set": bson.M{"status": "valid", "updatedAt": now},
	})

	mimeType := record.MimeType
	if mimeType == "" { mimeType = detectMime(record.Filename) }

	c.Header("Content-Disposition",
		fmt.Sprintf(`attachment; filename="RESTORED_%s"`, record.Filename))
	c.Header("Content-Type", mimeType)
	c.Header("Access-Control-Expose-Headers", "Content-Disposition")
	c.Data(http.StatusOK, mimeType, origBytes)
}

// ════════════════════════════════════════════════════════════
// ForensicCompareWithUpload — POST /api/file/forensic-compare/:fileId
// ════════════════════════════════════════════════════════════
func ForensicCompareWithUpload(c *gin.Context) {
	fileId := c.Param("fileId")

	// 1. Receive uploaded file
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Comparison file missing"})
		return
	}
	defer file.Close()

	tampBytes, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read uploaded file"})
		return
	}

	// 2. Fetch original record
	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var record models.FileRecord
	if err := col.FindOne(ctx, bson.M{"fileId": fileId}).Decode(&record); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File record not found"})
		return
	}

	mimeType := record.MimeType
	if mimeType == "" {
		mimeType = detectMime(record.Filename)
	}
	ext := strings.ToLower(filepath.Ext(record.Filename))

	// 3. Read original bytes from backup (immutable)
	origBytes, err := readOriginalBytes(record)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Original backup not found: " + err.Error(),
		})
		return
	}

	// 4. Comparison
	origHash := sha256Hex(origBytes)
	tampHash := sha256Hex(tampBytes)

	origText := extractTextByType(origBytes, ext)
	tampText := extractTextByType(tampBytes, ext)

	score := riskScore(origBytes, tampBytes)
	level := riskLevel(score)
	status := record.Status
	if origHash != tampHash {
		status = "tampered"
	} else {
		status = "valid"
	}

	changes := generateLineDiff(origText, tampText)
	isBin := !isTextContent(origBytes) && ext != ".docx"

	origB64 := ""
	tampB64 := ""
	if isBin {
		origB64 = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(origBytes)
		tampB64 = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(tampBytes)
	}

	// 5. Save tampered file to tampered/ directory (NOT vault)
	os.MkdirAll("tampered", 0755)
	cleanName := strings.ReplaceAll(record.Filename, " ", "_")
	tamperedPath := filepath.Join("tampered", record.FileID+"_"+cleanName)
	os.WriteFile(tamperedPath, tampBytes, 0644)

	// Update DB with tampered path
	col.UpdateOne(ctx,
		bson.M{"fileId": record.FileID},
		bson.M{"$set": bson.M{
			"tamperedPath": tamperedPath,
			"status":       status,
		}},
	)

	c.JSON(http.StatusOK, gin.H{
		"success":           true,
		"tamperedAvailable": true,
		"fileId":            record.FileID,
		"fileName":          record.Filename,
		"mimeType":          mimeType,
		"originalText":      origText,
		"tamperedText":      tampText,
		"original":          func() string { if isBin { return origB64 }; return origText }(),
		"modified":          func() string { if isBin { return tampB64 }; return tampText }(),
		"originalHash":      origHash,
		"modifiedHash":      tampHash,
		"txHash":            record.TxHash,
		"status":            status,
		"riskScore":         score,
		"riskLevel":         level,
		"isBinary":          isBin,
		"isTextComparable":  origText != "",
		"isIdentical":       origHash == tampHash,
		"diff":              changes,
		"changes":           changes,
		"changeSummary": map[string]interface{}{
			"totalChanges": len(changes),
			"hasChanges":   len(changes) > 0,
		},
		"walletAddress": record.WalletAddress,
		"uploadedAt":    record.UploadedAt,
		"fileSize":      header.Size,
	})
}

// ── extractTextByType extracts readable text based on extension ──
func extractTextByType(data []byte, ext string) string {
	switch ext {
	case ".docx":
		text, err := extractDocxText(data)
		if err != nil { return "" }
		return text
	case ".txt", ".json", ".csv", ".md", ".go", ".py",
		".js", ".jsx", ".ts", ".tsx", ".html", ".css",
		".yaml", ".yml", ".env", ".sh", ".sql":
		if isTextContent(data) { return string(data) }
		return ""
	default:
		if isTextContent(data) { return string(data) }
		return ""
	}
}
