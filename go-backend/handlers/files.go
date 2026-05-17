package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"

	"cryptovault/database"
	"cryptovault/models"
	"cryptovault/utils"
)

func GetAllFiles(c *gin.Context) {
	wallet := strings.ToLower(c.Query("wallet"))
	isBlockchain := c.Query("blockchain") == "true"

	log.Printf("wallet param: %s", wallet)

	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Filter for owner and non-archived files
	filter := bson.M{
		"isArchived": false,
	}

	if wallet != "" {
		filter["walletAddress"] = wallet
	}

	if isBlockchain {
		filter["txHash"] = bson.M{"$ne": ""}
	}

	log.Printf("filter: %+v", filter)

	// Sort by uploadedAt descending
	opts := options.Find().SetSort(bson.D{{Key: "uploadedAt", Value: -1}})
	
	cursor, err := col.Find(ctx, filter, opts)
	log.Printf("cursor error: %v", err)
	
	if err != nil {
		log.Printf("❌ MongoDB Find failed: %v", err)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"files":   []models.FileRecord{},
			"count":   0,
		})
		return
	}
	defer cursor.Close(ctx)

	var files []models.FileRecord
	err = cursor.All(ctx, &files)
	log.Printf("decode error: %v", err)

	if err != nil {
		log.Printf("❌ Failed to decode files: %v", err)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"files":   []models.FileRecord{},
			"count":   0,
		})
		return
	}

	if files == nil {
		files = []models.FileRecord{}
	}

	log.Printf("files found: %d", len(files))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"files":   files,
		"count":   len(files),
	})
}

func GetFileByID(c *gin.Context) {
	fileID := c.Param("id")

	collection := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var record models.FileRecord
	err := collection.FindOne(ctx, bson.M{"fileId": fileID}).Decode(&record)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File nahi mila"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "file": record})
}

func RevokeFile(c *gin.Context) {
	fileID := c.Param("id")

	collection := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var record models.FileRecord
	err := collection.FindOne(ctx, bson.M{"fileId": fileID}).Decode(&record)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File nahi mila"})
		return
	}

	if record.IsRevoked {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Already revoked aahe"})
		return
	}

	collection.UpdateOne(ctx,
		bson.M{"fileId": fileID},
		bson.M{"$set": bson.M{"isRevoked": true, "status": "ARCHIVED", "isArchived": true}},
	)

	// Forensic Audit
	LogAudit(strings.ToLower(record.WalletAddress), fileID, record.Filename, "FILE_ARCHIVED", record.TxHash, record.BlockNumber, "User manually revoked and archived the forensic asset.")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fileID + " archived and revoked successfully",
	})
}

func GetFileVersions(c *gin.Context) {
	fileID := c.Param("id")

	collection := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var record models.FileRecord
	err := collection.FindOne(ctx, bson.M{"fileId": fileID}).Decode(&record)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File nahi mila"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"fileId":   fileID,
		"versions": record.Versions,
		"total":    len(record.Versions),
	})
}

func GetStats(c *gin.Context) {
	wallet := strings.ToLower(c.Query("wallet"))
	collection := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	baseFilter := bson.M{"isArchived": false}
	if wallet != "" {
		baseFilter["walletAddress"] = wallet
	}

	total, _ := collection.CountDocuments(ctx, baseFilter)

	// SECURE
	secureFilter := bson.M{"status": bson.M{"$in": []string{"SECURE", "valid"}}, "isArchived": false}
	if wallet != "" {
		secureFilter["walletAddress"] = wallet
	}
	secure, _ := collection.CountDocuments(ctx, secureFilter)

	// TAMPERED
	tamperedFilter := bson.M{"status": "TAMPERED", "isArchived": false}
	if wallet != "" {
		tamperedFilter["walletAddress"] = wallet
	}
	tampered, _ := collection.CountDocuments(ctx, tamperedFilter)

	// ARCHIVED
	archivedFilter := bson.M{"isArchived": true}
	if wallet != "" {
		archivedFilter["walletAddress"] = wallet
	}
	archived, _ := collection.CountDocuments(ctx, archivedFilter)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"stats": gin.H{
			"total":    total,
			"secure":   secure,
			"tampered": tampered,
			"archived": archived,
		},
	})
}

// UpdateVisibility — file visibility change karo
func UpdateVisibility(c *gin.Context) {
	fileID := c.Param("id")

	var body struct {
		Visibility string   `json:"visibility"`
		SharedWith []string `json:"sharedWith"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if body.Visibility != "private" && body.Visibility != "public" && body.Visibility != "shared" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid visibility — use private/public/shared"})
		return
	}

	collection := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"visibility": body.Visibility,
			"sharedWith": body.SharedWith,
		},
	}

	_, err := collection.UpdateOne(ctx, bson.M{"fileId": fileID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Update failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"fileId":     fileID,
		"visibility": body.Visibility,
		"sharedWith": body.SharedWith,
	})
}

// UpdateTxHash — Blockchain confirmation nantar txHash update kara
func UpdateTxHash(c *gin.Context) {
	fileID := c.Param("id")
	var body struct {
		TxHash      string `json:"txHash"`
		BlockNumber uint64 `json:"blockNumber"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// 🛡️ TX HASH VALIDATION
	if !strings.HasPrefix(body.TxHash, "0x") || len(body.TxHash) != 66 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction hash format"})
		return
	}

	collection := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Fetch record to get wallet for notification
	var record models.FileRecord
	collection.FindOne(ctx, bson.M{"fileId": fileID}).Decode(&record)

	update := bson.M{
		"$set": bson.M{
			"txHash": body.TxHash,
			"status": "valid",
		},
	}

	res, err := collection.UpdateOne(ctx, bson.M{"fileId": fileID}, update)
	if err != nil || res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Notification — upload success
	go CreateNotification(
		strings.ToLower(record.WalletAddress),
		"File uploaded & sealed on blockchain ✅: "+record.Filename,
		"success",
		fileID,
	)

	log.Printf("✅ Updated txHash for file %s: %s", fileID, body.TxHash)
	c.JSON(http.StatusOK, gin.H{"success": true, "txHash": body.TxHash})
}

// ─────────────────────────────────────────
// Trash & Restore Features
// ─────────────────────────────────────────



// ── ARCHIVE FILE (Rename of Trash) ───────────────────────────
func ArchiveFile(c *gin.Context) {
	fileId := c.Param("id")

	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var body struct {
		Wallet string `json:"wallet"`
	}
	_ = c.ShouldBindJSON(&body)
	wallet := strings.ToLower(body.Wallet)

	now := time.Now()
	var record models.FileRecord
	col.FindOne(ctx, bson.M{"fileId": fileId}).Decode(&record)

	if wallet == "" {
		wallet = record.WalletAddress
	}

	col.UpdateOne(ctx,
		bson.M{"fileId": fileId},
		bson.M{"$set": bson.M{
			"isArchived": true,
			"archivedAt": now,
			"status":     "ARCHIVED",
			"updatedAt":  now,
		}},
	)

	LogAudit(wallet, fileId, record.Filename, "FILE_ARCHIVED", record.TxHash, record.BlockNumber, "File moved to secure archives.")

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "File moved to archives"})
}

// ── GET ARCHIVED FILES ────────────────────────────
func GetArchivedFiles(c *gin.Context) {
	wallet := c.Query("wallet")

	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"isArchived": true}
	if wallet != "" {
		filter["walletAddress"] = strings.ToLower(wallet)
	}

	cursor, err := col.Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "files": []interface{}{}})
		return
	}
	defer cursor.Close(ctx)

	var files []models.FileRecord
	cursor.All(ctx, &files)
	if files == nil {
		files = []models.FileRecord{}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "files": files})
}

// ── RESTORE FROM ARCHIVE ─────────────────────────
func RestoreFromArchive(c *gin.Context) {
	fileId := c.Param("id")

	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var body struct {
		Wallet string `json:"wallet"`
	}
	_ = c.ShouldBindJSON(&body)
	wallet := strings.ToLower(body.Wallet)

	now := time.Now()
	var record models.FileRecord
	col.FindOne(ctx, bson.M{"fileId": fileId}).Decode(&record)

	if wallet == "" {
		wallet = record.WalletAddress
	}

	col.UpdateOne(ctx,
		bson.M{"fileId": fileId},
		bson.M{"$set": bson.M{
			"isArchived": false,
			"archivedAt": nil,
			"status":     "SECURE",
			"updatedAt":  now,
		}},
	)

	LogAudit(wallet, fileId, record.Filename, "FILE_RESTORED", record.TxHash, record.BlockNumber, "File restored from archives to active vault.")

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "File restored from archives"})
}

// ── PERMANENT DELETE ───────────────────────────
func PermanentDeleteFile(c *gin.Context) {
	fileId := c.Param("id")

	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	col.DeleteOne(ctx, bson.M{"fileId": fileId})

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "File permanently deleted"})
}

// ── PUBLIC VERIFY ──────────────────────────────
func PublicVerify(c *gin.Context) {
	fileId := c.Param("id")

	collection := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var record models.FileRecord
	err := collection.FindOne(ctx, bson.M{"fileId": fileId}).Decode(&record)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Verify link invalid or expired"})
		return
	}

	wallet := record.WalletAddress
	if len(wallet) > 12 {
		wallet = wallet[:8] + "..." + wallet[len(wallet)-4:]
	}

	c.JSON(http.StatusOK, gin.H{
		"fileId":     record.FileID,
		"fileName":   record.Filename,
		"status":     record.Status,
		"hash":       record.OriginalHash,
		"txHash":     record.TxHash,
		"uploadedAt": record.UploadedAt,
		"wallet":     wallet,
		"network":    "Ethereum Sepolia Testnet",
	})
}

// ── DOWNLOAD ORIGINAL ───────────────────────────
// Fetches the sealed original from IPFS, decrypts it, and streams to client.
// Prefixes filename with RESTORED_ when called via /download-original route.
// No local disk access — works on Render and all ephemeral deployments.
func DownloadOriginal(c *gin.Context) {
	fileId := c.Param("id")

	col := database.GetCollection("files")
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	var record models.FileRecord
	if err := col.FindOne(ctx, bson.M{"fileId": fileId}).Decode(&record); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	mimeType := record.MimeType
	if mimeType == "" {
		mimeType = getMimeType(record.Filename)
	}

	dlName := record.Filename
	if strings.HasSuffix(c.FullPath(), "/download-original") {
		dlName = "RESTORED_" + record.Filename
	}

	// ── Primary: Fetch from IPFS and stream decrypted bytes ──
	if record.IpfsCID != "" {
		originalBytes, err := utils.FetchFromIPFS(record.IpfsCID)
		if err == nil {
			c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, dlName))
			c.Header("Content-Type", mimeType)
			c.Header("Access-Control-Expose-Headers", "Content-Disposition")
			c.Data(http.StatusOK, mimeType, originalBytes)
			return
		}
		log.Printf("⚠️  IPFS fetch failed for CID %s: %v — trying URL redirect", record.IpfsCID, err)
	}

	// ── Fallback: Redirect to raw IPFS URL (encrypted) ──
	if record.EncryptedURL != "" {
		c.Redirect(http.StatusTemporaryRedirect, record.EncryptedURL)
		return
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Original file not available — no IPFS CID or URL stored"})
}

// ✅ MIME type helper function
func getMimeType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".doc":
		return "application/msword"
	case ".pdf":
		return "application/pdf"
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".txt":
		return "text/plain"
	case ".zip":
		return "application/zip"
	default:
		return "application/octet-stream"
	}
}

