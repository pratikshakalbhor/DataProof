package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"cryptovault/database"
	"cryptovault/routes"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️ .env not found, using env vars")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}
	log.Println("🚀 PORT:", port)

	// ✅ Initialize storage directories
	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = "backup"
	}
	vaultDir := os.Getenv("VAULT_DIR")
	if vaultDir == "" {
		vaultDir = "vault"
	}
	restoredDir := os.Getenv("RESTORED_DIR")
	if restoredDir == "" {
		restoredDir = "restored"
	}

	// Create directories if they don't exist
	for _, dir := range []string{backupDir, vaultDir, restoredDir} {
		if err := os.MkdirAll(dir, os.ModePerm); err != nil {
			log.Fatalf("❌ Failed to create directory %s: %v", dir, err)
		}
		absPath, _ := filepath.Abs(dir)
		log.Printf("✅ Storage directory ready: %s", absPath)
	}

	// ✅ Database connection
	_, err := database.ConnectDB()
	if err != nil {
		log.Fatal("❌ DB connection failed:", err)
	}
	log.Println("✅ MongoDB connected successfully")

	r := gin.Default()
	r.SetTrustedProxies(nil)

	// CORS
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Wallet-Address")
		c.Header("Access-Control-Expose-Headers", "Content-Disposition")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "BlockVerify Backend ✅"})
	})

	// r.Static("/restored", "./restored") // Removed: production uses IPFS + blob download
	routes.RegisterRoutes(r)

	log.Printf("✅ Server running on :%s", port)
	r.Run(":" + port)
}
