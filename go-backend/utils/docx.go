package utils

import (
    "archive/zip"
    "fmt"
    "io"
    "regexp"
    "strings"
)

// ExtractDocxText extracts plain text from a .docx file by reading word/document.xml
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
        
        return strings.Join(clean, "\n"), nil
    }
    
    return "", fmt.Errorf("word/document.xml not found in archive")
}
