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
	fullURL := getGatewayURL(gateway, pinataResp.IpfsHash)
	return fullURL, pinataResp.IpfsHash, nil
}

// getGatewayURL correctly builds the URL without duplicate /ipfs/ or double slashes
func getGatewayURL(gateway, cid string) string {
	gateway = strings.TrimRight(gateway, "/")
	if strings.HasSuffix(gateway, "/ipfs") {
		return fmt.Sprintf("%s/%s", gateway, cid)
	}
	return fmt.Sprintf("%s/ipfs/%s", gateway, cid)
}

// FetchFromIPFS fetches decrypted file bytes for a given CID.
// It fetches from the Pinata gateway (or fallbacks), decrypts with AES, and returns raw bytes.
func FetchFromIPFS(cid string) ([]byte, error) {
	if cid == "" || strings.HasPrefix(cid, "local-only") {
		return nil, fmt.Errorf("IPFS: skip fetch for local-only CID: %s", cid)
	}

	// Get configured gateway
	configGateway := os.Getenv("PINATA_GATEWAY")
	if configGateway == "" {
		configGateway = "https://gateway.pinata.cloud"
	}

	// Build candidate gateways list (removing duplicates while preserving order)
	candidateGateways := []string{configGateway}
	
	// Standard public fallback gateways
	fallbacks := []string{
		"https://ipfs.io",
		"https://gateway.pinata.cloud",
		"https://cloudflare-ipfs.com",
		"https://dweb.link",
	}
	for _, fb := range fallbacks {
		// Avoid adding configGateway twice
		if strings.TrimRight(fb, "/") != strings.TrimRight(configGateway, "/") {
			candidateGateways = append(candidateGateways, fb)
		}
	}

	var lastErr error
	for _, gw := range candidateGateways {
		gwURL := getGatewayURL(gw, cid)
		fmt.Printf("[IPFS] Trying to fetch CID %s from gateway: %s\n", cid, gw)
		
		client := &http.Client{Timeout: 20 * time.Second} // Shorter timeout per gateway so we fallback quickly
		resp, err := client.Get(gwURL)
		if err != nil {
			lastErr = fmt.Errorf("gateway %s error: %w", gw, err)
			fmt.Printf("[IPFS] ⚠️ Failed for %s: %v\n", gw, err)
			continue
		}
		
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			lastErr = fmt.Errorf("gateway %s returned status %d", gw, resp.StatusCode)
			fmt.Printf("[IPFS] ⚠️ Status %d for %s\n", resp.StatusCode, gw)
			continue
		}

		encryptedData, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("gateway %s read error: %w", gw, err)
			continue
		}

		// Decrypt AES-GCM
		decrypted, err := DecryptAES(encryptedData)
		if err != nil {
			// If decryption fails, the data is invalid/tampered or encryption key is wrong.
			// However, since we encrypt files during upload, all valid files on IPFS should decrypt.
			// Let's print a warning and return error immediately to avoid trying other gateways
			// since the file content was downloaded successfully but decryption failed.
			return nil, fmt.Errorf("IPFS: data downloaded from %s but AES decryption failed: %w", gw, err)
		}

		fmt.Printf("[IPFS] ✅ Successfully fetched and decrypted from %s\n", gw)
		return decrypted, nil
	}

	return nil, fmt.Errorf("IPFS: all gateways failed to fetch CID %s. Last error: %v", cid, lastErr)
}
