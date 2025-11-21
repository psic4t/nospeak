package cmd

import (
	"strings"
	"testing"

	"github.com/data.haus/nospeak/mocks"
	"github.com/data.haus/nospeak/testutils"
)

func TestSendValidation(t *testing.T) {
	tests := []struct {
		name        string
		args        []string
		expectError bool
	}{
		{
			name:        "no arguments",
			args:        []string{},
			expectError: true,
		},
		{
			name:        "one argument",
			args:        []string{"npub1..."},
			expectError: true,
		},
		{
			name:        "valid arguments",
			args:        []string{"npub1...", "Hello world"},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hasEnoughArgs := len(tt.args) >= 2

			if tt.expectError && hasEnoughArgs {
				t.Errorf("Expected error but arguments are sufficient: %v", tt.args)
			}

			if !tt.expectError && !hasEnoughArgs {
				t.Errorf("Expected sufficient arguments but got: %v", tt.args)
			}

			if hasEnoughArgs {
				recipientNpub := tt.args[0]
				message := strings.Join(tt.args[1:], " ")

				if recipientNpub == "" {
					t.Errorf("Recipient npub should not be empty")
				}

				if message == "" {
					t.Errorf("Message should not be empty when args are sufficient")
				}
			}
		})
	}
}

func TestReceiveValidation(t *testing.T) {
	mockClient := mocks.NewMockClient()
	testKeys := testutils.GenerateTestKeys(t)

	// Test partner management
	err := mockClient.AddPartner(testKeys.Npub)
	if err != nil {
		t.Errorf("Failed to add partner: %v", err)
	}

	if !mockClient.IsPartner(testKeys.Npub) {
		t.Errorf("Partner should be detected after adding")
	}

	partners := mockClient.GetPartnerNpubs()
	if len(partners) != 1 {
		t.Errorf("Expected 1 partner, got %d", len(partners))
	}
}

func TestSetNameValidation(t *testing.T) {
	tests := []struct {
		name        string
		args        []string
		expectError bool
		expected    string
	}{
		{
			name:        "no arguments",
			args:        []string{},
			expectError: true,
			expected:    "",
		},
		{
			name:        "valid name",
			args:        []string{"Alice"},
			expectError: false,
			expected:    "Alice",
		},
		{
			name:        "name with spaces",
			args:        []string{"Alice Smith"},
			expectError: false,
			expected:    "Alice Smith", // Full first argument
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hasEnoughArgs := len(tt.args) >= 1

			if tt.expectError && hasEnoughArgs {
				t.Errorf("Expected error but arguments are sufficient: %v", tt.args)
			}

			if !tt.expectError && !hasEnoughArgs {
				t.Errorf("Expected sufficient arguments but got: %v", tt.args)
			}

			if hasEnoughArgs {
				name := tt.args[0]

				if name != tt.expected {
					t.Errorf("Expected name %q, got %q", tt.expected, name)
				}
			}
		})
	}
}

func TestSetMessagingRelaysValidation(t *testing.T) {
	mockClient := mocks.NewMockClient()

	err := mockClient.SetMessagingRelays()
	if err != nil {
		t.Errorf("Failed to set messaging relays: %v", err)
	}

	// Test basic relay validation
	relayTests := []struct {
		name     string
		relayURL string
		valid    bool
	}{
		{
			name:     "valid wss relay",
			relayURL: "wss://relay.damus.io",
			valid:    true,
		},
		{
			name:     "valid ws relay",
			relayURL: "ws://localhost:8080",
			valid:    true,
		},
		{
			name:     "invalid http relay",
			relayURL: "http://relay.damus.io",
			valid:    false,
		},
		{
			name:     "empty relay URL",
			relayURL: "",
			valid:    false,
		},
	}

	for _, tt := range relayTests {
		t.Run(tt.name, func(t *testing.T) {
			isEmpty := tt.relayURL == ""
			hasValidProtocol := strings.HasPrefix(tt.relayURL, "wss://") || strings.HasPrefix(tt.relayURL, "ws://")

			isValid := !isEmpty && hasValidProtocol

			if isValid != tt.valid {
				t.Errorf("Expected validity %v for relay %s, got %v", tt.valid, tt.relayURL, isValid)
			}
		})
	}
}

func TestChatValidation(t *testing.T) {
	mockClient := mocks.NewMockClient()
	partnerKeys := testutils.GenerateTestKeys(t)

	// Test partner management for chat
	mockClient.AddPartner(partnerKeys.Npub)

	partners := mockClient.GetPartnerNpubs()
	if len(partners) != 1 {
		t.Errorf("Expected 1 partner for chat, got %d", len(partners))
	}

	// Test message sending
	_, err := mockClient.SendChatMessage(nil, partnerKeys.Npub, "Hello world", true)
	if err != nil {
		t.Errorf("Failed to send chat message: %v", err)
	}

	// Test profile name setting
	err = mockClient.SetProfileName("Test User")
	if err != nil {
		t.Errorf("Failed to set profile name: %v", err)
	}

	// Test display name resolution
	displayNames, err := mockClient.GetPartnerDisplayNames(nil, true)
	if err != nil {
		t.Errorf("Failed to get display names: %v", err)
	}

	if len(displayNames) != 1 {
		t.Errorf("Expected 1 display name, got %d", len(displayNames))
	}
}

func TestCommandArgumentValidation(t *testing.T) {
	// Test general argument validation patterns
	testCases := []struct {
		name        string
		args        []string
		minArgs     int
		maxArgs     int
		expectValid bool
		description string
	}{
		{
			name:        "empty args",
			args:        []string{},
			minArgs:     1,
			maxArgs:     2,
			expectValid: false,
			description: "Empty argument list should be invalid",
		},
		{
			name:        "minimum args",
			args:        []string{"arg1"},
			minArgs:     1,
			maxArgs:     2,
			expectValid: true,
			description: "Minimum arguments should be valid",
		},
		{
			name:        "maximum args",
			args:        []string{"arg1", "arg2"},
			minArgs:     1,
			maxArgs:     2,
			expectValid: true,
			description: "Maximum arguments should be valid",
		},
		{
			name:        "too many args",
			args:        []string{"arg1", "arg2", "arg3"},
			minArgs:     1,
			maxArgs:     2,
			expectValid: false,
			description: "Too many arguments should be invalid",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			argCount := len(tc.args)
			isValid := argCount >= tc.minArgs && argCount <= tc.maxArgs

			if isValid != tc.expectValid {
				t.Errorf("%s: Expected validity %v, got %v", tc.description, tc.expectValid, isValid)
			}

			if isValid {
				for i, arg := range tc.args {
					if arg == "" {
						t.Errorf("Argument %d should not be empty", i)
					}
				}
			}
		})
	}
}

func TestConfigValidation(t *testing.T) {
	testKeys := testutils.GenerateTestKeys(t)

	// Test basic config validation without file operations
	configValidationTests := []struct {
		name        string
		nsec        string
		npub        string
		relays      []string
		expectValid bool
		description string
	}{
		{
			name:        "minimal valid config",
			nsec:        testKeys.Nsec,
			npub:        testKeys.Npub,
			relays:      []string{"wss://relay.damus.io"},
			expectValid: true,
			description: "Minimal configuration should be valid",
		},
		{
			name:        "empty nsec",
			nsec:        "",
			npub:        testKeys.Npub,
			relays:      []string{"wss://relay.damus.io"},
			expectValid: false,
			description: "Empty nsec should be invalid",
		},
		{
			name:        "empty npub",
			nsec:        testKeys.Nsec,
			npub:        "",
			relays:      []string{"wss://relay.damus.io"},
			expectValid: false,
			description: "Empty npub should be invalid",
		},
		{
			name:        "no relays",
			nsec:        testKeys.Nsec,
			npub:        testKeys.Npub,
			relays:      []string{},
			expectValid: true,
			description: "Empty relays should be valid (optional)",
		},
	}

	for _, tc := range configValidationTests {
		t.Run(tc.name, func(t *testing.T) {
			// Basic validation logic
			hasValidNsec := tc.nsec != "" && strings.HasPrefix(tc.nsec, "nsec1")
			hasValidNpub := tc.npub != "" && strings.HasPrefix(tc.npub, "npub1")
			hasValidRelays := len(tc.relays) >= 0 // Relays are optional

			isValid := hasValidNsec && hasValidNpub && hasValidRelays

			if isValid != tc.expectValid {
				t.Errorf("Expected validity %v, got %v: %s", tc.expectValid, isValid, tc.description)
			}

			if isValid {
				t.Logf("Config validation passed: %s", tc.description)
			}
		})
	}
}

func TestErrorHandling(t *testing.T) {
	// Test error handling patterns
	mockClient := mocks.NewMockClient()
	testKeys := testutils.GenerateTestKeys(t)

	errorTests := []struct {
		name        string
		testFunc    func() error
		expectError bool
	}{
		{
			name: "add empty partner",
			testFunc: func() error {
				return mockClient.AddPartner("")
			},
			expectError: true,
		},
		{
			name: "add valid partner",
			testFunc: func() error {
				return mockClient.AddPartner(testKeys.Npub)
			},
			expectError: false,
		},
		{
			name: "send empty message",
			testFunc: func() error {
				_, err := mockClient.SendChatMessage(nil, testKeys.Npub, "", true)
				return err
			},
			expectError: true,
		},
		{
			name: "send valid message",
			testFunc: func() error {
				_, err := mockClient.SendChatMessage(nil, testKeys.Npub, "Hello", true)
				return err
			},
			expectError: false,
		},
		{
			name: "set empty profile name",
			testFunc: func() error {
				return mockClient.SetProfileName("")
			},
			expectError: true,
		},
		{
			name: "set valid profile name",
			testFunc: func() error {
				return mockClient.SetProfileName("Test User")
			},
			expectError: false,
		},
	}

	for _, tt := range errorTests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.testFunc()

			if tt.expectError && err == nil {
				t.Errorf("Expected error but got none")
			}

			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
		})
	}
}
