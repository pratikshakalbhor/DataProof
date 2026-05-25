package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"cryptovault/database"
	"cryptovault/routes"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️ .env not found, using env vars")
	}

	log.Println("PORT:", os.Getenv("PORT"))

	// ✅ Fix: ConnectDB return value match karo
	_, err := database.ConnectDB()
if err != nil {
log.Fatal("❌ DB connection failed:", err)
}

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

	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}
	log.Printf("✅ Server running on :%s", port)
	r.Run(":" + port)
}