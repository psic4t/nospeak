package testutils

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"testing"

	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip19"
)

// TestKeys holds test key pairs
type TestKeys struct {
	PrivateKey string
	PublicKey  string
	Nsec       string
	Npub       string
}

// GenerateTestKeys creates a new test key pair
func GenerateTestKeys(t *testing.T) TestKeys {
	privateKey := nostr.GeneratePrivateKey()
	publicKey, err := nostr.GetPublicKey(privateKey)
	if err != nil {
		t.Fatalf("Failed to get public key: %v", err)
	}

	nsec, err := nip19.EncodePrivateKey(privateKey)
	if err != nil {
		t.Fatalf("Failed to encode private key: %v", err)
	}

	npub, err := nip19.EncodePublicKey(publicKey)
	if err != nil {
		t.Fatalf("Failed to encode public key: %v", err)
	}

	return TestKeys{
		PrivateKey: privateKey,
		PublicKey:  publicKey,
		Nsec:       nsec,
		Npub:       npub,
	}
}

// CreateTempDir creates a temporary directory for testing
func CreateTempDir(t *testing.T) string {
	dir, err := os.MkdirTemp("", "nospeak-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	// Register cleanup function
	t.Cleanup(func() {
		os.RemoveAll(dir)
	})

	return dir
}

// CreateTempFile creates a temporary file with the given content
func CreateTempFile(t *testing.T, content string) string {
	file, err := os.CreateTemp("", "nospeak-test-*.toml")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	// Register cleanup function
	t.Cleanup(func() {
		file.Close()
		os.Remove(file.Name())
	})

	if _, err := file.WriteString(content); err != nil {
		t.Fatalf("Failed to write to temp file: %v", err)
	}

	return file.Name()
}

// GenerateRandomString generates a random hex string of specified length
func GenerateRandomString(length int) string {
	bytes := make([]byte, length/2)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// CreateTestEvent creates a basic Nostr event for testing
func CreateTestEvent(t *testing.T, pubkey string, kind int, content string) nostr.Event {
	event := nostr.Event{
		PubKey:    pubkey,
		CreatedAt: nostr.Now(),
		Kind:      kind,
		Content:   content,
		Tags:      nostr.Tags{},
	}

	// Don't sign for testing purposes
	return event
}

// CreateTestMessageEvent creates a test message event (kind 14)
func CreateTestMessageEvent(t *testing.T, senderPubkey, recipientPubkey, message string) nostr.Event {
	event := nostr.Event{
		PubKey:    senderPubkey,
		CreatedAt: nostr.Now(),
		Kind:      14,
		Content:   message,
		Tags: nostr.Tags{
			nostr.Tag{"p", recipientPubkey},
		},
	}

	return event
}

// CreateTestGiftWrap creates a test gift-wrapped event
func CreateTestGiftWrap(t *testing.T, senderKeys, recipientKeys TestKeys, message string) nostr.Event {
	_ = CreateTestMessageEvent(t, senderKeys.PublicKey, recipientKeys.PublicKey, message)

	// Create a simple gift wrap for testing
	giftWrap := nostr.Event{
		PubKey:    recipientKeys.PublicKey,
		CreatedAt: nostr.Now(),
		Kind:      nostr.KindGiftWrap,
		Content:   "encrypted-content-placeholder",
		Tags: nostr.Tags{
			nostr.Tag{"p", recipientKeys.PublicKey},
		},
	}

	return giftWrap
}

// AssertNoError is a helper to assert no error occurred
func AssertNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

// AssertError is a helper to assert an error occurred
func AssertError(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("Expected error but got none")
	}
}

// AssertErrorContains checks if error message contains expected text
func AssertErrorContains(t *testing.T, err error, expected string) {
	t.Helper()
	if err == nil {
		t.Fatal("Expected error but got none")
	}
	if !contains(err.Error(), expected) {
		t.Fatalf("Error message '%s' does not contain expected text '%s'", err.Error(), expected)
	}
}

// contains is a helper function to check if string contains substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > len(substr) && indexOf(s, substr) >= 0))
}

// indexOf finds the index of a substring
func indexOf(s, substr string) int {
	n := len(substr)
	if n == 0 {
		return 0
	}
	if n > len(s) {
		return -1
	}
	for i := 0; i <= len(s)-n; i++ {
		if s[i:i+n] == substr {
			return i
		}
	}
	return -1
}

// GetTestNSEC returns a valid test nsec key
func GetTestNSEC() string {
	return "nsec1ufvfs6uuq68xwzpswwc3g9z7srp5h6x2sdhzxc6rk5htqdl3s6qjz9fk8"
}

// GetTestNPUB returns a valid test npub key
func GetTestNPUB() string {
	return "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6an"
}
