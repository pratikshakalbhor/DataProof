package models

import "time"

type FileRecord struct {
	FileID        string     `json:"fileId"        bson:"fileId"`
	PublicID      string     `json:"publicId"      bson:"publicId"`
	Filename      string     `json:"fileName"      bson:"filename"`
	FileExtension string     `json:"fileExtension" bson:"fileExtension"`
	OriginalHash  string     `json:"originalHash"  bson:"originalHash"`
	EncryptedURL  string     `json:"encryptedUrl"  bson:"encryptedUrl"`
	IpfsCID       string     `json:"ipfsCID"       bson:"ipfsCID"`
	FileSize      int64      `json:"fileSize"      bson:"fileSize"`
	MimeType      string     `json:"mimeType"      bson:"mimeType"`
	BackupPath    string     `json:"backupPath"    bson:"backupPath"`
	VaultPath     string     `json:"vaultPath"     bson:"vaultPath"`
	TamperedPath  string     `json:"tamperedPath"  bson:"tamperedPath"`
	ExtractedText string     `json:"extractedText" bson:"extractedText"`
	TamperedText  string     `json:"tamperedText"  bson:"tamperedText"`
	WalletAddress string     `json:"walletAddress" bson:"walletAddress"`
	TxHash        string     `json:"txHash"        bson:"txHash"`
	BlockNumber   uint64     `json:"blockNumber"   bson:"blockNumber"`
	Status        string     `json:"status"        bson:"status"` // SECURE, TAMPERED, ARCHIVED, etc.
	IsRevoked     bool       `json:"isRevoked"     bson:"isRevoked"`
	IsArchived    bool       `json:"isArchived"    bson:"isArchived"`
	ArchivedAt    *time.Time `json:"archivedAt"    bson:"archivedAt"`
	Visibility    string     `json:"visibility"    bson:"visibility"`
	SharedWith    []string   `json:"sharedWith"    bson:"sharedWith"`
	ExpiryDate    *time.Time `json:"expiryDate"    bson:"expiryDate"`
	Version       int             `json:"version"       bson:"version"`
	UploadedAt    time.Time       `json:"uploadedAt"    bson:"uploadedAt"`
	VerifiedAt    *time.Time      `json:"verifiedAt"    bson:"verifiedAt"`
	UpdatedAt     *time.Time      `json:"updatedAt"     bson:"updatedAt"`
	Versions      []VersionRecord `json:"versions"      bson:"versions"`
}

type AuditLog struct {
	LogID         string    `json:"logId"         bson:"logId"`
	FileID        string    `json:"fileId"        bson:"fileId"`
	FileName      string    `json:"fileName"      bson:"fileName"`
	WalletAddress string    `json:"walletAddress" bson:"walletAddress"`
	EventType     string    `json:"eventType"     bson:"eventType"` // FILE_UPLOADED, TAMPER_DETECTED, etc.
	TxHash        string    `json:"txHash"        bson:"txHash"`
	BlockNumber   uint64    `json:"blockNumber"   bson:"blockNumber"`
	Timestamp     time.Time `json:"timestamp"     bson:"timestamp"`
	Details       string    `json:"details"       bson:"details"`
}

type VersionRecord struct {
	Version     int       `json:"version"     bson:"version"`
	Hash        string    `json:"hash"        bson:"hash"`
	Timestamp   time.Time `json:"timestamp"   bson:"timestamp"`
	StoragePath string    `json:"storagePath" bson:"storagePath"`
	TxHash      string    `json:"txHash"      bson:"txHash"`
}

type Stats struct {
	Total    int64 `json:"total"`
	Secure   int64 `json:"secure"`
	Tampered int64 `json:"tampered"`
	Archived int64 `json:"archived"`
	Pending  int64 `json:"pending"`
}
