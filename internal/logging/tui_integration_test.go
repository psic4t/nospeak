package logging

import (
	"os"
	"strings"
	"testing"
	"time"
)

// Test that demonstrates the TUI integration works without breaking the interface
func TestTUI_IntegrationDoesNotBreakConsole(t *testing.T) {
	// Use a temporary directory for testing
	tempDir := t.TempDir()

	// Override XDG_CACHE_HOME for test
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	// Test that debug logging when enabled doesn't write to stderr
	logger := NewDebugLogger(true)
	defer logger.Close()

	// Simulate TUI debug messages
	logger.Debug("updateContactListWithNames called")
	logger.Debug("New partner detected: %s", "npub1test...")
	logger.Debug("Fetching profiles for %d new partners", 2)
	logger.Debug("Failed to load contacts: %v", "some error")

	// Give the file system a moment
	time.Sleep(10 * time.Millisecond)

	// Verify log file was created and contains our messages
	logPath := getDebugLogPath()
	content, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}

	logContent := string(content)

	// Verify all TUI debug messages are in the file
	expectedMessages := []string{
		"updateContactListWithNames called",
		"New partner detected: npub1test...",
		"Fetching profiles for 2 new partners",
		"Failed to load contacts: some error",
	}

	for _, expected := range expectedMessages {
		if !strings.Contains(logContent, expected) {
			t.Errorf("Expected TUI debug message not found in log file: %s", expected)
		}
	}

	// Verify consistent [DEBUG] prefix
	lines := strings.Split(strings.TrimSpace(logContent), "\n")
	for _, line := range lines {
		if line != "" && !strings.Contains(line, "[DEBUG]") {
			t.Errorf("Inconsistent log format detected (missing [DEBUG] prefix): %s", line)
		}
	}
}

// Test that ProfileResolver integration works correctly
func TestTUI_ProfileResolverIntegration(t *testing.T) {
	// Use a temporary directory for testing
	tempDir := t.TempDir()

	// Override XDG_CACHE_HOME for test
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	// Test ProfileResolver debug logging
	logger := NewDebugLogger(true)
	defer logger.Close()

	// Simulate ProfileResolver debug messages
	logger.Debug("Found cached profile for %s", "npub1test...")
	logger.Debug("Failed to query profile metadata for %s: %v", "npub1test...", "network error")
	logger.Debug("No profile metadata found for %s", "npub1test...")
	logger.Debug("Failed to parse profile metadata for %s: %v", "npub1test...", "json error")
	logger.Debug("Resolved profile for %s: %s", "npub1test...", "Alice")
	logger.Debug("Refreshed profile for %s: %s", "npub1test...", "Alice")

	// Give the file system a moment
	time.Sleep(10 * time.Millisecond)

	// Verify log file was created and contains ProfileResolver messages
	logPath := getDebugLogPath()
	content, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}

	logContent := string(content)

	// Verify all ProfileResolver debug messages are in the file
	expectedMessages := []string{
		"Found cached profile for npub1test...",
		"Failed to query profile metadata for npub1test...: network error",
		"No profile metadata found for npub1test...",
		"Failed to parse profile metadata for npub1test...: json error",
		"Resolved profile for npub1test...: Alice",
		"Refreshed profile for npub1test...: Alice",
	}

	for _, expected := range expectedMessages {
		if !strings.Contains(logContent, expected) {
			t.Errorf("Expected ProfileResolver debug message not found in log file: %s", expected)
		}
	}
}