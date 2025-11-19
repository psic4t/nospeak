package mocks

import (
	"github.com/data.haus/nospeak/config"
)

// MockConfig provides a mock configuration for testing
type MockConfig struct {
	Npub         string
	Nsec         string
	Partners     []string
	Debug        bool
	Cache        string
	ShowContacts bool
}

// NewMockConfig creates a new mock configuration
func NewMockConfig() *MockConfig {
	return &MockConfig{
		Npub:         "npub1test...",
		Nsec:         "nsec1test...",
		Partners:     []string{"npub1partner1...", "npub1partner2..."},
		Debug:        false,
		Cache:        "memory",
		ShowContacts: true,
	}
}

// ToConfig converts mock config to actual config.Config
func (m *MockConfig) ToConfig() *config.Config {
	return &config.Config{
		Npub:         m.Npub,
		Nsec:         m.Nsec,
		Partners:     m.Partners,
		Debug:        m.Debug,
		Cache:        m.Cache,
		ShowContacts: m.ShowContacts,
	}
}

// WithRelays is a no-op since relays are now dynamically discovered
func (m *MockConfig) WithRelays(relays ...string) *MockConfig {
	// No-op - relays are now dynamically discovered
	return m
}

// WithKeys sets the keys in mock config
func (m *MockConfig) WithKeys(npub, nsec string) *MockConfig {
	m.Npub = npub
	m.Nsec = nsec
	return m
}

// WithPartners sets the partners in mock config
func (m *MockConfig) WithPartners(partners ...string) *MockConfig {
	m.Partners = partners
	return m
}

// WithDebug sets debug mode in mock config
func (m *MockConfig) WithDebug(debug bool) *MockConfig {
	m.Debug = debug
	return m
}

// WithCache sets cache type in mock config
func (m *MockConfig) WithCache(cacheType string) *MockConfig {
	m.Cache = cacheType
	return m
}

// WithShowContacts sets show contacts in mock config
func (m *MockConfig) WithShowContacts(show bool) *MockConfig {
	m.ShowContacts = show
	return m
}
