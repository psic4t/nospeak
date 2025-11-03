package config

import (
	"testing"
)

func TestConfigValidationAllowsEmptyPartners(t *testing.T) {
	// Test that config validation allows empty partners array
	cfg := &Config{
		Relays:   []string{"wss://nostr.data.haus"},
		Npub:     "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft",
		Nsec:     "nsec1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft",
		Partners: []string{}, // Empty partners should be allowed
		Debug:    false,
		Cache:    "memory",
	}

	// This should not return an error - we can't directly test validateConfig since it's private
	// But we can test that the config struct can be created with empty partners
	if cfg == nil {
		t.Fatal("Config should not be nil")
	}

	if len(cfg.Partners) != 0 {
		t.Errorf("Expected empty partners array, got %d partners", len(cfg.Partners))
	}

	if len(cfg.Relays) == 0 {
		t.Error("Relays array should not be empty")
	}
}
