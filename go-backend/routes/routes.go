package routes

import (
	"github.com/gin-gonic/gin"
	"cryptovault/handlers"
)

func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		// ── Upload & Verify ──
		api.POST("/upload",  handlers.UploadFile)
		api.POST("/verify",  handlers.VerifyFile)

		// ── Stats & Dashboard ──
		api.GET("/stats",    handlers.GetStats)
		api.GET("/dashboard",handlers.GetStats)

		// ── Notifications ──
		api.GET("/notifications",     handlers.GetNotifications)
		api.PUT("/notifications/read",handlers.MarkNotificationsRead)
		api.POST("/notifications",    handlers.CreateNotificationAPI)

		// ── Files — SPECIFIC routes AADHI ──
		api.GET("/files",              handlers.GetAllFiles)
		api.GET("/files/trash/all",    handlers.GetTrashFiles)
		api.GET("/files/archive/all",  handlers.GetArchivedFiles)

		// ── Files — PARAMETERIZED routes NANTAR ──
		api.GET("/files/:id",          handlers.GetFileByID)
		api.GET("/files/:id/download", handlers.DownloadOriginal)
		api.GET("/files/:id/versions", handlers.GetFileVersions)
		api.GET("/files/:id/certificate", handlers.DownloadCertificate)
		api.PUT("/files/:id/revoke",   handlers.RevokeFile)
		api.PUT("/files/:id/visibility",handlers.UpdateVisibility)
		api.PUT("/files/:id/archive",   handlers.ArchiveFile)
		api.PATCH("/files/:id/tx",     handlers.UpdateTxHash)
		api.DELETE("/files/:id",       handlers.TrashFile)
		api.POST("/files/:id/untrash", handlers.RestoreFromTrash)
		api.POST("/files/:id/restore-archive", handlers.RestoreFromArchive)
		api.DELETE("/files/:id/permanent", handlers.PermanentDeleteFile)

		// ── Restore ──
		api.POST("/restore/:id", handlers.RestoreFile)

		// ── Forensic ──
		api.GET("/file/forensic-compare/:fileId", handlers.ForensicCompare)
		api.POST("/file/forensic-compare/:fileId", handlers.ForensicCompareWithUpload)

		// ── Public ──
		api.GET("/public/verify/:id", handlers.PublicVerify)
		api.GET("/tamper-logs",       handlers.GetTamperLogs)
		api.GET("/audit-logs",        handlers.GetAuditLogs)
	}
}
