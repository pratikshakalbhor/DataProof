package utils

import (
    "archive/zip"
    "bytes"
    "fmt"
    "io"
    "regexp"
    "strings"
)

// ExtractDocxText extracts plain text from a .docx file path
func ExtractDocxText(filePath string) (string, error) {
    r, err := zip.OpenReader(filePath)
    if err != nil {
        return "", err
    }
    defer r.Close()

    for _, f := range r.File {
        if f.Name != "word/document.xml" {
            continue
        }
        rc, err := f.Open()
        if err != nil {
            return "", err
        }
        defer rc.Close()

        data, err := io.ReadAll(rc)
        if err != nil {
            return "", err
        }

        return parseDocxXML(data), nil
    }
    
    return "", fmt.Errorf("word/document.xml not found in archive")
}

// ExtractDocxTextFromBytes extracts plain text from .docx bytes (no file path needed)
// This is the production-safe version that doesn't require local disk access.
func ExtractDocxTextFromBytes(data []byte) (string, error) {
    r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
    if err != nil {
        return "", err
    }

    for _, f := range r.File {
        if f.Name != "word/document.xml" {
            continue
        }
        rc, err := f.Open()
        if err != nil {
            return "", err
        }
        defer rc.Close()

        xmlData, err := io.ReadAll(rc)
        if err != nil {
            return "", err
        }

        return parseDocxXML(xmlData), nil
    }

    return "", fmt.Errorf("word/document.xml not found in archive")
}

// parseDocxXML converts raw document.xml content to plain text
func parseDocxXML(data []byte) string {
    // Preserve line breaks by replacing closing paragraph tags with newline
    text := regexp.MustCompile(`</w:p>`).ReplaceAllString(string(data), "\n")
    
    // Remove all other XML tags
    text = regexp.MustCompile(`<[^>]+>`).ReplaceAllString(text, "")
    
    // Decode common XML entities
    text = strings.ReplaceAll(text, "&amp;", "&")
    text = strings.ReplaceAll(text, "&lt;", "<")
    text = strings.ReplaceAll(text, "&gt;", ">")
    text = strings.ReplaceAll(text, "&quot;", "\"")
    text = strings.ReplaceAll(text, "&apos;", "'")

    // Clean up whitespace and empty lines
    lines := strings.Split(text, "\n")
    var clean []string
    for _, l := range lines {
        if t := strings.TrimSpace(l); t != "" {
            clean = append(clean, t)
        }
    }
    
    return strings.Join(clean, "\n")
}

// IsTextFile returns true if the file extension indicates a text-based file
func IsTextFile(ext string) bool {
    textExts := map[string]bool{
        ".txt": true, ".json": true, ".csv": true, ".md": true,
        ".go": true, ".py": true, ".js": true, ".jsx": true,
        ".ts": true, ".tsx": true, ".html": true, ".css": true,
        ".yaml": true, ".yml": true, ".env": true, ".sh": true,
        ".sql": true, ".xml": true, ".java": true, ".cpp": true,
        ".c": true, ".h": true, ".rs": true, ".rb": true,
        ".php": true, ".swift": true, ".kt": true,
    }
    return textExts[strings.ToLower(ext)]
}
