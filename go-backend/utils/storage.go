package utils

import (
    "fmt"
    "log"
    "os"
)

// IsLocal returns true if running in development mode (localhost)
func IsLocal() bool {
    deployEnv := os.Getenv("DEPLOY_ENV") // "render", "vercel", etc.
    nodeEnv   := os.Getenv("NODE_ENV")   // "production"
    
    if os.Getenv("LOCAL_STORAGE") == "true" {
        return true
    }
    
    if deployEnv != "" || nodeEnv == "production" {
        return false
    }
    
    return true // Default to true for localhost
}

// GetStorageDir returns the directory for local storage, ensuring it exists
func GetStorageDir(name string) string {
    dir := os.Getenv(fmt.Sprintf("%s_DIR", name))
    if dir == "" {
        dir = name // default to "backup" or "vault"
    }
    _ = os.MkdirAll(dir, 0755)
    return dir
}

// SaveFileLocally saves bytes to a local file if in local mode
func SaveFileLocally(dir, filename string, data []byte) string {
    if !IsLocal() {
        return ""
    }
    path := fmt.Sprintf("%s/%s", GetStorageDir(dir), filename)
    if err := os.WriteFile(path, data, 0644); err != nil {
        log.Printf("❌ Failed to save local file [%s]: %v", path, err)
        return ""
    }
    log.Printf("💾 File saved locally: %s", path)
    return path
}

// ReadFileLocally reads a file from disk if it exists
func ReadFileLocally(path string) ([]byte, error) {
    if path == "" {
        return nil, fmt.Errorf("empty path")
    }
    return os.ReadFile(path)
}
