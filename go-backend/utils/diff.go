package utils

import (
	"strings"
)

// DiffChange represents a single change in the diff
type DiffChange struct {
	Type  string `json:"type"`  // "added", "removed", "modified", "context"
	Line  string `json:"line"`  // The actual line content
	Index int    `json:"index"` // Line number
}

// DiffResult holds the complete diff
type DiffResult struct {
	OriginalText string       `json:"originalText"`
	TamperedText string       `json:"tamperedText"`
	Diff         []DiffChange `json:"diff"`
	Summary      DiffSummary  `json:"summary"`
}

// DiffSummary contains statistics about the diff
type DiffSummary struct {
	Added    int `json:"added"`
	Removed  int `json:"removed"`
	Modified int `json:"modified"`
	Context  int `json:"context"`
	Total    int `json:"total"`
}

// GenerateLineDiff performs a line-by-line diff between original and tampered text
func GenerateLineDiff(original, tampered string) DiffResult {
	origLines := strings.Split(strings.TrimSpace(original), "\n")
	tampLines := strings.Split(strings.TrimSpace(tampered), "\n")

	changes := make([]DiffChange, 0)
	summary := DiffSummary{}

	// Simple greedy matching algorithm
	origIdx, tampIdx := 0, 0

	for origIdx < len(origLines) || tampIdx < len(tampLines) {
		if origIdx >= len(origLines) {
			// All remaining tampered lines are additions
			for tampIdx < len(tampLines) {
				changes = append(changes, DiffChange{
					Type:  "added",
					Line:  tampLines[tampIdx],
					Index: tampIdx,
				})
				summary.Added++
				tampIdx++
			}
			break
		}

		if tampIdx >= len(tampLines) {
			// All remaining original lines are removed
			for origIdx < len(origLines) {
				changes = append(changes, DiffChange{
					Type:  "removed",
					Line:  origLines[origIdx],
					Index: origIdx,
				})
				summary.Removed++
				origIdx++
			}
			break
		}

		// Both have lines, compare them
		if origLines[origIdx] == tampLines[tampIdx] {
			// Lines match - context
			changes = append(changes, DiffChange{
				Type:  "context",
				Line:  origLines[origIdx],
				Index: origIdx,
			})
			summary.Context++
			origIdx++
			tampIdx++
		} else {
			// Lines differ - look ahead to find matching lines
			origMatch := -1
			tampMatch := -1

			// Look for next matching line in original (up to 3 lines ahead)
			for i := origIdx + 1; i < origIdx+4 && i < len(origLines); i++ {
				if origLines[i] == tampLines[tampIdx] {
					origMatch = i
					break
				}
			}

			// Look for next matching line in tampered (up to 3 lines ahead)
			for i := tampIdx + 1; i < tampIdx+4 && i < len(tampLines); i++ {
				if tampLines[i] == origLines[origIdx] {
					tampMatch = i
					break
				}
			}

			if origMatch != -1 && (tampMatch == -1 || (origMatch-origIdx) <= (tampMatch-tampIdx)) {
				// More efficient to mark lines as removed
				changes = append(changes, DiffChange{
					Type:  "removed",
					Line:  origLines[origIdx],
					Index: origIdx,
				})
				summary.Removed++
				origIdx++
			} else if tampMatch != -1 {
				// More efficient to mark lines as added
				changes = append(changes, DiffChange{
					Type:  "added",
					Line:  tampLines[tampIdx],
					Index: tampIdx,
				})
				summary.Added++
				tampIdx++
			} else {
				// Lines are modified (both exist but different)
				changes = append(changes, DiffChange{
					Type:  "modified",
					Line:  origLines[origIdx] + " → " + tampLines[tampIdx],
					Index: origIdx,
				})
				summary.Modified++
				origIdx++
				tampIdx++
			}
		}
	}

	summary.Total = len(changes)

	return DiffResult{
		OriginalText: original,
		TamperedText: tampered,
		Diff:         changes,
		Summary:      summary,
	}
}

// GenerateWordDiff performs a word-by-word diff (simpler version)
func GenerateWordDiff(original, tampered string) []DiffChange {
	origWords := strings.Fields(original)
	tampWords := strings.Fields(tampered)

	changes := make([]DiffChange, 0)
	origIdx, tampIdx := 0, 0

	for origIdx < len(origWords) || tampIdx < len(tampWords) {
		if origIdx >= len(origWords) {
			// Remaining words are additions
			for tampIdx < len(tampWords) {
				changes = append(changes, DiffChange{
					Type: "added",
					Line: tampWords[tampIdx],
				})
				tampIdx++
			}
			break
		}

		if tampIdx >= len(tampWords) {
			// Remaining words are removals
			for origIdx < len(origWords) {
				changes = append(changes, DiffChange{
					Type: "removed",
					Line: origWords[origIdx],
				})
				origIdx++
			}
			break
		}

		if origWords[origIdx] == tampWords[tampIdx] {
			origIdx++
			tampIdx++
		} else {
			changes = append(changes, DiffChange{
				Type: "removed",
				Line: origWords[origIdx],
			})
			origIdx++
		}
	}

	return changes
}
