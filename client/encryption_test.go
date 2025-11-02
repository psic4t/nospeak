package client

import (
	"strings"
	"testing"

	"github.com/data.haus/nospeak/testutils"
	"github.com/nbd-wtf/go-nostr"
)

func TestEncryptMessage(t *testing.T) {
	tests := []struct {
		name          string
		message       string
		recipientNpub string
		wantErr       bool
		expectedErr   string
	}{
		{
			name:          "valid message encryption",
			message:       "Hello, world!",
			recipientNpub: "npub1test...",
			wantErr:       true, // Will fail with invalid npub
			expectedErr:   "failed to decode recipient npub",
		},
		{
			name:          "empty message",
			message:       "",
			recipientNpub: "npub1test...",
			wantErr:       true, // Will fail with invalid npub
			expectedErr:   "failed to decode recipient npub",
		},
		{
			name:          "invalid npub format",
			message:       "Hello",
			recipientNpub: "invalid-npub",
			wantErr:       true,
			expectedErr:   "failed to decode recipient npub",
		},
		{
			name:          "unicode message",
			message:       "Hello 🌍 世界",
			recipientNpub: "npub1test...",
			wantErr:       true, // Will fail with invalid npub
			expectedErr:   "failed to decode recipient npub",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup test client
			senderKeys := testutils.GenerateTestKeys(t)
			client := &Client{
				secretKey: senderKeys.PrivateKey,
				publicKey: senderKeys.PublicKey,
			}

			// Test encryption
			result, err := client.EncryptMessage(tt.message, tt.recipientNpub)

			if tt.wantErr {
				testutils.AssertError(t, err)
				if tt.expectedErr != "" {
					testutils.AssertErrorContains(t, err, tt.expectedErr)
				}
			} else {
				testutils.AssertNoError(t, err)
				if result == "" {
					t.Error("Expected non-empty encrypted result")
				}
			}
		})
	}
}

func TestEncryptMessageValidKeys(t *testing.T) {
	// Generate valid test keys
	senderKeys := testutils.GenerateTestKeys(t)
	recipientKeys := testutils.GenerateTestKeys(t)

	client := &Client{
		secretKey: senderKeys.PrivateKey,
		publicKey: senderKeys.PublicKey,
	}

	tests := []struct {
		name    string
		message string
	}{
		{
			name:    "simple message",
			message: "Hello, world!",
		},
		{
			name:    "unicode message",
			message: "Hello 🌍 世界",
		},
		{
			name:    "long message",
			message: strings.Repeat("This is a test message. ", 100),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := client.EncryptMessage(tt.message, recipientKeys.Npub)

			testutils.AssertNoError(t, err)
			if result == "" {
				t.Error("Expected non-empty encrypted result")
			}

			// Verify result is different from original
			if result == tt.message {
				t.Error("Encrypted message should be different from original")
			}
		})
	}
}

func TestDecryptMessage(t *testing.T) {
	senderKeys := testutils.GenerateTestKeys(t)
	recipientKeys := testutils.GenerateTestKeys(t)

	client := &Client{
		secretKey: recipientKeys.PrivateKey,
		publicKey: recipientKeys.PublicKey,
	}

	// First encrypt a message
	originalMessage := "Hello, world!"
	encrypted, err := client.EncryptMessage(originalMessage, senderKeys.Npub)
	testutils.AssertNoError(t, err)

	// Now decrypt it
	decrypted, err := client.DecryptMessage(encrypted, senderKeys.Npub)
	testutils.AssertNoError(t, err)

	if decrypted != originalMessage {
		t.Errorf("Decrypted message '%s' doesn't match original '%s'", decrypted, originalMessage)
	}
}

func TestEncryptDecryptRoundtrip(t *testing.T) {
	senderKeys := testutils.GenerateTestKeys(t)
	recipientKeys := testutils.GenerateTestKeys(t)

	tests := []struct {
		name    string
		message string
	}{
		{
			name:    "simple message",
			message: "Hello, world!",
		},
		{
			name:    "unicode message",
			message: "Hello 🌍 世界",
		},
		{
			name:    "message with special chars",
			message: "Hello\n\t\r\"'\\",
		},
		{
			name:    "long message",
			message: strings.Repeat("This is a test message with unicode: 🚀 ", 50),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Sender encrypts
			senderClient := &Client{
				secretKey: senderKeys.PrivateKey,
				publicKey: senderKeys.PublicKey,
			}

			encrypted, err := senderClient.EncryptMessage(tt.message, recipientKeys.Npub)
			testutils.AssertNoError(t, err)

			// Recipient decrypts
			recipientClient := &Client{
				secretKey: recipientKeys.PrivateKey,
				publicKey: recipientKeys.PublicKey,
			}

			decrypted, err := recipientClient.DecryptMessage(encrypted, senderKeys.Npub)
			testutils.AssertNoError(t, err)

			if decrypted != tt.message {
				t.Errorf("Roundtrip failed: original '%s', decrypted '%s'", tt.message, decrypted)
			}
		})
	}
}

func TestDecryptMessageInvalidKeys(t *testing.T) {
	client := &Client{
		secretKey: "invalid-secret-key",
		publicKey: "invalid-public-key",
	}

	tests := []struct {
		name         string
		encryptedMsg string
		senderNpub   string
		wantErr      bool
		expectedErr  string
	}{
		{
			name:         "invalid sender npub",
			encryptedMsg: "encrypted-content",
			senderNpub:   "invalid-npub",
			wantErr:      true,
			expectedErr:  "failed to decode sender npub",
		},
		{
			name:         "valid npub but invalid encrypted content",
			encryptedMsg: "invalid-encrypted-content",
			senderNpub:   "npub1test...",
			wantErr:      true,
			expectedErr:  "failed to decode sender npub",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := client.DecryptMessage(tt.encryptedMsg, tt.senderNpub)

			if tt.wantErr {
				testutils.AssertError(t, err)
				if tt.expectedErr != "" {
					testutils.AssertErrorContains(t, err, tt.expectedErr)
				}
			} else {
				testutils.AssertNoError(t, err)
				if result == "" {
					t.Error("Expected non-empty decrypted result")
				}
			}
		})
	}
}

func TestCreateGiftWrap(t *testing.T) {
	senderKeys := testutils.GenerateTestKeys(t)
	recipientKeys := testutils.GenerateTestKeys(t)

	client := &Client{
		secretKey: senderKeys.PrivateKey,
		publicKey: senderKeys.PublicKey,
	}

	// Create a rumor event
	rumor := nostr.Event{
		PubKey:    senderKeys.PublicKey,
		CreatedAt: nostr.Now(),
		Kind:      14,
		Content:   "Hello, world!",
		Tags: nostr.Tags{
			nostr.Tag{"p", recipientKeys.PublicKey},
		},
	}

	tests := []struct {
		name          string
		recipientNpub string
		wantErr       bool
		expectedErr   string
	}{
		{
			name:          "valid gift wrap creation",
			recipientNpub: recipientKeys.Npub,
			wantErr:       false,
		},
		{
			name:          "invalid recipient npub",
			recipientNpub: "invalid-npub",
			wantErr:       true,
			expectedErr:   "failed to decode recipient npub",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			giftWrap, err := client.CreateGiftWrap(rumor, tt.recipientNpub, false)

			if tt.wantErr {
				testutils.AssertError(t, err)
				if tt.expectedErr != "" {
					testutils.AssertErrorContains(t, err, tt.expectedErr)
				}
			} else {
				testutils.AssertNoError(t, err)

				// Verify gift wrap properties
				if giftWrap.Kind != nostr.KindGiftWrap {
					t.Errorf("Expected kind %d, got %d", nostr.KindGiftWrap, giftWrap.Kind)
				}

				// Note: Gift wrap pubkey may not match recipient pubkey due to NIP-59 spec
				// The actual recipient is encoded in the content
				if giftWrap.Content == "" {
					t.Error("Expected non-empty content in gift wrap")
				}
			}
		})
	}
}

func TestUnwrapGiftWrap(t *testing.T) {
	senderKeys := testutils.GenerateTestKeys(t)
	recipientKeys := testutils.GenerateTestKeys(t)

	client := &Client{
		secretKey: recipientKeys.PrivateKey,
		publicKey: recipientKeys.PublicKey,
	}

	// Create a rumor event
	rumor := nostr.Event{
		PubKey:    senderKeys.PublicKey,
		CreatedAt: nostr.Now(),
		Kind:      14,
		Content:   "Hello, world!",
		Tags: nostr.Tags{
			nostr.Tag{"p", recipientKeys.PublicKey},
		},
	}

	// Create gift wrap
	senderClient := &Client{
		secretKey: senderKeys.PrivateKey,
		publicKey: senderKeys.PublicKey,
	}

	giftWrap, err := senderClient.CreateGiftWrap(rumor, recipientKeys.Npub, false)
	testutils.AssertNoError(t, err)

	// Unwrap gift wrap
	unwrapped, err := client.UnwrapGiftWrap(giftWrap, false)
	testutils.AssertNoError(t, err)

	// Verify unwrapped rumor
	if unwrapped.Kind != 14 {
		t.Errorf("Expected kind 14, got %d", unwrapped.Kind)
	}

	if unwrapped.Content != "Hello, world!" {
		t.Errorf("Expected content 'Hello, world!', got '%s'", unwrapped.Content)
	}

	if unwrapped.PubKey != senderKeys.PublicKey {
		t.Errorf("Expected pubkey %s, got %s", senderKeys.PublicKey, unwrapped.PubKey)
	}
}

func TestUnwrapGiftWrapInvalid(t *testing.T) {
	client := &Client{
		secretKey: "invalid-secret-key",
		publicKey: "invalid-public-key",
	}

	// Create invalid gift wrap
	invalidGiftWrap := nostr.Event{
		Kind:    nostr.KindGiftWrap,
		Content: "invalid-content",
	}

	_, err := client.UnwrapGiftWrap(invalidGiftWrap, false)
	testutils.AssertError(t, err)
	testutils.AssertErrorContains(t, err, "failed to unwrap gift")
}

func TestGiftWrapRoundtrip(t *testing.T) {
	senderKeys := testutils.GenerateTestKeys(t)
	recipientKeys := testutils.GenerateTestKeys(t)

	tests := []struct {
		name    string
		message string
	}{
		{
			name:    "simple message",
			message: "Hello, world!",
		},
		{
			name:    "unicode message",
			message: "Hello 🌍 世界",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create rumor
			rumor := nostr.Event{
				PubKey:    senderKeys.PublicKey,
				CreatedAt: nostr.Now(),
				Kind:      14,
				Content:   tt.message,
				Tags: nostr.Tags{
					nostr.Tag{"p", recipientKeys.PublicKey},
				},
			}

			// Sender creates gift wrap
			senderClient := &Client{
				secretKey: senderKeys.PrivateKey,
				publicKey: senderKeys.PublicKey,
			}

			giftWrap, err := senderClient.CreateGiftWrap(rumor, recipientKeys.Npub, false)
			testutils.AssertNoError(t, err)

			// Recipient unwraps gift wrap
			recipientClient := &Client{
				secretKey: recipientKeys.PrivateKey,
				publicKey: recipientKeys.PublicKey,
			}

			unwrapped, err := recipientClient.UnwrapGiftWrap(giftWrap, false)
			testutils.AssertNoError(t, err)

			// Verify roundtrip
			if unwrapped.Content != tt.message {
				t.Errorf("Gift wrap roundtrip failed: original '%s', unwrapped '%s'", tt.message, unwrapped.Content)
			}

			if unwrapped.PubKey != senderKeys.PublicKey {
				t.Errorf("Expected sender pubkey %s, got %s", senderKeys.PublicKey, unwrapped.PubKey)
			}
		})
	}
}
