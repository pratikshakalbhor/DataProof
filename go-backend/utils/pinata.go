package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"
)

// PinataResponse is the JSON body returned by Pinata's pinning API.
type PinataResponse struct {
	IpfsHash  string `json:"IpfsHash"`
	PinSize   int    `json:"PinSize"`
	Timestamp string `json:"Timestamp"`
}

// UploadToPinata uploads fileData to Pinata/IPFS and returns:
//   - Full gateway URL  (e.g. https://gateway.pinata.cloud/ipfs/<CID>)
//   - The raw CID string
//   - Any error
//
// No mock fallback — if PINATA_JWT is missing or the upload fails the error
// is propagated so the caller can respond with a proper 500/503.
func UploadToPinata(fileData []byte, filename string) (string, string, error) {
	// Environment Variable Connection:
	// Reads PINATA_JWT for authenticated API requests to Pinata.
	// File: utils/pinata.go
	// Security: This is a sensitive secret. Storing it in the environment ensures
	// it only exists in the server's memory.
	jwt := os.Getenv("PINATA_JWT")
	if jwt == "" {
		return "", "", fmt.Errorf("PINATA_JWT environment variable is not set — cannot upload to IPFS")
	}

	// ── Build multipart/form-data body ───────────────────────────────────────
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// File field
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", "", fmt.Errorf("pinata: create form file: %w", err)
	}
	if _, err = io.Copy(part, bytes.NewReader(fileData)); err != nil {
		return "", "", fmt.Errorf("pinata: write file part: %w", err)
	}

	// Metadata
	metadata := fmt.Sprintf(`{"name":"%s","keyvalues":{"app":"ChainSeal"}}`, filename)
	_ = writer.WriteField("pinataMetadata", metadata)
	_ = writer.WriteField("pinataOptions", `{"cidVersion":1}`)
	writer.Close()

	// ── HTTP request ─────────────────────────────────────────────────────────
	req, err := http.NewRequest("POST", "https://api.pinata.cloud/pinning/pinFileToIPFS", body)
	if err != nil {
		return "", "", fmt.Errorf("pinata: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("pinata: HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return "", "", fmt.Errorf("pinata: upload rejected (status %d): %s", resp.StatusCode, string(raw))
	}

	// ── Parse response ───────────────────────────────────────────────────────
	var pinataResp PinataResponse
	if err := json.NewDecoder(resp.Body).Decode(&pinataResp); err != nil {
		return "", "", fmt.Errorf("pinata: parse response: %w", err)
	}
	if pinataResp.IpfsHash == "" {
		return "", "", fmt.Errorf("pinata: empty CID in response")
	}

	gateway := os.Getenv("PINATA_GATEWAY")
	if gateway == "" {
		gateway = "https://gateway.pinata.cloud"
	}
	// Ensure no trailing slash before appending /ipfs/<CID>
	gateway = strings.TrimRight(gateway, "/")

	fullURL := fmt.Sprintf("%s/ipfs/%s", gateway, pinataResp.IpfsHash)
	return fullURL, pinataResp.IpfsHash, nil
}

// FetchFromIPFS fetches decrypted file bytes for a given CID.
// It fetches from the Pinata gateway, decrypts with AES, and returns raw bytes.
func FetchFromIPFS(cid string) ([]byte, error) {
	if cid == "" {
		return nil, fmt.Errorf("IPFS: empty CID provided")
	}

	gateway := os.Getenv("PINATA_GATEWAY")
	if gateway == "" {
		gateway = "https://gateway.pinata.cloud"
	}
	gateway = strings.TrimRight(gateway, "/")

	url := fmt.Sprintf("%s/ipfs/%s", gateway, cid)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("IPFS: fetch failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("IPFS: gateway returned status %d for CID %s", resp.StatusCode, cid)
	}

	encryptedData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("IPFS: read response body: %w", err)
	}

	// Decrypt AES-GCM
	decrypted, err := DecryptAES(encryptedData)
	if err != nil {
		return nil, fmt.Errorf("IPFS: AES decryption failed: %w", err)
	}

	return decrypted, nil
}
