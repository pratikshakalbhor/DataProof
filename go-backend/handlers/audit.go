package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"

	"cryptovault/database"
	"cryptovault/models"
)

// LogAudit — Internal helper to save blockchain forensic events
func LogAudit(wallet, fileId, fileName, eventType, txHash string, block uint64, details string) {
	col := database.GetCollection("audit_logs")
	
	logEntry := models.AuditLog{
		LogID:         fmt.Sprintf("LOG-%d", time.Now().UnixNano()),
		FileID:        fileId,
		FileName:      fileName,
		WalletAddress: wallet,
		EventType:     eventType,
		TxHash:        txHash,
		BlockNumber:   block,
		Timestamp:     time.Now(),
		Details:       details,
	}

	_, err := col.InsertOne(context.Background(), logEntry)
	if err != nil {
		fmt.Printf("[AUDIT ERROR] Failed to log event %s: %v\n", eventType, err)
	}
}

// GetAuditLogs — GET /api/audit-logs
func GetAuditLogs(c *gin.Context) {
	wallet := c.Query("wallet")
	col := database.GetCollection("audit_logs")
	
	filter := bson.M{}
	if wallet != "" {
		filter["walletAddress"] = wallet
	}

	opts := options.Find().SetSort(bson.D{{Key: "timestamp", Value: -1}})
	cursor, err := col.Find(context.Background(), filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs"})
		return
	}
	defer cursor.Close(context.Background())

	var logs []models.AuditLog
	cursor.All(context.Background(), &logs)
	if logs == nil {
		logs = []models.AuditLog{}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "logs": logs})
}

// GetTamperLogs — GET /api/tamper-logs
func GetTamperLogs(c *gin.Context) {
	wallet := c.Query("wallet")
	col := database.GetCollection("tamper_logs")

	filter := bson.M{}
	if wallet != "" {
		filter["walletAddress"] = strings.ToLower(wallet)
	}

	opts := options.Find().SetSort(bson.D{{Key: "detectedAt", Value: -1}})
	cursor, err := col.Find(context.Background(), filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tamper logs"})
		return
	}
	defer cursor.Close(context.Background())

	var logs []bson.M
	cursor.All(context.Background(), &logs)
	if logs == nil {
		logs = []bson.M{}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "logs": logs})
}
