package logging

import (
	"os"
	"strings"
	"testing"
	"time"
)

func TestIntegration_DebugLoggingAcrossComponents(t *testing.T) {
	// Use a temporary directory for testing
	tempDir := t.TempDir()

	// Override XDG_CACHE_HOME for test
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	// Test that debug logging works from multiple components
	logger := NewDebugLogger(true)
	defer logger.Close()

	// Simulate logging from different components
	logger.Debug("Profile resolver: Found cached profile for %s", "npub1test...")
	logger.Debug("Notification: Executing notification command: %s", "notify-send test")
	logger.Debug("TUI: TUI messageHandler called for %s: %q", "npub1test...", "Hello world")

	// Give the file system a moment
	time.Sleep(10 * time.Millisecond)

	// Read the log file
	logPath := getDebugLogPath()
	content, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}

	logContent := string(content)

	// Verify all components logged correctly
	expectedMessages := []string{
		"Profile resolver: Found cached profile for npub1test...",
		"Notification: Executing notification command: notify-send test",
		"TUI: TUI messageHandler called for npub1test...: \"Hello world\"",
	}

	for _, expected := range expectedMessages {
		if !strings.Contains(logContent, expected) {
			t.Errorf("Expected log message not found: %s\nActual log content:\n%s", expected, logContent)
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

func TestIntegration_DebugLoggingDisabled(t *testing.T) {
	// Use a temporary directory for testing
	tempDir := t.TempDir()

	// Override XDG_CACHE_HOME for test
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	// Test that disabled debug logging doesn't create files
	logger := NewDebugLogger(false)
	defer logger.Close()

	// Try to log debug messages
	logger.Debug("This should not appear in any log file")
	logger.Debug("Neither should this message")

	// Give the file system a moment
	time.Sleep(10 * time.Millisecond)

	// Verify no log file was created
	logPath := getDebugLogPath()
	if _, err := os.Stat(logPath); err == nil {
		t.Error("Expected no log file when debug disabled, but file exists")
	}
}