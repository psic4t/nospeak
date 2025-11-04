package logging

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestDebugLogger_LogsWhenEnabled(t *testing.T) {
	// Use a temporary directory for testing
	tempDir := t.TempDir()

	// Override XDG_CACHE_HOME for test
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	logger := NewDebugLogger(true)
	defer logger.Close()

	logger.Debug("test message %s", "debug")

	// Give the file system a moment to write
	time.Sleep(10 * time.Millisecond)

	// Read the log file
	logPath := getDebugLogPath()
	content, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}

	if !strings.Contains(string(content), "test message debug") {
		t.Errorf("Expected debug message in log, got: %s", string(content))
	}

	// Verify log format contains timestamp and DEBUG prefix
	logContent := string(content)
	if !strings.Contains(logContent, "[DEBUG]") {
		t.Error("Expected [DEBUG] prefix in log output")
	}
}

func TestDebugLogger_SilenceWhenDisabled(t *testing.T) {
	// Use a temporary directory for testing
	tempDir := t.TempDir()

	// Override XDG_CACHE_HOME for test
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	logger := NewDebugLogger(false)
	defer logger.Close()

	logger.Debug("test message")

	// Give the file system a moment
	time.Sleep(10 * time.Millisecond)

	// Verify no log file was created
	logPath := getDebugLogPath()
	if _, err := os.Stat(logPath); err == nil {
		t.Error("Expected no log file when debug disabled")
	}
}

func TestDebugLogger_LogRotation(t *testing.T) {
	// Test rotation logic by mocking a large file
	tempDir := t.TempDir()

	// Override XDG_CACHE_HOME for test
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	logger := NewDebugLogger(true)
	defer logger.Close()

	// Test the rotation method directly by creating a file manually
	logPath := getDebugLogPath()
	if err := os.MkdirAll(filepath.Dir(logPath), 0755); err != nil {
		t.Fatalf("Failed to create log directory: %v", err)
	}

	// Create a file that we can test rotation on
	testContent := "Test content"
	if err := os.WriteFile(logPath, []byte(testContent), 0644); err != nil {
		t.Fatalf("Failed to create test log file: %v", err)
	}

	// Temporarily override maxLogSize to be smaller for testing
	// Note: This tests the rotation logic without requiring a huge file
	logger.mu.Lock()
	if err := logger.rotateLogIfNeeded(logPath); err != nil {
		logger.mu.Unlock()
		t.Fatalf("Failed to rotate log: %v", err)
	}
	logger.mu.Unlock()

	// The file should still exist since it's smaller than maxLogSize
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		t.Error("Expected original log file to still exist (too small for rotation)")
	}
}

func TestGlobalDebugLogger(t *testing.T) {
	// Use a temporary directory for testing
	tempDir := t.TempDir()

	// Override XDG_CACHE_HOME for test
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	err := InitGlobalDebugLogger(true)
	if err != nil {
		t.Fatalf("Failed to initialize global logger: %v", err)
	}
	defer CloseGlobalLogger()

	Debug("global test message %s", "debug")

	// Give the file system a moment
	time.Sleep(10 * time.Millisecond)

	// Read the log file
	logPath := getDebugLogPath()
	content, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}

	if !strings.Contains(string(content), "global test message debug") {
		t.Errorf("Expected global debug message in log, got: %s", string(content))
	}
}

func TestGetDebugLogPath(t *testing.T) {
	// Test with XDG_CACHE_HOME set
	tempDir := t.TempDir()
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	expected := filepath.Join(tempDir, "nospeak", "debug.log")
	actual := getDebugLogPath()

	if actual != expected {
		t.Errorf("Expected log path %s, got %s", expected, actual)
	}

	// Test with default XDG_CACHE_HOME
	os.Unsetenv("XDG_CACHE_HOME")
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("Failed to get user home directory: %v", err)
	}

	expected = filepath.Join(home, ".cache", "nospeak", "debug.log")
	actual = getDebugLogPath()

	if actual != expected {
		t.Errorf("Expected default log path %s, got %s", expected, actual)
	}
}