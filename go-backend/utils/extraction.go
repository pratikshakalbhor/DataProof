package utils

import (
	"os"
	"regexp"
	"strings"
)

// ExtractPDFText extracts text content from a PDF file
// This is a simplified implementation that reads text streams from PDF
// For production, consider using a dedicated PDF library like pdfcpu
func ExtractPDFText(filePath string) (string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}

	return ExtractPDFTextFromBytes(data), nil
}

// ExtractPDFTextFromBytes extracts text from PDF bytes
// Uses regex pattern matching to find text streams in PDF content
func ExtractPDFTextFromBytes(data []byte) string {
	// Basic PDF text extraction using simple byte scanning
	// PDF text objects typically appear as:
	// BT (begin text object)
	// ... text operators ...
	// ET (end text object)

	var textContent strings.Builder
	textBytes := data

	// Simple extraction: look for readable ASCII/UTF-8 sequences
	for i := 0; i < len(textBytes); i++ {
		b := textBytes[i]
		// If it's a printable character or space
		if (b >= 32 && b <= 126) || b == '\n' || b == '\r' || b == '\t' {
			if b == '\r' || b == '\n' {
				textContent.WriteByte('\n')
				if i+1 < len(textBytes) && ((b == '\r' && textBytes[i+1] == '\n') || (b == '\n' && textBytes[i+1] == '\r')) {
					i++ // Skip the paired newline
				}
			} else if b != 0 {
				textContent.WriteByte(b)
			}
		} else if i > 0 && (textBytes[i-1] >= 32 && textBytes[i-1] <= 126) {
			// Add space as word separator when we hit non-printable
			if textContent.Len() > 0 && textContent.String()[textContent.Len()-1] != ' ' && textContent.String()[textContent.Len()-1] != '\n' {
				textContent.WriteByte(' ')
			}
		}
	}

	result := textContent.String()

	// Clean up multiple spaces and newlines
	re := regexp.MustCompile(`\s+`)
	result = re.ReplaceAllString(result, " ")
	result = strings.TrimSpace(result)

	// If we got very little text, it might be binary or encoded
	if len(result) < 10 {
		return ""
	}

	return result
}


