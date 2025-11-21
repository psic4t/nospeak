package mocks

import (
	"context"
	"fmt"
	"sync"

	"github.com/data.haus/nospeak/cache"
)

// MockClient implements a mock client for testing
type MockClient struct {
	partners map[string]bool
	cache    *MockCache
	mu       sync.RWMutex
}

// NewMockClient creates a new mock client instance
func NewMockClient() *MockClient {
	return &MockClient{
		partners: make(map[string]bool),
		cache:    NewMockCache(),
	}
}

// AddPartner adds a partner to the mock client
func (m *MockClient) AddPartner(npub string) error {
	if npub == "" {
		return fmt.Errorf("partner npub cannot be empty")
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.partners[npub] = true
	return nil
}

// IsPartner checks if a npub is a partner
func (m *MockClient) IsPartner(npub string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.partners[npub]
}

// GetPartnerNpubs returns all partner npubs
func (m *MockClient) GetPartnerNpubs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	partners := make([]string, 0, len(m.partners))
	for npub := range m.partners {
		partners = append(partners, npub)
	}

	return partners
}

// SendChatMessage mocks sending a chat message
func (m *MockClient) SendChatMessage(ctx context.Context, recipientNpub, message string, debug bool) (int, error) {
	if recipientNpub == "" {
		return 0, fmt.Errorf("recipient cannot be empty")
	}

	if message == "" {
		return 0, fmt.Errorf("message cannot be empty")
	}

	// Add to cache as sent message
	err := m.cache.AddMessage(recipientNpub, message, "mock-event-id", "sent")
	if err != nil {
		return 0, fmt.Errorf("failed to cache message: %w", err)
	}

	if debug {
		fmt.Printf("Mock: Sent message to %s: %s\n", recipientNpub[:8]+"...", message)
	}

	// Mock: return 1 successful relay
	return 1, nil
}

// SetProfileName mocks setting a profile name
func (m *MockClient) SetProfileName(name string) error {
	if name == "" {
		return fmt.Errorf("name cannot be empty")
	}

	fmt.Printf("Mock: Set profile name to: %s\n", name)
	return nil
}

// SetMessagingRelays mocks setting messaging relays
func (m *MockClient) SetMessagingRelays() error {
	fmt.Println("Mock: Set messaging relays from configuration")
	return nil
}

// GetPartnerDisplayNames mocks getting partner display names
func (m *MockClient) GetPartnerDisplayNames(ctx context.Context, debug bool) (map[string]string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	displayNames := make(map[string]string)
	for npub := range m.partners {
		// Use truncated npub as display name for mock
		displayName := npub[:8] + "..."
		displayNames[npub] = displayName

		if debug {
			fmt.Printf("Mock: Display name for %s: %s\n", npub[:8]+"...", displayName)
		}
	}

	return displayNames, nil
}

// GetMessageHistoryEnhanced mocks getting enhanced message history
func (m *MockClient) GetMessageHistoryEnhanced(recipientNpub string, sentLimit, receivedLimit int) []cache.MessageEntry {
	return m.cache.GetRecentMessages(recipientNpub, sentLimit, receivedLimit)
}

// ResolveUsername mocks resolving a username
func (m *MockClient) ResolveUsername(ctx context.Context, npub string, debug bool) (string, error) {
	displayName := npub[:8] + "..."

	if debug {
		fmt.Printf("Mock: Resolved username for %s: %s\n", npub[:8]+"...", displayName)
	}

	return displayName, nil
}

// ListenForMessages mocks listening for messages
func (m *MockClient) ListenForMessages(ctx context.Context, messageHandler func(string, string), debug bool) error {
	fmt.Println("Mock: Starting to listen for messages")

	// In a real implementation, this would listen for events
	// For mock purposes, we just return immediately
	return nil
}
