package routes

import (
	"cryptovault/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		// ── Core ──
		api.POST("/upload", handlers.UploadFile)
		api.POST("/verify", handlers.VerifyFile)

		// ── Files ──
		api.GET("/files", handlers.GetAllFiles)
		api.GET("/files/archive/all", handlers.GetArchivedFiles)
		api.GET("/files/:id", handlers.GetFileByID)
		api.GET("/files/:id/versions", handlers.GetFileVersions)
		api.PUT("/files/:id/archive", handlers.ArchiveFile)
		api.POST("/files/:id/restore-archive", handlers.RestoreFromArchive)
		api.GET("/audit-logs", handlers.GetAuditLogs)

		// Essential File Actions
		api.PUT("/files/:id/visibility", handlers.UpdateVisibility)
		api.PATCH("/files/:id/tx", handlers.UpdateTxHash)
		api.GET("/files/:id/certificate", handlers.DownloadCertificate)
		api.GET("/files/:id/download", handlers.DownloadOriginal)
		api.GET("/files/:id/download-original", handlers.DownloadOriginal)

		// ── Stats ──
		api.GET("/stats", handlers.GetStats)
		api.GET("/dashboard", handlers.GetStats)

		// ── Notifications ──
		api.GET("/notifications", handlers.GetNotifications)
		api.PUT("/notifications/read", handlers.MarkNotificationsRead)
		api.POST("/notifications", handlers.CreateNotificationAPI)

		// ── Tamper Logs ──
		api.GET("/tamper-logs", handlers.GetTamperLogs)

		// ── Public ──
		api.GET("/public/verify/:id", handlers.PublicVerify)

		// ── Forensic ──
		api.GET("/file/forensic-compare/:fileId", handlers.ForensicCompare)
		api.POST("/restore/:fileId", handlers.ForensicRestore)
	}
}
