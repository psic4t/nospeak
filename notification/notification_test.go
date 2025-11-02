package notification

import (
	"runtime"
	"testing"
)

func TestGetDefaultNotifyCommand(t *testing.T) {
	cmd := GetDefaultNotifyCommand()
	if cmd == "" {
		t.Error("Expected a default notification command for current platform")
	}
}

func TestSendNotification(t *testing.T) {
	// Test with empty command (should not panic)
	SendNotification("testuser", "test message", "", false)

	// Test with invalid command (should not panic)
	SendNotification("testuser", "test message", "nonexistentcommand %s", false)

	// Test with echo command (should work)
	SendNotification("testuser", "test message", "echo Notification from %s", false)
}

func TestCommandExists(t *testing.T) {
	// Test with simple command
	if !commandExists("echo") {
		t.Error("Expected echo command to exist")
	}

	// Test with complex command
	if !commandExists("echo \"test message\"") {
		t.Error("Expected complex echo command to be detected")
	}

	// Test with non-existent command
	if commandExists("nonexistentcommand12345") {
		t.Error("Expected non-existent command to return false")
	}
}

func TestNotificationWithRealCommand(t *testing.T) {
	// Test with actual notify-send if available
	if runtime.GOOS == "linux" && commandExists("notify-send") {
		SendNotification("testuser", "test message", "notify-send \"Test notification from %s\"", true)
	}
}
